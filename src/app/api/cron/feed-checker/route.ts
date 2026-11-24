import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { rejectUnauthorizedCron } from '@/lib/cronAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { ensureZernioWebhook } from '@/lib/zernio/webhook';
import { refreshComments } from '@/lib/comments/sync';
import { runFeedChecker } from '@/lib/feedChecker/check';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron (a few times a day): make sure Zernio sends the app new comments (webhook),
 * run the Feed Checker for clients that have it on, and keep every other connected
 * client's comments inbox fresh. Triggered by .github/workflows/cron-feed-checker.yml.
 */

const TIME_BUDGET_MS = 260_000;
const CONCURRENCY = 3;

export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req, 'feed-checker');
  if (rejected) return rejected;
  const started = Date.now();
  const webhook = await ensureZernioWebhook();

  const admin = createSupabaseAdmin();
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, name, feed_agent_settings')
    .not('late_profile_id', 'is', null);
  if (error) {
    logger.error('Feed checker cron: client query failed', error);
    return NextResponse.json({ error: 'Client query failed (migration 036 run?)' }, { status: 500 });
  }

  // Feed Checker clients first, then the rest (inbox refresh only)
  const enabled = (c: { feed_agent_settings: unknown }) => (c.feed_agent_settings as Record<string, unknown> | null)?.enabled === true;
  const queue = [...(clients ?? []).filter(enabled), ...(clients ?? []).filter((c) => !enabled(c))];
  const results: Record<string, string> = {};

  const worker = async () => {
    while (queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const client = queue.shift()!;
      try {
        if (enabled(client)) {
          const s = await runFeedChecker(admin, client.id);
          results[client.name] = s ? `checked ${s.postsChecked}, issues ${s.issuesFound}, hidden ${s.autoHidden}, liked ${s.autoLiked}` : 'skipped';
        } else {
          const r = await refreshComments(admin, client.id);
          results[client.name] = r ? `comments ${r.synced}` : 'fresh';
        }
      } catch (err) {
        results[client.name] = `failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  logger.info('Feed checker cron done', { webhook, results, remaining: queue.length });
  return NextResponse.json({ webhook, results, remaining: queue.length });
}
