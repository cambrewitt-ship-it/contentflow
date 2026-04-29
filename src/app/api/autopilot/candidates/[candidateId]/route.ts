import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { recordPreference } from '@/lib/preference-engine';

export const dynamic = 'force-dynamic';

const swipeSchema = z.object({ decision: z.enum(['kept', 'skipped']) });

const fieldSchema = z
  .object({
    suggested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    suggested_time: z.string().optional(),
    caption: z.string().min(1).max(5000).optional(),
  })
  .refine(b => b.suggested_date || b.suggested_time || b.caption, {
    message: 'At least one field is required',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json();
    const admin = createSupabaseAdmin();

    // Fetch candidate to verify ownership
    const { data: candidate } = await admin
      .from('autopilot_candidates')
      .select('*, autopilot_plans!inner(user_id)')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }
    const planUserId = (candidate.autopilot_plans as { user_id: string } | null)?.user_id;
    if (planUserId !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ── Swipe decision ────────────────────────────────────────────────────────
    const swipeParsed = swipeSchema.safeParse(body);
    if (swipeParsed.success) {
      const { decision } = swipeParsed.data;

      const { data: updated, error: updateErr } = await admin
        .from('autopilot_candidates')
        .update({
          decision,
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
        .select('*')
        .single();

      if (updateErr) {
        logger.error('PATCH candidate decision error:', updateErr);
        return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 });
      }

      // Record preference training data (non-fatal)
      try {
        await recordPreference({
          clientId: candidate.client_id,
          userId: user.id,
          mediaGalleryId: candidate.media_gallery_id ?? null,
          caption: candidate.caption,
          postType: candidate.post_type ?? 'unknown',
          platforms: candidate.platforms ?? [],
          eventContext: candidate.event_reference ?? null,
          seasonContext: candidate.season_tag ?? null,
          liked: decision === 'kept',
          autopilotPlanId: candidate.autopilot_plan_id,
        });
      } catch (prefErr) {
        logger.error('Failed to record preference:', prefErr);
      }

      // Update plan counters
      const counterField = decision === 'kept' ? 'candidates_liked' : 'candidates_skipped';
      const { data: plan } = await admin
        .from('autopilot_plans')
        .select('candidates_liked, candidates_skipped')
        .eq('id', candidate.autopilot_plan_id)
        .single();

      if (plan) {
        const current = (plan[counterField as keyof typeof plan] as number) ?? 0;
        await admin
          .from('autopilot_plans')
          .update({ [counterField]: current + 1 })
          .eq('id', candidate.autopilot_plan_id);
      }

      return NextResponse.json({ success: true, candidate: updated });
    }

    // ── Field update (date / caption) ─────────────────────────────────────────
    const fieldParsed = fieldSchema.safeParse(body);
    if (!fieldParsed.success) {
      return NextResponse.json(
        { success: false, error: fieldParsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fieldParsed.data.suggested_date) updates.suggested_date = fieldParsed.data.suggested_date;
    if (fieldParsed.data.suggested_time) updates.suggested_time = fieldParsed.data.suggested_time;
    if (fieldParsed.data.caption) updates.caption = fieldParsed.data.caption;

    const { data: updated, error: updateErr } = await admin
      .from('autopilot_candidates')
      .update(updates)
      .eq('id', candidateId)
      .select('*')
      .single();

    if (updateErr) {
      logger.error('PATCH candidate field update error:', updateErr);
      return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 });
    }

    return NextResponse.json({ success: true, candidate: updated });
  } catch (error) {
    logger.error('PATCH /api/autopilot/candidates/[candidateId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
