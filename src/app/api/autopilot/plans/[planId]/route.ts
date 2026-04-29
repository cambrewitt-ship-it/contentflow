import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['generating', 'draft', 'pending_approval', 'partially_approved', 'approved', 'published', 'failed']).optional(),
});

async function getOwnedPlan(planId: string, userId: string) {
  const admin = createSupabaseAdmin();
  const { data: plan, error } = await admin
    .from('autopilot_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();

  if (error || !plan) return { plan: null, notFound: true };
  if (plan.user_id !== userId) return { plan: null, notFound: false };
  return { plan, notFound: false };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { plan, notFound } = await getOwnedPlan(planId, user.id);
    if (notFound) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    if (!plan) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const admin = createSupabaseAdmin();

    // Fetch all posts for this plan
    const { data: posts, error: postsErr } = await admin
      .from('calendar_scheduled_posts')
      .select('*')
      .eq('autopilot_plan_id', planId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (postsErr) {
      logger.error('Error fetching autopilot posts:', postsErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch posts' }, { status: 500 });
    }

    // Fetch media gallery items for each post
    const mediaIds = (posts || [])
      .map(p => p.media_gallery_id)
      .filter(Boolean) as string[];

    let mediaMap: Record<string, unknown> = {};
    if (mediaIds.length > 0) {
      const { data: mediaItems } = await admin
        .from('media_gallery')
        .select('id, media_url, ai_description, ai_tags, ai_mood')
        .in('id', mediaIds);

      for (const item of mediaItems || []) {
        mediaMap[item.id] = item;
      }
    }

    const postsWithMedia = (posts || []).map(p => ({
      ...p,
      media_gallery_item: p.media_gallery_id ? (mediaMap[p.media_gallery_id] ?? null) : null,
    }));

    return NextResponse.json({ success: true, plan, posts: postsWithMedia });
  } catch (error) {
    logger.error('GET /api/autopilot/plans/[planId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { plan, notFound } = await getOwnedPlan(planId, user.id);
    if (notFound) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    if (!plan) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const admin = createSupabaseAdmin();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status) updates.status = parsed.data.status;

    const { data: updated, error: updateErr } = await admin
      .from('autopilot_plans')
      .update(updates)
      .eq('id', planId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      logger.error('Error updating autopilot plan:', updateErr);
      return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: updated });
  } catch (error) {
    logger.error('PATCH /api/autopilot/plans/[planId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
