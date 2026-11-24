import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import type { AccountSnapshot, ResearchPlatform } from './types';

// Public posts and profile data per account, shared by every client that
// tracks it: when ten clients follow the same competitor, it's fetched once a
// day rather than ten times. Only full fetches (with posts) are cached.

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCachedSnapshots(
  platform: ResearchPlatform,
  handles: string[],
  maxAgeMs = CACHE_TTL_MS
): Promise<Map<string, AccountSnapshot>> {
  const found = new Map<string, AccountSnapshot>();
  if (handles.length === 0) return found;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('competitor_account_cache')
    .select('handle, snapshot')
    .eq('platform', platform)
    .in('handle', handles)
    .gte('fetched_at', new Date(Date.now() - maxAgeMs).toISOString());
  if (error) {
    logger.warn('Competitor cache read failed', error);
    return found;
  }
  for (const row of data ?? []) found.set(row.handle, row.snapshot as AccountSnapshot);
  return found;
}

export async function saveSnapshots(snapshots: AccountSnapshot[]) {
  if (snapshots.length === 0) return;
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await admin.from('competitor_account_cache').upsert(
    snapshots.map(s => ({ platform: s.platform, handle: s.handle, snapshot: s, fetched_at: now }))
  );
  if (error) logger.warn('Competitor cache write failed', error);
}
