import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { regenerateCaption } from '@/lib/autopilot-engine';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  postId: z.string().uuid(),
  newMediaGalleryId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { postId, newMediaGalleryId } = parsed.data;

    // Credit check
    const creditCheck = await withAICreditCheck(request, 1);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const admin = createSupabaseAdmin();

    // Verify plan ownership
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, client_id')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    if (plan.user_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    // Fetch the post
    const { data: post } = await admin
      .from('calendar_scheduled_posts')
      .select('id, media_gallery_id, autopilot_plan_id, caption')
      .eq('id', postId)
      .eq('autopilot_plan_id', planId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found in this plan' }, { status: 404 });
    }

    // Fetch new gallery item (verify it belongs to client)
    const { data: newMedia } = await admin
      .from('media_gallery')
      .select('id, media_url, ai_description, ai_tags, ai_categories, ai_mood, ai_setting, ai_subjects, freshness_score, times_used, user_context, last_used_at, media_type, client_id')
      .eq('id', newMediaGalleryId)
      .eq('client_id', plan.client_id)
      .eq('status', 'available')
      .maybeSingle();

    if (!newMedia) {
      return NextResponse.json(
        { success: false, error: 'Media item not found or not available for this client' },
        { status: 404 }
      );
    }

    // Regenerate caption for the new photo
    let newCaption = post.caption || '';
    try {
      newCaption = await regenerateCaption({
        clientId: plan.client_id,
        galleryItem: {
          id: newMedia.id,
          media_url: newMedia.media_url,
          media_type: newMedia.media_type,
          ai_description: newMedia.ai_description,
          ai_tags: newMedia.ai_tags || [],
          ai_categories: newMedia.ai_categories || [],
          ai_mood: newMedia.ai_mood,
          ai_setting: newMedia.ai_setting,
          ai_subjects: newMedia.ai_subjects || [],
          freshness_score: newMedia.freshness_score,
          times_used: newMedia.times_used,
          user_context: newMedia.user_context,
          last_used_at: newMedia.last_used_at,
        },
        postType: 'engagement',
        platforms: ['instagram', 'facebook'],
      });
    } catch (captionErr) {
      logger.error('Caption regeneration failed, keeping original:', captionErr);
    }

    // Update the post
    const { data: updatedPost, error: updateErr } = await admin
      .from('calendar_scheduled_posts')
      .update({
        caption: newCaption,
        image_url: newMedia.media_url,
        media_gallery_id: newMediaGalleryId,
        autopilot_status: 'pending_approval',
        approval_status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select('*')
      .single();

    if (updateErr || !updatedPost) {
      logger.error('Failed to update post after swap:', updateErr);
      return NextResponse.json({ success: false, error: 'Failed to update post' }, { status: 500 });
    }

    // Update gallery usage: decrement old, increment new
    const oldMediaId = post.media_gallery_id;
    if (oldMediaId && oldMediaId !== newMediaGalleryId) {
      const { data: oldMedia } = await admin
        .from('media_gallery')
        .select('times_used, freshness_score')
        .eq('id', oldMediaId)
        .maybeSingle();

      if (oldMedia) {
        await admin
          .from('media_gallery')
          .update({
            times_used: Math.max(0, oldMedia.times_used - 1),
            freshness_score: Math.min(1.0, (oldMedia.freshness_score || 0.8) + 0.2),
          })
          .eq('id', oldMediaId);
      }
    }

    await admin
      .from('media_gallery')
      .update({
        times_used: (newMedia.times_used || 0) + 1,
        last_used_at: new Date().toISOString(),
        freshness_score: Math.max(0.1, (newMedia.freshness_score || 1) - 0.2),
      })
      .eq('id', newMediaGalleryId);

    // Track credit
    await trackAICreditUsage(user.id, 1, 'autopilot_swap_photo', plan.client_id);

    return NextResponse.json({ success: true, post: updatedPost });
  } catch (error) {
    logger.error('POST /api/autopilot/plans/[planId]/swap-photo error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
