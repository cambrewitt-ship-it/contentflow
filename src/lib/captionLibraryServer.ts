import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import {
  CAPTION_LIBRARY_LIMITS,
  countUsage,
  facebookCaption,
  normalizeCaptionLibrary,
  type CaptionAccount,
  type CaptionLibrary,
  type CaptionLibraryResponse,
  type ExternalImportStatus,
  type UsageCount,
} from '@/lib/captionLibrary'

export const CAPTION_LIBRARY_SETUP_MESSAGE =
  'Saving accounts and hashtag sets needs a one-off database update (migrations/032-caption-library.sql).'

// Postgres "relation does not exist" — migration 032 hasn't been run yet
export const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01'
// Postgres "column does not exist" — migration 033 hasn't been run yet
const isMissingColumn = (error: { code?: string } | null) => error?.code === '42703'

const TABLE = 'client_caption_libraries'

// How many recent captions to scan for handles and hashtags, per calendar table
const HISTORY_LIMIT = 500
// Instagram posts made outside the app are re-read from Zernio at most this often
const EXTERNAL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000
const EXTERNAL_PAGE_SIZE = 100
const EXTERNAL_MAX_PAGES = 10
const EXTERNAL_REQUEST_TIMEOUT_MS = 15_000
const STORED_USAGE_LIMIT = 500

export async function loadCaptionLibrary(
  admin: SupabaseClient,
  clientId: string
): Promise<{ library: CaptionLibrary; saved: boolean; missingTable: boolean }> {
  const { data, error } = await admin
    .from(TABLE)
    .select('accounts, hashtag_sets')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) {
    if (!isMissingTable(error)) logger.error('Load caption library error:', error)
    return { library: { accounts: [], hashtagSets: [] }, saved: false, missingTable: isMissingTable(error) }
  }
  return {
    library: normalizeCaptionLibrary({ accounts: data?.accounts, hashtagSets: data?.hashtag_sets }),
    saved: !!data,
    missingTable: false,
  }
}

// ---------------------------------------------------------------------------
// The stored row, including the auto-import columns from migration 033
// ---------------------------------------------------------------------------

interface ExternalUsage {
  status: ExternalImportStatus
  postCount: number
  handles: UsageCount[]
  hashtags: UsageCount[]
}

interface LibraryRow {
  exists: boolean
  library: CaptionLibrary
  updatedAt: string | null
  /** False until migration 033 has been run */
  autoImport: boolean
  dismissed: string[]
  external: ExternalUsage | null
  externalSyncedAt: string | null
}

type RowResult = { missingTable: true } | ({ missingTable: false } & LibraryRow)

const asUsage = (raw: unknown): UsageCount[] =>
  Array.isArray(raw)
    ? raw.filter(
        (u): u is UsageCount => !!u && typeof u.value === 'string' && typeof u.count === 'number'
      )
    : []

function asExternal(raw: unknown): ExternalUsage | null {
  if (!raw || typeof raw !== 'object' || !('status' in raw)) return null
  const r = raw as Record<string, unknown>
  return {
    status: (r.status as ExternalImportStatus) ?? 'failed',
    postCount: typeof r.postCount === 'number' ? r.postCount : 0,
    handles: asUsage(r.handles),
    hashtags: asUsage(r.hashtags),
  }
}

async function readRow(admin: SupabaseClient, clientId: string): Promise<RowResult> {
  const full = await admin
    .from(TABLE)
    .select('accounts, hashtag_sets, updated_at, dismissed_handles, external_usage, external_synced_at')
    .eq('client_id', clientId)
    .maybeSingle()
  if (isMissingTable(full.error)) return { missingTable: true }

  let data = full.data as Record<string, unknown> | null
  let autoImport = true
  if (full.error) {
    if (!isMissingColumn(full.error)) throw full.error
    autoImport = false
    const legacy = await admin
      .from(TABLE)
      .select('accounts, hashtag_sets, updated_at')
      .eq('client_id', clientId)
      .maybeSingle()
    if (legacy.error) throw legacy.error
    data = legacy.data as Record<string, unknown> | null
  }

  return {
    missingTable: false,
    exists: !!data,
    library: normalizeCaptionLibrary({ accounts: data?.accounts, hashtagSets: data?.hashtag_sets }),
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    autoImport,
    dismissed: Array.isArray(data?.dismissed_handles)
      ? (data.dismissed_handles as unknown[]).filter((h): h is string => typeof h === 'string')
      : [],
    external: asExternal(data?.external_usage),
    externalSyncedAt: (data?.external_synced_at as string | undefined) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Usage from past captions
// ---------------------------------------------------------------------------

async function calendarCaptions(admin: SupabaseClient, clientId: string): Promise<string[]> {
  const tables = ['calendar_scheduled_posts', 'calendar_unscheduled_posts'] as const
  const results = await Promise.all(
    tables.map((table) =>
      admin
        .from(table)
        .select('caption')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
    )
  )
  const captions: string[] = []
  results.forEach(({ data, error }, i) => {
    if (error) {
      logger.error(`Caption history read failed (${tables[i]}):`, error)
      return
    }
    for (const row of data ?? []) {
      if (typeof row.caption === 'string' && row.caption) captions.push(row.caption)
    }
  })
  return captions
}

function mergeUsage(...lists: UsageCount[][]): UsageCount[] {
  const merged = new Map<string, UsageCount>()
  for (const list of lists) {
    for (const u of list) {
      const key = u.value.toLowerCase()
      const entry = merged.get(key)
      if (entry) entry.count += u.count
      else merged.set(key, { ...u })
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/** Saved accounts plus any used handle that isn't saved or dismissed yet. */
function withAutoAddedAccounts(
  accounts: CaptionAccount[],
  usedHandles: UsageCount[],
  dismissed: string[]
): { accounts: CaptionAccount[]; added: number } {
  const known = new Set([...accounts.map((a) => a.instagram).filter(Boolean), ...dismissed])
  const room = CAPTION_LIBRARY_LIMITS.accounts - accounts.length
  const additions = usedHandles
    .filter((h) => !known.has(h.value))
    .slice(0, Math.max(0, room))
    .map((h) => ({ id: crypto.randomUUID(), name: h.value, instagram: h.value, facebook: null }))
  return { accounts: additions.length ? [...accounts, ...additions] : accounts, added: additions.length }
}

/**
 * Write auto-import results without clobbering a save made in the meantime: an
 * existing row is only updated if it hasn't changed since it was read.
 */
async function writeAutoImport(
  admin: SupabaseClient,
  clientId: string,
  row: LibraryRow,
  patch: Record<string, unknown>
): Promise<boolean> {
  const values = { ...patch, updated_at: new Date().toISOString() }
  if (!row.exists) {
    const { error } = await admin
      .from(TABLE)
      .upsert({ client_id: clientId, ...values }, { onConflict: 'client_id', ignoreDuplicates: true })
    if (error) logger.error('Caption library auto-import insert failed:', error)
    return !error
  }
  let query = admin.from(TABLE).update(values).eq('client_id', clientId)
  if (row.updatedAt) query = query.eq('updated_at', row.updatedAt)
  const { error } = await query
  if (error) logger.error('Caption library auto-import update failed:', error)
  return !error
}

// ---------------------------------------------------------------------------
// Instagram posts made outside the app, read from Zernio (LATE) analytics
// ---------------------------------------------------------------------------

async function fetchExternalCaptions(
  profileId: string
): Promise<{ status: ExternalImportStatus; captions: string[] }> {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) return { status: 'failed', captions: [] }

  const toDate = new Date()
  const fromDate = new Date(toDate.getTime() - 365 * 24 * 60 * 60 * 1000)
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const captions: string[] = []

  for (let page = 1; page <= EXTERNAL_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      profileId,
      platform: 'instagram',
      source: 'external',
      fromDate: day(fromDate),
      toDate: day(toDate),
      sortBy: 'date',
      order: 'desc',
      limit: String(EXTERNAL_PAGE_SIZE),
      page: String(page),
    })
    let res: Response
    try {
      res = await fetch(`https://getlate.dev/api/v1/analytics?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      logger.error('Zernio analytics request failed:', error)
      return { status: captions.length ? 'ok' : 'failed', captions }
    }

    // 402: the Zernio plan doesn't include analytics
    if (res.status === 402 || res.status === 403) return { status: 'unavailable', captions: [] }
    if (!res.ok) {
      logger.error('Zernio analytics error:', { status: res.status, body: await res.text().catch(() => '') })
      return { status: captions.length ? 'ok' : 'failed', captions }
    }

    const data = (await res.json().catch(() => null)) as {
      posts?: Array<{ content?: unknown }>
      pagination?: { total?: number }
    } | null
    const posts = Array.isArray(data?.posts) ? data.posts : []
    for (const p of posts) if (typeof p.content === 'string' && p.content) captions.push(p.content)

    const total = data?.pagination?.total
    if (posts.length < EXTERNAL_PAGE_SIZE || (typeof total === 'number' && page * EXTERNAL_PAGE_SIZE >= total)) break
  }
  return { status: 'ok', captions }
}

/**
 * Re-read the client's Instagram posts made outside the app from Zernio, store their
 * handle/hashtag counts and save any new handles as accounts. Runs at most daily.
 */
export async function syncExternalCaptionUsage(admin: SupabaseClient, clientId: string): Promise<void> {
  try {
    const row = await readRow(admin, clientId)
    if (row.missingTable || !row.autoImport) return
    if (row.externalSyncedAt && Date.now() - Date.parse(row.externalSyncedAt) < EXTERNAL_SYNC_INTERVAL_MS) return

    const { data: client } = await admin.from('clients').select('late_profile_id').eq('id', clientId).maybeSingle()
    const profileId = client?.late_profile_id as string | null | undefined

    let external: ExternalUsage
    if (!profileId) {
      external = { status: 'not_connected', postCount: 0, handles: [], hashtags: [] }
    } else {
      const { status, captions } = await fetchExternalCaptions(profileId)
      const usage = countUsage(captions)
      external = {
        status,
        postCount: captions.length,
        handles: usage.usedHandles.slice(0, STORED_USAGE_LIMIT),
        hashtags: usage.usedHashtags.slice(0, STORED_USAGE_LIMIT),
      }
    }

    // Read again: the library may have changed while Zernio was answering
    const latest = await readRow(admin, clientId)
    if (latest.missingTable) return
    const { accounts, added } = withAutoAddedAccounts(latest.library.accounts, external.handles, latest.dismissed)
    await writeAutoImport(admin, clientId, latest, {
      external_usage: external,
      external_synced_at: new Date().toISOString(),
      ...(added ? { accounts, hashtag_sets: latest.library.hashtagSets } : {}),
    })
  } catch (error) {
    logger.error('External caption sync failed:', error)
  }
}

// ---------------------------------------------------------------------------
// What the caption boxes and the manager read
// ---------------------------------------------------------------------------

export async function getCaptionLibraryForClient(
  admin: SupabaseClient,
  clientId: string
): Promise<{ response: CaptionLibraryResponse; needsExternalSync: boolean }> {
  const [rowResult, captions] = await Promise.all([readRow(admin, clientId), calendarCaptions(admin, clientId)])
  const calendar = countUsage(captions)

  if (rowResult.missingTable) {
    return {
      response: {
        accounts: [],
        hashtagSets: [],
        usedHandles: calendar.usedHandles.slice(0, 300),
        usedHashtags: calendar.usedHashtags.slice(0, 300),
        setupRequired: CAPTION_LIBRARY_SETUP_MESSAGE,
      },
      needsExternalSync: false,
    }
  }

  const row = rowResult
  const dismissed = new Set(row.dismissed)
  const usedHandles = mergeUsage(calendar.usedHandles, row.external?.handles ?? []).filter(
    (h) => !dismissed.has(h.value)
  )
  const usedHashtags = mergeUsage(calendar.usedHashtags, row.external?.hashtags ?? [])

  // Every handle used in a past caption is saved as an account automatically
  const { accounts, added } = withAutoAddedAccounts(row.library.accounts, usedHandles, row.dismissed)
  let library = row.library
  if (added && (await writeAutoImport(admin, clientId, row, { accounts, hashtag_sets: row.library.hashtagSets }))) {
    library = { ...row.library, accounts }
  }

  const needsExternalSync =
    row.autoImport &&
    (!row.externalSyncedAt || Date.now() - Date.parse(row.externalSyncedAt) >= EXTERNAL_SYNC_INTERVAL_MS)

  return {
    response: {
      ...library,
      usedHandles: usedHandles.slice(0, 300),
      usedHashtags: usedHashtags.slice(0, 300),
      externalImport: row.external
        ? { status: row.external.status, postCount: row.external.postCount, syncedAt: row.externalSyncedAt }
        : null,
    },
    needsExternalSync,
  }
}

/**
 * Save the library from the manager. Handles of accounts the user deleted are
 * remembered so auto-import doesn't add them back; re-adding one un-dismisses it.
 */
export async function saveCaptionLibrary(
  admin: SupabaseClient,
  clientId: string,
  userId: string,
  library: CaptionLibrary,
  removedHandles: string[]
): Promise<{ error: { code?: string; message?: string } | null }> {
  const row = await readRow(admin, clientId)
  if (row.missingTable) return { error: { code: '42P01' } }

  const values: Record<string, unknown> = {
    client_id: clientId,
    accounts: library.accounts,
    hashtag_sets: library.hashtagSets,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  if (row.autoImport) {
    const kept = new Set(library.accounts.map((a) => a.instagram).filter(Boolean))
    values.dismissed_handles = Array.from(new Set([...row.dismissed, ...removedHandles])).filter((h) => !kept.has(h))
  }
  const { error } = await admin.from(TABLE).upsert(values)
  return { error }
}

/**
 * Zernio (LATE) platform entries with a Facebook-specific caption where saved
 * Instagram handles need swapping for Facebook names. Never throws: if the library
 * can't be read, the post goes out with the caption as written.
 */
export async function withFacebookCaptions<T extends { platform: string }>(
  admin: SupabaseClient,
  clientId: string,
  caption: string,
  platforms: T[]
): Promise<Array<T & { customContent?: string }>> {
  if (!platforms.some((p) => String(p.platform).toLowerCase() === 'facebook')) return platforms
  try {
    const { library } = await loadCaptionLibrary(admin, clientId)
    const fbCaption = facebookCaption(caption, library.accounts)
    if (fbCaption === caption) return platforms
    return platforms.map((p) =>
      String(p.platform).toLowerCase() === 'facebook' ? { ...p, customContent: fbCaption } : p
    )
  } catch (error) {
    logger.error('Facebook caption conversion failed:', error)
    return platforms
  }
}
