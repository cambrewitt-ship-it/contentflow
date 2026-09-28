import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackPostCreation } from '@/lib/subscriptionMiddleware';
import { getOrCreateDefaultProject } from '@/lib/autopilot-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── POST: move one draft into the calendar's Unscheduled Posts bar ────────────
// Same destination as the plan-level "Add to Calendar" action: an unscheduled
// post the user places on a day themselves. Never auto-scheduled.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();

    const { data: candidate } = await admin
      .from('autopilot_candidates')
      .select('*, autopilot_plans!inner(user_id, project_id)')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }
    const plan = candidate.autopilot_plans as { user_id: string; project_id: string | null } | null;
    if (plan?.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const projectId = plan.project_id ?? (await getOrCreateDefaultProject(candidate.client_id, user.id)).id;

    const hashtags: string[] = candidate.hashtags ?? [];
    const fullCaption = hashtags.length > 0
      ? `${candidate.caption}\n\n${hashtags.join(' ')}`
      : candidate.caption;

    const { data: post, error: postErr } = await admin
      .from('calendar_unscheduled_posts')
      .insert({
        project_id: projectId,
        client_id: candidate.client_id,
        caption: fullCaption,
        image_url: candidate.media_url,
        post_notes: null,
        status: 'draft',
      })
      .select('*')
      .single();

    if (postErr || !post) {
      logger.error('Draft → calendar: insert failed:', postErr);
      return NextResponse.json(
        { success: false, error: postErr?.message || 'Failed to add post to calendar' },
        { status: 500 }
      );
    }

    await trackPostCreation(user.id);

    // Cool the photo down for future generations, as the plan-level confirm does.
    if (candidate.media_gallery_id) {
      const { data: item } = await admin
        .from('media_gallery')
        .select('times_used, freshness_score')
        .eq('id', candidate.media_gallery_id)
        .single();
      if (item) {
        await admin
          .from('media_gallery')
          .update({
            times_used: (item.times_used ?? 0) + 1,
            last_used_at: new Date().toISOString(),
            freshness_score: Math.max(0.1, (item.freshness_score ?? 1) - 0.2),
          })
          .eq('id', candidate.media_gallery_id);
      }
    }

    // It lives in the calendar now, so it's no longer a draft.
    await admin
      .from('autopilot_candidates')
      .update({ saved_to_drafts: false, saved_to_drafts_at: null, updated_at: new Date().toISOString() })
      .eq('id', candidateId);

    return NextResponse.json({ success: true, post });
  } catch (error) {
    logger.error('POST /api/autopilot/drafts/[candidateId]/to-calendar error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
