import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

// Every client's Instagram research goes through one Meta token, so its rate
// limit is shared across all of ContentFlow. Meta reports how much of the
// limit is used on each response; we keep the latest reading in
// research_api_usage and queue new work before the limit is hit instead of
// failing halfway through a run.

const PROVIDER = 'instagram';

// Stop starting new Instagram work at this share of the limit
export const PAUSE_AT_PCT = 80;
// Meta's limits are rolling windows of about an hour
const WINDOW_MS = 60 * 60 * 1000;

interface UsageEntry {
  call_count?: number;
  total_cputime?: number;
  total_time?: number;
  estimated_time_to_regain_access?: number;
}

/**
 * Highest usage percentage across Meta's usage headers, and how many minutes
 * until access is regained when Meta says it's throttling.
 */
export function parseUsageHeaders(headers: Headers): { pct: number; regainMinutes: number } | null {
  const entries: UsageEntry[] = [];
  const read = (name: string) => {
    const raw = headers.get(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };

  // {"<business-id>": [{type, call_count, total_cputime, total_time, estimated_time_to_regain_access}]}
  const buc = read('x-business-use-case-usage');
  if (buc && typeof buc === 'object') {
    for (const list of Object.values(buc as Record<string, unknown>)) {
      if (Array.isArray(list)) entries.push(...(list as UsageEntry[]));
    }
  }
  // {call_count, total_cputime, total_time}
  for (const name of ['x-app-usage', 'x-ad-account-usage']) {
    const v = read(name);
    if (v && typeof v === 'object' && !Array.isArray(v)) entries.push(v as UsageEntry);
  }

  if (entries.length === 0) return null;
  let pct = 0;
  let regainMinutes = 0;
  for (const e of entries) {
    pct = Math.max(pct, e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0);
    regainMinutes = Math.max(regainMinutes, e.estimated_time_to_regain_access ?? 0);
  }
  return { pct: Math.round(pct), regainMinutes };
}

export async function recordUsage(pct: number, regainAt: Date | null) {
  try {
    const admin = createSupabaseAdmin();
    await admin.from('research_api_usage').upsert({
      provider: PROVIDER,
      usage_pct: Math.min(100, Math.max(0, pct)),
      regain_at: regainAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to record Instagram API usage', err);
  }
}

export async function recordFromHeaders(headers: Headers) {
  const usage = parseUsageHeaders(headers);
  if (!usage) return;
  const regainAt = usage.regainMinutes > 0 ? new Date(Date.now() + usage.regainMinutes * 60_000) : null;
  await recordUsage(usage.pct, regainAt);
}

export async function recordRateLimited(regainMinutes = 60) {
  await recordUsage(100, new Date(Date.now() + Math.max(regainMinutes, 15) * 60_000));
}

export interface Budget {
  available: boolean;
  // When to try again if not available
  resumeAt: Date | null;
  usagePct: number;
}

export async function getInstagramBudget(): Promise<Budget> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('research_api_usage')
    .select('usage_pct, regain_at, updated_at')
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (!data) return { available: true, resumeAt: null, usagePct: 0 };

  const now = Date.now();
  const regainAt = data.regain_at ? Date.parse(data.regain_at) : null;
  if (regainAt && regainAt > now) {
    return { available: false, resumeAt: new Date(regainAt), usagePct: data.usage_pct };
  }

  const updatedAt = Date.parse(data.updated_at);
  if (data.usage_pct >= PAUSE_AT_PCT && now - updatedAt < WINDOW_MS) {
    return { available: false, resumeAt: new Date(updatedAt + WINDOW_MS), usagePct: data.usage_pct };
  }
  // Older readings have rolled out of the window
  return { available: true, resumeAt: null, usagePct: now - updatedAt < WINDOW_MS ? data.usage_pct : 0 };
}
