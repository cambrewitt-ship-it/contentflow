import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnauthorizedCron } from '@/lib/cronAuth';
import { processDueQueuedRuns, purgeExpiredResearchData } from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Competitor research housekeeping, meant to run hourly like the other cron
 * routes: starts research runs queued behind Instagram's rate limit and strips
 * competitor post content older than the retention window. Queued runs also
 * start on page visits and cleanup also runs after each research run, so this
 * mainly covers quiet periods.
 */
export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req, 'competitor-research');
  if (rejected) return rejected;

  try {
    const purged = await purgeExpiredResearchData();
    // Each run can take a couple of minutes; two fit in the time budget
    const started = await processDueQueuedRuns({ limit: 2 });
    return NextResponse.json({ success: true, purged, started });
  } catch (error) {
    logger.error('Competitor research cron failed:', error);
    return NextResponse.json({ success: false, error: 'Cron failed' }, { status: 500 });
  }
}
