import logger from '@/lib/logger';
import type { AccountSnapshot, SocialPost } from './types';

// Instagram competitor data comes from the Graph API's Business Discovery
// endpoint, queried through ContentFlow's own Instagram Business account
// (INSTAGRAM_RESEARCH_ACCOUNT_ID + a system-user token with instagram_basic
// and pages_read_engagement). Because the querying account and the Meta app
// are ours, this needs no App Review. It can only see Business and Creator
// accounts, and is rate limited per token (~200 calls/hour).

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

export function instagramResearchConfigured(): boolean {
  return !!(process.env.INSTAGRAM_RESEARCH_ACCOUNT_ID && process.env.INSTAGRAM_RESEARCH_ACCESS_TOKEN);
}

export class InstagramLookupError extends Error {
  constructor(message: string, readonly kind: 'not_found' | 'rate_limited' | 'config' | 'other') {
    super(message);
  }
}

interface GraphMedia {
  id: string;
  caption?: string;
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface GraphBusinessDiscovery {
  username: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  media?: { data: GraphMedia[] };
}

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

export function extractHashtags(text: string): string[] {
  return [...text.matchAll(HASHTAG_RE)].map(m => m[1].toLowerCase());
}

function formatOf(m: GraphMedia): string {
  if (m.media_product_type === 'REELS') return 'reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (m.media_type === 'VIDEO') return 'video';
  return 'image';
}

function toPost(handle: string, m: GraphMedia): SocialPost {
  const caption = m.caption ?? '';
  const isVideo = m.media_type === 'VIDEO';
  return {
    id: m.id,
    platform: 'instagram',
    handle,
    url: m.permalink ?? null,
    caption,
    format: formatOf(m),
    image_url: isVideo ? m.thumbnail_url ?? null : m.media_url ?? null,
    posted_at: m.timestamp ?? null,
    // like_count is omitted when the owner hides like counts
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    shares: null,
    saves: null,
    views: null,
    hashtags: extractHashtags(caption),
    sound: null,
  };
}

/**
 * Fetch a public Business/Creator account's profile and most recent posts.
 * mediaLimit 0 fetches the profile only (used to verify a handle).
 */
export async function fetchInstagramAccount(handle: string, mediaLimit = 25): Promise<AccountSnapshot> {
  const accountId = process.env.INSTAGRAM_RESEARCH_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_RESEARCH_ACCESS_TOKEN;
  if (!accountId || !token) {
    throw new InstagramLookupError('Instagram research is not set up yet (missing INSTAGRAM_RESEARCH_ACCOUNT_ID / INSTAGRAM_RESEARCH_ACCESS_TOKEN).', 'config');
  }

  const profileFields = 'username,name,biography,followers_count,media_count,profile_picture_url';
  const mediaFields =
    'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
  const fields =
    mediaLimit > 0
      ? `business_discovery.username(${handle}){${profileFields},media.limit(${mediaLimit}){${mediaFields}}}`
      : `business_discovery.username(${handle}){${profileFields}}`;

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}`);
  url.searchParams.set('fields', fields);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    business_discovery?: GraphBusinessDiscovery;
    error?: { message?: string; code?: number; error_subcode?: number };
  };

  if (!res.ok || body.error || !body.business_discovery) {
    const code = body.error?.code;
    const message = body.error?.message ?? `HTTP ${res.status}`;
    logger.warn('Instagram business discovery failed', { handle, code, message });
    if (code === 110 || /invalid user id|cannot be found|does not exist/i.test(message)) {
      throw new InstagramLookupError(
        `@${handle} wasn't found as an Instagram Business or Creator account (personal accounts can't be looked up).`,
        'not_found'
      );
    }
    if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80002) {
      throw new InstagramLookupError('Instagram rate limit reached — try again in an hour.', 'rate_limited');
    }
    if (code === 190 || code === 10 || code === 200) {
      throw new InstagramLookupError(`Instagram research token is invalid or missing permissions: ${message}`, 'config');
    }
    throw new InstagramLookupError(`Instagram lookup for @${handle} failed: ${message}`, 'other');
  }

  const bd = body.business_discovery;
  return {
    platform: 'instagram',
    handle: bd.username.toLowerCase(),
    display_name: bd.name ?? null,
    bio: bd.biography ?? null,
    profile_picture_url: bd.profile_picture_url ?? null,
    followers_count: bd.followers_count ?? null,
    media_count: bd.media_count ?? null,
    posts: (bd.media?.data ?? []).map(m => toPost(bd.username.toLowerCase(), m)),
  };
}
