import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { withAICreditCheck } from '@/lib/subscriptionMiddleware';
import { generateContentPlan } from '@/lib/autopilot-engine';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().default(false),
});

function nextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDay(); // 0=Sun,1=Mon
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireClientOwnership(request, '');
    // Re-parse body first to get clientId for ownership check
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { clientId, force } = parsed.data;

    // Re-check ownership with actual clientId
    const ownership = await requireClientOwnership(request, clientId);
    if (ownership.error) return ownership.error;
    const { user } = ownership;

    // Check autopilot_enabled (unless force)
    const admin = createSupabaseAdmin();
    const { data: clientRow } = await admin
      .from('clients')
      .select('autopilot_enabled, posting_preferences')
      .eq('id', clientId)
      .single();

    if (!force && !clientRow?.autopilot_enabled) {
      return NextResponse.json(
        { success: false, error: 'Autopilot is not enabled for this client. Enable it in Autopilot Settings or pass force: true.' },
        { status: 400 }
      );
    }

    // Resolve dates
    const startDate = parsed.data.startDate
      ? new Date(parsed.data.startDate + 'T00:00:00Z')
      : nextMonday(new Date());
    const endDate = parsed.data.endDate
      ? new Date(parsed.data.endDate + 'T23:59:59Z')
      : addDays(startDate, 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Check for existing non-failed plan in this range
    if (!force) {
      const { data: existingPlan } = await admin
        .from('autopilot_plans')
        .select('id, status')
        .eq('client_id', clientId)
        .eq('plan_week_start', startStr)
        .neq('status', 'failed')
        .maybeSingle();

      if (existingPlan) {
        return NextResponse.json(
          {
            success: false,
            error: `A plan already exists for this week (status: ${existingPlan.status}). Pass force: true to generate a new one.`,
            existingPlanId: existingPlan.id,
          },
          { status: 409 }
        );
      }
    }

    // Credit check: 1 base + candidateCount (v2 generates 10-12 candidates)
    const postsPerWeek =
      (clientRow?.posting_preferences as { posts_per_week?: number })?.posts_per_week ?? 3;
    const candidateCount = Math.min(12, Math.max(10, postsPerWeek * 3));
    const estimatedCredits = 1 + candidateCount;
    const creditCheck = await withAICreditCheck(request, estimatedCredits);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    logger.info('Autopilot: generating plan', { clientId, startStr, endStr, userId: user.id });

    const result = await generateContentPlan(clientId, user.id, startDate, endDate);

    return NextResponse.json({ success: true, plan: result.plan, candidates: result.candidates }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/autopilot/generate-plan error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
