import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { fetchBrandContext, getRecentPosts } from '@/lib/autopilot-agent/context';
import { accountStats, rankPosts } from './analyze';
import { fetchInstagramAccount, instagramResearchConfigured } from './instagram';
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

// Only posts from this window count, so the research reflects what's working now
const POST_WINDOW_DAYS = 90;
const TOP_POSTS = 16;

// A run that's been "running" this long died with its function invocation.
export const STALE_RUN_MS = 10 * 60 * 1000;

export function researchConfig() {
  return {
    instagram: instagramResearchConfigured(),
    tiktok: tiktokResearchConfigured(),
    trends: !!process.env.OPENAI_API_KEY,
  };
}

async function setProgress(reportId: string, progress: string) {
  const admin = createSupabaseAdmin();
  await admin.from('competitor_research_reports').update({ progress }).eq('id', reportId);
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

    const snapshots: AccountSnapshot[] = [];

    if (config.instagram) {
      const results = await Promise.allSettled(igAccounts.map(a => fetchInstagramAccount(a.handle, 25)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') snapshots.push(r.value);
        else warnings.push(r.reason instanceof Error ? r.reason.message : `Couldn't load @${igAccounts[i].handle}`);
      });
    }

    if (config.tiktok && ttAccounts.length) {
      try {
        const tt = await fetchTikTokAccounts(ttAccounts.map(a => a.handle), 20);
        snapshots.push(...tt);
        const found = new Set(tt.map(s => s.handle));
        for (const a of ttAccounts) {
          if (!found.has(a.handle)) warnings.push(`No TikTok videos found for @${a.handle} (check the handle, or the account may be private).`);
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'TikTok fetch failed');
      }
    }

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
    for (const s of snapshots) {
      s.posts = s.posts.filter(p => !p.posted_at || Date.parse(p.posted_at) >= cutoff);
    }
    const withPosts = snapshots.filter(s => s.posts.length > 0);
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
      tokens,
    });
  } catch (err) {
    logger.error('Competitor research run failed', { reportId, error: err instanceof Error ? err.message : String(err) });
    await admin
      .from('competitor_research_reports')
      .update({
        status: 'failed',
        progress: null,
        warnings,
        error: err instanceof Error ? err.message : 'Research failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
  }
}

/**
 * Find accounts in the client's niche via web search. Instagram suggestions
 * are checked against Business Discovery so only real, reachable accounts are
 * returned; TikTok handles can't be checked cheaply and come back unverified.
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

  if (platform === 'instagram' && instagramResearchConfigured()) {
    const checked = await Promise.allSettled(raw.map(r => fetchInstagramAccount(r.handle, 0)));
    return raw.flatMap((r, i) => {
      const result = checked[i];
      if (result.status !== 'fulfilled') return [];
      return [{
        platform,
        handle: result.value.handle,
        name: result.value.display_name ?? r.name,
        reason: r.reason,
        relationship: r.relationship,
        followers_count: result.value.followers_count,
        profile_picture_url: result.value.profile_picture_url,
        verified: true,
      }];
    });
  }

  return raw.map(r => ({
    platform,
    handle: r.handle,
    name: r.name,
    reason: r.reason,
    relationship: r.relationship,
    followers_count: null,
    profile_picture_url: null,
    verified: false,
  }));
}
