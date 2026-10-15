import logger from '@/lib/logger';
import { extractHashtags } from './instagram';
import type { AccountSnapshot, SocialPost } from './types';

// TikTok has no official API for reading other accounts' posts, so TikTok
// data comes from an Apify scraper actor (default: clockworks/tiktok-scraper),
// run synchronously and billed per result on the Apify account. Optional:
// TikTok is skipped when APIFY_API_TOKEN isn't set.

const ACTOR = process.env.APIFY_TIKTOK_ACTOR || 'clockworks~tiktok-scraper';

export function tiktokResearchConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN;
}

// Fields we read from the actor's dataset items
interface ApifyTikTokItem {
  id?: string;
  text?: string;
  createTimeISO?: string;
  webVideoUrl?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number;
  isSlideshow?: boolean;
  videoMeta?: { coverUrl?: string; originalCoverUrl?: string };
  musicMeta?: { musicName?: string; musicAuthor?: string; musicOriginal?: boolean };
  hashtags?: Array<{ name?: string }>;
  authorMeta?: {
    name?: string;
    nickName?: string;
    signature?: string;
    avatar?: string;
    fans?: number;
    video?: number;
  };
}

function toPost(item: ApifyTikTokItem, handle: string): SocialPost {
  const caption = item.text ?? '';
  const music = item.musicMeta;
  return {
    id: item.id ?? item.webVideoUrl ?? `${handle}-${item.createTimeISO}`,
    platform: 'tiktok',
    handle,
    url: item.webVideoUrl ?? null,
    caption,
    format: item.isSlideshow ? 'carousel' : 'video',
    image_url: item.videoMeta?.coverUrl ?? item.videoMeta?.originalCoverUrl ?? null,
    posted_at: item.createTimeISO ?? null,
    likes: item.diggCount ?? 0,
    comments: item.commentCount ?? 0,
    shares: item.shareCount ?? null,
    saves: item.collectCount ?? null,
    views: item.playCount ?? null,
    hashtags: item.hashtags?.length
      ? item.hashtags.map(h => (h.name ?? '').toLowerCase()).filter(Boolean)
      : extractHashtags(caption),
    sound: music?.musicName
      ? music.musicOriginal
        ? 'Original sound'
        : `${music.musicName}${music.musicAuthor ? ` — ${music.musicAuthor}` : ''}`
      : null,
  };
}

/**
 * Fetch recent videos for several TikTok profiles in one actor run.
 * Returns one snapshot per handle that came back with data.
 */
export async function fetchTikTokAccounts(handles: string[], postsPerAccount = 20): Promise<AccountSnapshot[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('TikTok research is not set up yet (missing APIFY_API_TOKEN).');
  if (handles.length === 0) return [];

  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=180`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profiles: handles,
      resultsPerPage: postsPerAccount,
      profileScrapeSections: ['videos'],
      profileSorting: 'latest',
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    }),
    signal: AbortSignal.timeout(200_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('Apify TikTok run failed', { status: res.status, body: text.slice(0, 300) });
    throw new Error(`TikTok fetch failed (${res.status})`);
  }

  const items = (await res.json()) as ApifyTikTokItem[];
  const byHandle = new Map<string, ApifyTikTokItem[]>();
  for (const item of Array.isArray(items) ? items : []) {
    const author = item.authorMeta?.name?.toLowerCase();
    if (!author) continue;
    if (!byHandle.has(author)) byHandle.set(author, []);
    byHandle.get(author)!.push(item);
  }

  return handles
    .filter(h => byHandle.has(h))
    .map(handle => {
      const accountItems = byHandle.get(handle)!;
      const author = accountItems[0].authorMeta;
      return {
        platform: 'tiktok' as const,
        handle,
        display_name: author?.nickName ?? null,
        bio: author?.signature ?? null,
        profile_picture_url: author?.avatar ?? null,
        followers_count: author?.fans ?? null,
        media_count: author?.video ?? null,
        posts: accountItems.map(item => toPost(item, handle)),
      };
    });
}
