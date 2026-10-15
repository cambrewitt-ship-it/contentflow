import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { processDueQueuedRuns, purgeExpiredResearchData } from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Optional backstop for competitor research housekeeping. Queued runs also
 * start on page visits and old data is also purged after each run, so this
 * only matters when the app is quiet. Suggested schedule: hourly
 * ("0 * * * *"), or daily on plans that only allow daily crons.
 */
export async function GET(req: NextRequest) {
  // This path skips the login check in middleware, so it must fail closed:
  // in production it only runs with CRON_SECRET set and presented.
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' || cronSecret) {
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized competitor research cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
