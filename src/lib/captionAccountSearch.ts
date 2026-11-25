import logger from '@/lib/logger';
import { isValidHandle, normalizeHandle } from '@/lib/captionLibrary';
import { lookupInstagramAccount } from '@/lib/competitor-research/run';

// Instagram account search for the @ menu in caption boxes.
//
// Meta has no user search, so two sources are combined:
// - Apify's Instagram Search Scraper (APIFY_API_TOKEN) — finds accounts by name or
//   partial handle, including personal accounts. Billed per result on the Apify account,
//   takes a few seconds, so it only runs when someone asks for it (not per keystroke).
// - Business Discovery (the Competitor Research IG account) — an exact-handle check,
//   used when the query looks like a full handle. Business/Creator accounts only.

const ACTOR = process.env.APIFY_INSTAGRAM_SEARCH_ACTOR || 'apify~instagram-search-scraper';
const RESULT_LIMIT = 8;
const CACHE_MS = 24 * 60 * 60 * 1000;

export interface InstagramAccountResult {
  handle: string;
  name: string | null;
  profilePictureUrl: string | null;
  followers: number | null;
  verified: boolean;
  isPrivate: boolean;
  /** The linked Facebook Page's name, when Apify found one (used for Facebook captions) */
  facebookName: string | null;
  /** Where it came from: 'exact' = checked against Instagram by handle */
  source: 'exact' | 'search';
}

export function accountSearchConfigured(): { search: boolean } {
  return { search: !!process.env.APIFY_API_TOKEN };
}

// Per-instance cache: the same name is often searched again from another caption box
const cache = new Map<string, { at: number; results: InstagramAccountResult[] }>();

interface ApifySearchItem {
  username?: string;
  fullName?: string;
  full_name?: string;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  followersCount?: number;
  verified?: boolean;
  isVerified?: boolean;
  private?: boolean;
  isPrivate?: boolean;
  facebookPage?: { name?: string; page_is_deleted?: boolean } | null;
  error?: string;
}

async function apifySearch(query: string): Promise<InstagramAccountResult[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return [];

  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=90`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // A comma would make Apify search several terms
    // enhanceUserSearchWithFacebookPage: also look up each result's linked Facebook Page, so the
    // Facebook version of a caption can use the Page's real name (Facebook can't tag via the API)
    body: JSON.stringify({
      search: query.replace(/,/g, ' '),
      searchType: 'user',
      searchLimit: RESULT_LIMIT,
      enhanceUserSearchWithFacebookPage: true,
    }),
    signal: AbortSignal.timeout(95_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('Apify Instagram search failed', { status: res.status, body: text.slice(0, 300) });
    throw new Error(res.status === 402 ? 'The Apify account is out of credit.' : `Instagram search failed (${res.status})`);
  }

  const items = (await res.json().catch(() => [])) as ApifySearchItem[];
  const out: InstagramAccountResult[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    const handle = normalizeHandle(item.username ?? '');
    if (!handle || !isValidHandle(handle) || item.error) continue;
    out.push({
      handle,
      name: item.fullName || item.full_name || null,
      profilePictureUrl: item.profilePicUrl || item.profilePicUrlHD || null,
      followers: typeof item.followersCount === 'number' ? item.followersCount : null,
      verified: !!(item.verified ?? item.isVerified),
      isPrivate: !!(item.private ?? item.isPrivate),
      facebookName: (!item.facebookPage?.page_is_deleted && item.facebookPage?.name?.trim()) || null,
      source: 'search',
    });
  }
  return out;
}

async function exactLookup(handle: string): Promise<InstagramAccountResult | null> {
  const result = await lookupInstagramAccount(handle).catch(() => ({ status: 'skipped' as const }));
  if (result.status !== 'found') return null;
  const a = result.account;
  return {
    handle: a.handle,
    name: a.display_name,
    profilePictureUrl: a.profile_picture_url,
    followers: a.followers_count,
    verified: false,
    isPrivate: false,
    facebookName: null,
    source: 'exact',
  };
}

/**
 * Accounts matching a name or handle. The exact-handle match (when there is one) comes
 * first, then search results. Throws only when every source failed.
 */
export async function searchInstagramAccounts(rawQuery: string): Promise<InstagramAccountResult[]> {
  const query = rawQuery.trim().replace(/^@+/, '').slice(0, 60);
  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  const handle = normalizeHandle(query);
  const [exact, search] = await Promise.allSettled([
    isValidHandle(handle) ? exactLookup(handle) : Promise.resolve(null),
    apifySearch(query),
  ]);

  if (search.status === 'rejected' && (exact.status === 'rejected' || !exact.value)) {
    throw search.reason instanceof Error ? search.reason : new Error('Instagram search failed');
  }

  const results: InstagramAccountResult[] = [];
  const exactValue = exact.status === 'fulfilled' ? exact.value : null;
  for (const r of [...(exactValue ? [exactValue] : []), ...(search.status === 'fulfilled' ? search.value : [])]) {
    const existing = results.find((x) => x.handle === r.handle);
    if (existing) {
      // Fill gaps in the exact match from the search result (verified badge, picture)
      existing.verified ||= r.verified;
      existing.profilePictureUrl ||= r.profilePictureUrl;
      existing.facebookName ||= r.facebookName;
      continue;
    }
    results.push(r);
  }

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), results });
  return results;
}
