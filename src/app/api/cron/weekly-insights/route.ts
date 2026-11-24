import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnauthorizedCron } from '@/lib/cronAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { createNotification } from '@/lib/notifications';
import { generateRecommendations, refreshSnapshot } from '@/lib/analytics/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron: every Monday, re-read each connected client's results from Zernio, write
 * fresh recommendations and tell the account owner in their notifications — the
 * proactive "here's what to do this week" a social media manager would bring.
 * Triggered by .github/workflows/cron-weekly-insights.yml.
 */

// Leave headroom under maxDuration; clients not reached refresh on their next page view
const TIME_BUDGET_MS = 270_000;
const CONCURRENCY = 3;

export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req, 'weekly-insights');
  if (rejected) return rejected;

  const started = Date.now();
  const admin = createSupabaseAdmin();
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, name, user_id')
    .not('late_profile_id', 'is', null);
  if (error) {
    logger.error('Weekly insights: client query failed', error);
    return NextResponse.json({ error: 'Client query failed' }, { status: 500 });
  }

  const queue = [...(clients ?? [])];
  let processed = 0;
  let notified = 0;

  const worker = async () => {
    while (queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const client = queue.shift()!;
      try {
        const snapshot = await refreshSnapshot(admin, client.id);
        if (snapshot === 'missing_table') {
          queue.length = 0;
          return;
        }
        processed++;
        if (snapshot.status !== 'ok' || !snapshot.insights || snapshot.insights.postCount < 5) continue;
        const recs = await generateRecommendations(admin, client.id);
        if (recs?.length && client.user_id) {
          await createNotification({
            userId: client.user_id,
            clientId: client.id,
            type: 'analytics_insights',
            title: `This week for ${client.name}: ${recs[0].title}`,
            body: [snapshot.insights.findings[0], `${recs.length} recommendations from last week's results.`].filter(Boolean).join(' '),
            link: `/dashboard/client/${client.id}/analytics`,
          });
          notified++;
        }
      } catch (err) {
        logger.error('Weekly insights failed for client', { clientId: client.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  logger.info('Weekly insights done', { processed, notified, remaining: queue.length });
  return NextResponse.json({ processed, notified, remaining: queue.length });
}
