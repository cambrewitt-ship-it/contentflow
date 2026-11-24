import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnauthorizedCron } from '@/lib/cronAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { fillGapsForClient } from '@/lib/autopilot-gapfill';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron: every morning, for clients with the Content Agent on and "Keep the calendar
 * filled" switched on, draft posts for any shortfall in the next 7 days (see
 * src/lib/autopilot-gapfill.ts). The agent's normal "plan ready" notification and
 * email tell the account manager there are drafts to approve.
 * Triggered by .github/workflows/cron-fill-gaps.yml.
 */

// An agent run takes a minute or two; clients not reached are picked up tomorrow
const TIME_BUDGET_MS = 200_000;
const CONCURRENCY = 2;

export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req, 'fill-gaps');
  if (rejected) return rejected;

  const started = Date.now();
  const admin = createSupabaseAdmin();
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, user_id, name, timezone, posting_preferences, autopilot_settings')
    .eq('autopilot_enabled', true);
  if (error) {
    logger.error('Fill gaps: client query failed', error);
    return NextResponse.json({ error: 'Client query failed' }, { status: 500 });
  }

  const queue = (clients ?? []).filter((c) => {
    const s = (c.autopilot_settings ?? {}) as Record<string, unknown>;
    return s.fill_gaps === true;
  });
  const results: Record<string, string> = {};

  const worker = async () => {
    while (queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const client = queue.shift()!;
      const result = await fillGapsForClient(admin, client);
      results[client.name ?? client.id] = result.status === 'filled' ? `filled ${result.shortfall}` : `${result.status}: ${result.reason}`;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  logger.info('Fill gaps done', { results, remaining: queue.length });
  return NextResponse.json({ results, remaining: queue.length });
}
