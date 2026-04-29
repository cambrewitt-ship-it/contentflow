import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  planId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ planId: searchParams.get('planId') });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'planId is required' },
        { status: 400 }
      );
    }

    const { planId } = parsed.data;
    const admin = createSupabaseAdmin();

    // Verify plan ownership
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }
    if (plan.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: candidates, error } = await admin
      .from('autopilot_candidates')
      .select('*')
      .eq('autopilot_plan_id', planId)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('GET /api/autopilot/candidates error fetching candidates:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch candidates' }, { status: 500 });
    }

    return NextResponse.json({ success: true, candidates: candidates ?? [] });
  } catch (error) {
    logger.error('GET /api/autopilot/candidates error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
