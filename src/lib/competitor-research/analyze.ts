import type { AccountSnapshot, AccountStats, RankedPost, SocialPost } from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function interactions(p: SocialPost): number {
  return p.likes + p.comments + (p.shares ?? 0) + (p.saves ?? 0);
}

// Instagram: interactions / followers. TikTok: interactions / views, since
// reach there isn't tied to follower count.
function engagementRate(p: SocialPost, followers: number | null): number | null {
  if (p.platform === 'tiktok' && p.views) return interactions(p) / p.views;
  if (followers && followers > 0) return interactions(p) / followers;
  return null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function topKeys(counts: Map<string, number>, n: number): string[] {
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export function accountStats(account: AccountSnapshot): AccountStats {
  const posts = account.posts;
  const n = posts.length || 1;

  const formatMix: Record<string, number> = {};
  const hashtagCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  let words = 0;
  let hashtags = 0;
  let withEmoji = 0;
  let withQuestion = 0;

  for (const p of posts) {
    formatMix[p.format] = (formatMix[p.format] ?? 0) + 1;
    words += p.caption.split(/\s+/).filter(w => w && !w.startsWith('#')).length;
    hashtags += p.hashtags.length;
    if (EMOJI_RE.test(p.caption)) withEmoji++;
    if (p.caption.includes('?')) withQuestion++;
    for (const h of p.hashtags) hashtagCounts.set(h, (hashtagCounts.get(h) ?? 0) + 1);
    if (p.posted_at) {
      const day = DAY_NAMES[new Date(p.posted_at).getUTCDay()];
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }

  const times = posts.map(p => (p.posted_at ? Date.parse(p.posted_at) : NaN)).filter(t => !Number.isNaN(t));
  let postsPerWeek: number | null = null;
  if (times.length >= 2) {
    const spanWeeks = (Math.max(...times) - Math.min(...times)) / (7 * 24 * 3600 * 1000);
    if (spanWeeks > 0) postsPerWeek = round(times.length / spanWeeks, 1);
  }

  const rates = posts.map(p => engagementRate(p, account.followers_count)).filter((r): r is number => r !== null);

  return {
    platform: account.platform,
    handle: account.handle,
    followers: account.followers_count,
    posts_sampled: posts.length,
    posts_per_week: postsPerWeek,
    avg_engagement_rate: rates.length ? round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null,
    format_mix: formatMix,
    avg_caption_words: Math.round(words / n),
    avg_hashtags: round(hashtags / n, 1),
    emoji_share: round(withEmoji / n),
    question_share: round(withQuestion / n),
    top_hashtags: topKeys(hashtagCounts, 8),
    top_days: topKeys(dayCounts, 3),
  };
}

/**
 * Rank every post by how far it outperformed its own account's median, then
 * return the top `limit`, at most `perAccount` from any one account so a
 * single big account doesn't fill the list.
 */
export function rankPosts(accounts: AccountSnapshot[], limit: number, perAccount = 4): RankedPost[] {
  const ranked: RankedPost[] = [];
  for (const account of accounts) {
    const scored = account.posts.map(p => ({ p, score: interactions(p) }));
    const med = median(scored.map(s => s.score)) || 1;
    for (const { p, score } of scored) {
      const rate = engagementRate(p, account.followers_count);
      ranked.push({
        ...p,
        ref: '',
        engagement_rate: rate === null ? null : round(rate * 100),
        relative_score: round(score / med),
      });
    }
  }

  ranked.sort((a, b) => b.relative_score - a.relative_score || (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));

  const perAccountCount = new Map<string, number>();
  const picked: RankedPost[] = [];
  for (const post of ranked) {
    const key = `${post.platform}:${post.handle}`;
    const count = perAccountCount.get(key) ?? 0;
    if (count >= perAccount) continue;
    perAccountCount.set(key, count + 1);
    picked.push({ ...post, ref: `P${picked.length + 1}` });
    if (picked.length >= limit) break;
  }
  return picked;
}
