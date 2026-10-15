import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { withAICreditCheck } from '@/lib/subscriptionMiddleware';
import { RESEARCH_RUN_CREDITS, STALE_RUN_MS, runCompetitorResearch } from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The run continues after the response (via after()) inside this budget
export const maxDuration = 300;

type Params = { params: Promise<{ clientId: string }> };

const bodySchema = z.object({ includeTrends: z.boolean().default(true) });

// Start a research run. Returns the report row straight away; the page polls
// GET reports/[reportId] until it's completed or failed.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: running } = await admin
      .from('competitor_research_reports')
      .select('id, created_at')
      .eq('client_id', clientId)
      .eq('status', 'running')
      .gte('created_at', new Date(Date.now() - STALE_RUN_MS).toISOString())
      .limit(1)
      .maybeSingle();
    if (running) {
      return NextResponse.json(
        { success: false, error: 'Research is already running for this profile.', reportId: running.id },
        { status: 409 }
      );
    }

    const creditCheck = await withAICreditCheck(request, RESEARCH_RUN_CREDITS);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const { data: report, error } = await admin
      .from('competitor_research_reports')
      .insert({
        client_id: clientId,
        user_id: auth.user.id,
        status: 'running',
        progress: 'Starting research',
        include_trends: parsed.data.includeTrends,
      })
      .select('id, status, progress, accounts_analyzed, posts_analyzed, error, created_at, completed_at')
      .single();
    if (error || !report) throw error ?? new Error('Failed to create report');

    after(() => runCompetitorResearch(report.id, clientId, auth.user.id, parsed.data.includeTrends));

    return NextResponse.json({ success: true, report }, { status: 202 });
  } catch (error) {
    logger.error('POST /api/clients/[clientId]/competitor-research/reports error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
