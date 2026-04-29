import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackPostCreation } from '@/lib/subscriptionMiddleware';
import { getOrCreateDefaultProject } from '@/lib/autopilot-engine';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();

    // Verify plan ownership
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, client_id, project_id, status')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }
    if (plan.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all kept candidates
    const { data: keptCandidates, error: fetchErr } = await admin
      .from('autopilot_candidates')
      .select('*')
      .eq('autopilot_plan_id', planId)
      .eq('decision', 'kept');

    if (fetchErr) {
      logger.error('Confirm: failed to fetch kept candidates:', fetchErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch kept candidates' }, { status: 500 });
    }

    if (!keptCandidates || keptCandidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No kept candidates found. Swipe and keep at least one post before confirming.' },
        { status: 400 }
      );
    }

    // Resolve project for this plan
    const projectId = plan.project_id ?? (await getOrCreateDefaultProject(plan.client_id, user.id)).id;

    // Create calendar_scheduled_posts from each kept candidate
    const createdPosts: unknown[] = [];
    let firstInsertError: string | null = null;

    for (const candidate of keptCandidates) {
      // Normalise time to HH:MM:SS — Postgres TIME returns HH:MM:SS already,
      // so only append :00 when the value is in HH:MM format (2 parts).
      const timeParts = (candidate.suggested_time ?? '').split(':');
      const scheduledTime = timeParts.length >= 3
        ? timeParts.slice(0, 3).join(':')        // already HH:MM:SS
        : timeParts.length === 2
        ? `${candidate.suggested_time}:00`        // HH:MM → HH:MM:00
        : '12:00:00';

      // Build combined caption with hashtags
      const hashtags: string[] = candidate.hashtags ?? [];
      const fullCaption = hashtags.length > 0
        ? `${candidate.caption}\n\n${hashtags.join(' ')}`
        : candidate.caption;

      const { data: post, error: postErr } = await admin
        .from('calendar_scheduled_posts')
        .insert({
          project_id: projectId,
          client_id: plan.client_id,
          caption: fullCaption,
          image_url: candidate.media_url,
          post_notes: null,
          scheduled_date: candidate.suggested_date,
          scheduled_time: scheduledTime,
          source: 'autopilot',
          autopilot_plan_id: planId,
          media_gallery_id: candidate.media_gallery_id ?? null,
          ai_reasoning: candidate.ai_reasoning ?? null,
          autopilot_status: 'approved',
          approval_status: 'draft',
        })
        .select('*')
        .single();

      if (postErr) {
        logger.error('Confirm: failed to create calendar post from candidate:', postErr);
        if (!firstInsertError) firstInsertError = postErr.message;
      } else if (post) {
        createdPosts.push(post);
        await trackPostCreation(user.id);
      }
    }

    if (createdPosts.length === 0) {
      return NextResponse.json(
        { success: false, error: `Failed to create any calendar posts. DB error: ${firstInsertError ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // Update gallery freshness for used media
    const usedGalleryIds = new Set(
      keptCandidates
        .map(c => c.media_gallery_id)
        .filter(Boolean) as string[]
    );

    for (const galleryId of usedGalleryIds) {
      const { data: item } = await admin
        .from('media_gallery')
        .select('times_used, freshness_score')
        .eq('id', galleryId)
        .single();

      if (item) {
        await admin
          .from('media_gallery')
          .update({
            times_used: (item.times_used ?? 0) + 1,
            last_used_at: new Date().toISOString(),
            freshness_score: Math.max(0.1, (item.freshness_score ?? 1) - 0.2),
          })
          .eq('id', galleryId);
      }
    }

    // Mark plan as approved
    const { data: updatedPlan } = await admin
      .from('autopilot_plans')
      .update({
        status: 'approved',
        posts_approved: createdPosts.length,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select('*')
      .single();

    logger.info('Autopilot v2: plan confirmed', {
      planId,
      postsCreated: createdPosts.length,
    });

    return NextResponse.json({ success: true, posts: createdPosts, plan: updatedPlan });
  } catch (error) {
    logger.error('POST /api/autopilot/plans/[planId]/confirm error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
