import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { fetchBrandContext, getRecentPosts } from '@/lib/autopilot-agent/context';
import { accountStats, rankPosts } from './analyze';
import { getInstagramBudget } from './apiUsage';
import { getCachedSnapshots, saveSnapshots } from './cache';
import { fetchInstagramAccount, instagramResearchConfigured, InstagramLookupError } from './instagram';
import { getResearchProfile } from './profile';
import { synthesizeReport } from './synthesize';
import { fetchTikTokAccounts, tiktokResearchConfigured } from './tiktok';
import { searchTrends, suggestAccounts } from './webSearch';
import type {
  AccountSnapshot,
  AccountSuggestion,
  CompetitorAccount,
  ResearchPlatform,
  ResearchReport,
  TrendFindings,
} from './types';

export const RESEARCH_RUN_CREDITS = 5;
export const DISCOVERY_CREDITS = 1;
export const MAX_TRACKED_ACCOUNTS = 15;

// Competitor post content in reports is removed after this many days; the
// insights and metrics stay. Enforced by purge_competitor_research_data().
export const RETENTION_DAYS = 90;

// Only posts from this window count, so the research reflects what's working now
const POST_WINDOW_DAYS = 90;
const TOP_POSTS = 16;
// Instagram lookups in flight at once
const IG_CONCURRENCY = 4;

// A run that's been "running" this long since it started died with its
// function invocation.
export const STALE_RUN_MS = 10 * 60 * 1000;
// A queued run that still can't start after this long is failed.
const QUEUE_GIVE_UP_MS = 24 * 60 * 60 * 1000;

export function researchConfig() {
  return {
    instagram: instagramResearchConfigured(),
    tiktok: tiktokResearchConfigured(),
    trends: !!process.env.OPENAI_API_KEY,
  };
}

export function isStaleRun(r: { status: string; started_at?: string | null; created_at: string }): boolean {
  return r.status === 'running' && Date.now() - Date.parse(r.started_at ?? r.created_at) > STALE_RUN_MS;
}

async function setProgress(reportId: string, progress: string) {
  const admin = createSupabaseAdmin();
  await admin.from('competitor_research_reports').update({ progress }).eq('id', reportId);
}

// Park a run until Instagram's shared rate limit has room again. It's picked
// up by processDueQueuedRuns (page visits, other runs, or the cron route).
async function queueRun(reportId: string, resumeAt: Date | null) {
  const admin = createSupabaseAdmin();
  const { data: row } = await admin
    .from('competitor_research_reports')
    .select('created_at, attempts')
    .eq('id', reportId)
    .single();

  if (row && Date.now() - Date.parse(row.created_at) > QUEUE_GIVE_UP_MS) {
    await admin
      .from('competitor_research_reports')
      .update({
        status: 'failed',
        progress: null,
        queued_until: null,
        error: "Instagram stayed too busy to run this research — please try again later. You weren't charged.",
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    return;
  }

  const earliest = Date.now() + 5 * 60 * 1000;
  const until = new Date(Math.max(earliest, resumeAt?.getTime() ?? earliest));
  await admin
    .from('competitor_research_reports')
    .update({
      status: 'queued',
      queued_until: until.toISOString(),
      attempts: (row?.attempts ?? 0) + 1,
      progress: "Waiting for Instagram's hourly limit to reset — research will start automatically",
    })
    .eq('id', reportId);
  logger.info('Competitor research queued for rate limit', { reportId, until: until.toISOString() });
}

// Fetch Instagram accounts a few at a time; once Meta says we're rate
// limited, skip the rest instead of burning more failed calls.
async function fetchInstagramBatch(handles: string[], warnings: string[]): Promise<AccountSnapshot[]> {
  const out: AccountSnapshot[] = [];
  let skipped = 0;
  let limited = false;

  for (let i = 0; i < handles.length; i += IG_CONCURRENCY) {
    const batch = handles.slice(i, i + IG_CONCURRENCY);
    if (limited) {
      skipped += batch.length;
      continue;
    }
    const results = await Promise.allSettled(batch.map(h => fetchInstagramAccount(h, 25)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        out.push(r.value);
      } else if (r.reason instanceof InstagramLookupError && r.reason.kind === 'rate_limited') {
        limited = true;
        skipped++;
      } else {
        warnings.push(r.reason instanceof Error ? r.reason.message : `Couldn't load @${batch[j]}`);
      }
    });
  }

  if (skipped > 0) {
    warnings.push(
      `Instagram's hourly limit was reached, so ${skipped} account${skipped === 1 ? ' was' : 's were'} skipped this time.`
    );
  }
  return out;
}

/**
 * Run one research job end to end and store the result on the report row.
 * Never throws: failures are recorded on the row for the page to show.
 */
export async function runCompetitorResearch(reportId: string, clientId: string, userId: string, includeTrends: boolean) {
  const admin = createSupabaseAdmin();
  const warnings: string[] = [];

  try {
    const { data: accountRows } = await admin
      .from('competitor_accounts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    const accounts = (accountRows ?? []) as CompetitorAccount[];
    const config = researchConfig();

    const igAccounts = accounts.filter(a => a.platform === 'instagram');
    const ttAccounts = accounts.filter(a => a.platform === 'tiktok');
    if (igAccounts.length && !config.instagram) warnings.push('Instagram accounts skipped: Instagram research is not configured.');
    if (ttAccounts.length && !config.tiktok) warnings.push('TikTok accounts skipped: TikTok research is not configured.');

    const igHandles = config.instagram ? igAccounts.map(a => a.handle) : [];
    const ttHandles = config.tiktok ? ttAccounts.map(a => a.handle) : [];

    // Accounts fetched in the last day (by any client) come from the cache
    const [igCached, ttCached] = await Promise.all([
      getCachedSnapshots('instagram', igHandles),
      getCachedSnapshots('tiktok', ttHandles),
    ]);
    const igToFetch = igHandles.filter(h => !igCached.has(h));
    const ttToFetch = ttHandles.filter(h => !ttCached.has(h));

    if (igToFetch.length > 0) {
      const budget = await getInstagramBudget();
      if (!budget.available) {
        await queueRun(reportId, budget.resumeAt);
        return;
      }
    }

    // ── 1. Collect posts ────────────────────────────────────────────────────
    await setProgress(reportId, `Collecting posts from ${accounts.length} account${accounts.length === 1 ? '' : 's'}`);
    const { clientName, profile } = await getResearchProfile(clientId);

    const platforms = [...new Set(accounts.map(a => a.platform))] as ResearchPlatform[];
    const trendsPromise: Promise<TrendFindings | null> = includeTrends && config.trends
      ? searchTrends(clientName, profile, platforms.length ? platforms : ['instagram', 'tiktok']).catch(err => {
          warnings.push('Trend search failed — insights are based on competitor posts only.');
          logger.error('Competitor research: trends failed', err);
          return null;
        })
      : Promise.resolve(null);

    const fetched: AccountSnapshot[] = [];
    fetched.push(...(await fetchInstagramBatch(igToFetch, warnings)));

    if (ttToFetch.length) {
      try {
        const tt = await fetchTikTokAccounts(ttToFetch, 20);
        fetched.push(...tt);
        const found = new Set(tt.map(s => s.handle));
        for (const h of ttToFetch) {
          if (!found.has(h)) warnings.push(`No TikTok videos found for @${h} (check the handle, or the account may be private).`);
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'TikTok fetch failed');
      }
    }

    await saveSnapshots(fetched);
    const snapshots = [...igCached.values(), ...ttCached.values(), ...fetched];

    // Refresh the stored profile details for the accounts we reached
    await Promise.all(
      snapshots.map(s =>
        admin
          .from('competitor_accounts')
          .update({
            display_name: s.display_name,
            bio: s.bio,
            profile_picture_url: s.profile_picture_url,
            followers_count: s.followers_count,
            media_count: s.media_count,
            last_checked_at: new Date().toISOString(),
          })
          .eq('client_id', clientId)
          .eq('platform', s.platform)
          .eq('handle', s.handle)
      )
    );

    const cutoff = Date.now() - POST_WINDOW_DAYS * 24 * 3600 * 1000;
    const withPosts = snapshots
      .map(s => ({ ...s, posts: s.posts.filter(p => !p.posted_at || Date.parse(p.posted_at) >= cutoff) }))
      .filter(s => s.posts.length > 0);
    const postCount = withPosts.reduce((n, s) => n + s.posts.length, 0);

    const trends = await trendsPromise;
    if (withPosts.length === 0 && !trends) {
      throw new Error(
        accounts.length === 0
          ? 'Add some accounts to track (or turn on trend search) before running research.'
          : "Couldn't load any recent posts from the tracked accounts."
      );
    }

    // ── 2. Analyse ──────────────────────────────────────────────────────────
    await setProgress(reportId, `Analysing ${postCount} posts${trends ? ' and current trends' : ''}`);
    const stats = withPosts.map(accountStats);
    const topPosts = rankPosts(withPosts, TOP_POSTS);

    const [brand, ownPosts] = await Promise.all([fetchBrandContext(clientId), getRecentPosts(clientId, 60)]);
    const ownRecentCaptions = (ownPosts as Array<{ caption: string | null }>)
      .map(p => p.caption ?? '')
      .filter(Boolean)
      .slice(0, 8);

    await setProgress(reportId, 'Writing insights and post ideas');
    const { output, tokens } = await synthesizeReport({
      clientName,
      profile,
      brand,
      ownRecentCaptions,
      posts: topPosts,
      stats,
      trends,
    });

    const report: ResearchReport = {
      ...output,
      trending_formats: trends?.trending_formats ?? [],
      engagement_tactics: [
        ...output.engagement_tactics,
        ...(trends?.engagement_tactics ?? []).map(t => ({ title: t.title, description: `${t.description} ${t.how_to_use}`.trim(), evidence: 'Web research' })),
      ],
      caption_patterns: [
        ...output.caption_patterns,
        ...(trends?.caption_trends ?? []).map(t => ({ title: t.title, description: `${t.description} ${t.how_to_use}`.trim(), example: '' })),
      ],
      posts: topPosts,
      account_stats: stats,
      trend_sources: trends?.sources ?? [],
    };

    await admin
      .from('competitor_research_reports')
      .update({
        status: 'completed',
        progress: null,
        queued_until: null,
        report,
        warnings,
        accounts_analyzed: withPosts.length,
        posts_analyzed: postCount,
        credits_used: RESEARCH_RUN_CREDITS,
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    await trackAICreditUsage(userId, RESEARCH_RUN_CREDITS, 'competitor_research', clientId, {
      report_id: reportId,
      accounts: withPosts.length,
      posts: postCount,
      fetched: fetched.length,
      tokens,
    });

    await purgeExpiredResearchData();
  } catch (err) {
    logger.error('Competitor research run failed', { reportId, error: err instanceof Error ? err.message : String(err) });
    await admin
      .from('competitor_research_reports')
      .update({
        status: 'failed',
        progress: null,
        queued_until: null,
        warnings,
        error: err instanceof Error ? err.message : 'Research failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
  }
}

/**
 * Start queued runs whose wait is over. Each run is claimed with a
 * conditional update so two callers can't start the same one.
 */
export async function processDueQueuedRuns(options: { clientId?: string; limit?: number } = {}): Promise<number> {
  const admin = createSupabaseAdmin();
  let query = admin
    .from('competitor_research_reports')
    .select('id, client_id, user_id, include_trends')
    .eq('status', 'queued')
    .lte('queued_until', new Date().toISOString())
    .order('queued_until', { ascending: true })
    .limit(options.limit ?? 2);
  if (options.clientId) query = query.eq('client_id', options.clientId);

  const { data: due } = await query;
  let started = 0;
  for (const r of due ?? []) {
    const { data: claimed } = await admin
      .from('competitor_research_reports')
      .update({ status: 'running', progress: 'Starting research', started_at: new Date().toISOString() })
      .eq('id', r.id)
      .eq('status', 'queued')
      .select('id');
    if (!claimed?.length) continue;
    started++;

    if (!r.user_id) {
      await admin
        .from('competitor_research_reports')
        .update({ status: 'failed', progress: null, error: 'The user who started this research no longer exists.' })
        .eq('id', r.id);
      continue;
    }
    await runCompetitorResearch(r.id, r.client_id, r.user_id, r.include_trends);
  }
  return started;
}

// Strip competitor post content from old reports and clear stale cache rows.
export async function purgeExpiredResearchData(): Promise<number> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc('purge_competitor_research_data', { retention_days: RETENTION_DAYS });
  if (error) {
    logger.warn('Competitor research purge failed', error);
    return 0;
  }
  return (data as number | null) ?? 0;
}

export type InstagramLookup =
  | { status: 'found'; account: AccountSnapshot }
  | { status: 'not_found'; message: string }
  // Not configured, or the shared rate limit is too close to use
  | { status: 'skipped' };

/**
 * Check an Instagram handle, preferring the shared cache and leaving the
 * rate limit for research runs when it's running low.
 */
export async function lookupInstagramAccount(handle: string): Promise<InstagramLookup> {
  if (!instagramResearchConfigured()) return { status: 'skipped' };

  const cached = (await getCachedSnapshots('instagram', [handle])).get(handle);
  if (cached) return { status: 'found', account: cached };

  const budget = await getInstagramBudget();
  if (!budget.available) return { status: 'skipped' };

  try {
    return { status: 'found', account: await fetchInstagramAccount(handle, 0) };
  } catch (err) {
    if (err instanceof InstagramLookupError && err.kind === 'not_found') {
      return { status: 'not_found', message: err.message };
    }
    logger.warn('Instagram lookup skipped', { handle, error: err instanceof Error ? err.message : String(err) });
    return { status: 'skipped' };
  }
}

/**
 * Find accounts in the client's niche via web search. Instagram suggestions
 * are checked so only real, reachable accounts are returned (when the rate
 * limit allows); TikTok handles can't be checked cheaply and come back
 * unverified.
 */
export async function discoverAccounts(
  clientId: string,
  platform: ResearchPlatform,
  query?: string
): Promise<AccountSuggestion[]> {
  const admin = createSupabaseAdmin();
  const { clientName, profile } = await getResearchProfile(clientId);
  const { data: tracked } = await admin
    .from('competitor_accounts')
    .select('handle')
    .eq('client_id', clientId)
    .eq('platform', platform);

  const raw = await suggestAccounts(clientName, profile, platform, (tracked ?? []).map(t => t.handle), query);

  const unverified = (r: (typeof raw)[number]): AccountSuggestion => ({
    platform,
    handle: r.handle,
    name: r.name,
    reason: r.reason,
    relationship: r.relationship,
    followers_count: null,
    profile_picture_url: null,
    verified: false,
  });

  if (platform !== 'instagram') return raw.map(unverified);

  const checked = await Promise.all(raw.map(r => lookupInstagramAccount(r.handle)));
  return raw.flatMap((r, i): AccountSuggestion[] => {
    const result = checked[i];
    if (result.status === 'not_found') return [];
    if (result.status === 'skipped') return [unverified(r)];
    return [{
      platform,
      handle: result.account.handle,
      name: result.account.display_name ?? r.name,
      reason: r.reason,
      relationship: r.relationship,
      followers_count: result.account.followers_count,
      profile_picture_url: result.account.profile_picture_url,
      verified: true,
    }];
  });
}
