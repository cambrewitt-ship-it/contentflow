import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth, requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ── GET: every post saved to drafts for a client ──────────────────────────────
// Drafts are kept candidates that the user chose to park on the Content Agent
// page instead of sending to the calendar.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'clientId is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const admin = createSupabaseAdmin();
    const { data: drafts, error } = await admin
      .from('autopilot_candidates')
      .select('*')
      .eq('client_id', clientId)
      .eq('saved_to_drafts', true)
      .order('saved_to_drafts_at', { ascending: false })
      .limit(200);

    if (error) {
      // 42703 = undefined column: migration 025 hasn't been run yet. Treat it as
      // "no drafts" so the page still works rather than showing an error.
      if (error.code === '42703') {
        logger.warn('Drafts column missing — run migrations/025-autopilot-drafts.sql');
        return NextResponse.json({ success: true, drafts: [] });
      }
      logger.error('GET /api/autopilot/drafts error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json({ success: true, drafts: drafts ?? [] });
  } catch (error) {
    logger.error('GET /api/autopilot/drafts error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST: save a plan's kept posts to drafts ──────────────────────────────────

const bodySchema = z.object({
  planId: z.string().uuid(),
  /** Optional subset; defaults to every kept organic candidate on the plan. */
  candidateIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'planId is required' },
        { status: 400 }
      );
    }
    const { planId, candidateIds } = parsed.data;

    const admin = createSupabaseAdmin();

    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, status')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }
    if (plan.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Ad copy is never a calendar post and lives in the Ad Copy panel, so only
    // organic kept candidates become drafts.
    let query = admin
      .from('autopilot_candidates')
      .update({
        saved_to_drafts: true,
        saved_to_drafts_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('autopilot_plan_id', planId)
      .eq('decision', 'kept')
      .neq('post_type', 'paid_ad');

    if (candidateIds && candidateIds.length > 0) {
      query = query.in('id', candidateIds);
    }

    const { data: drafts, error } = await query.select('*');

    if (error) {
      logger.error('POST /api/autopilot/drafts error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save drafts' }, { status: 500 });
    }

    // Mark the plan as done so the page stops re-opening it as the active plan.
    await admin
      .from('autopilot_plans')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', planId);

    logger.info('Content Agent: kept posts saved to drafts', { planId, count: drafts?.length ?? 0 });

    return NextResponse.json({ success: true, drafts: drafts ?? [] });
  } catch (error) {
    logger.error('POST /api/autopilot/drafts error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
