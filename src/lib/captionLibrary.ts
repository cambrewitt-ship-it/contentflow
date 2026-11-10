import { z } from 'zod'

// A client's caption library: the accounts they tag and the hashtags they use, for the
// @ and # autocomplete in caption boxes. Shared by the browser and the API.
//
// Neither Meta nor Zernio (LATE) lets us search Instagram/Facebook users or hashtags,
// so suggestions come from this library plus the client's own past captions.
//
// Captions stay plain text: picking an account inserts "@instagramhandle", which
// Instagram turns into a real tag. Facebook can't tag through the API, so when a post
// goes to Facebook those handles are swapped for the account's Facebook name
// (see facebookCaption).

export interface CaptionAccount {
  id: string
  /** Display name, e.g. "Joe's Coffee" */
  name: string
  /** Instagram handle without the @, e.g. "joescoffee" */
  instagram: string | null
  /** Facebook Page / profile name as it should read in a Facebook caption */
  facebook: string | null
}

export interface HashtagSet {
  id: string
  name: string
  /** Without the # */
  tags: string[]
}

export interface CaptionLibrary {
  accounts: CaptionAccount[]
  hashtagSets: HashtagSet[]
}

export interface UsageCount {
  value: string
  count: number
}

/** What GET /api/clients/[clientId]/caption-library returns. */
export interface CaptionLibraryResponse extends CaptionLibrary {
  /** @handles and #hashtags from the client's past captions, most used first. */
  usedHandles: UsageCount[]
  usedHashtags: UsageCount[]
  setupRequired?: string
}

export const EMPTY_CAPTION_LIBRARY: CaptionLibrary = { accounts: [], hashtagSets: [] }

export const CAPTION_LIBRARY_LIMITS = { accounts: 500, hashtagSets: 50, tagsPerSet: 30 }

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/
const HASHTAG_RE = /^[\p{L}\p{N}_]{1,100}$/u

/** "@Joe.Coffee " -> "joe.coffee" (Instagram handles are case-insensitive). */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\.+$/, '').toLowerCase()
}

/** "#Summer Vibes" -> "SummerVibes" (keeps the user's casing). */
export function normalizeHashtag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle)
}

export function isValidHashtag(tag: string): boolean {
  return HASHTAG_RE.test(tag)
}

const id = z.string().min(1).max(64)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null))

export const captionLibrarySchema = z.object({
  accounts: z
    .array(
      z
        .object({
          id,
          name: z.string().trim().min(1, 'Every account needs a name').max(120),
          instagram: optionalText(40)
            .transform((v) => (v ? normalizeHandle(v) : null))
            .refine((v) => v === null || isValidHandle(v), 'Instagram handles can only use letters, numbers, . and _'),
          facebook: optionalText(120),
        })
    )
    .max(CAPTION_LIBRARY_LIMITS.accounts),
  hashtagSets: z
    .array(
      z.object({
        id,
        name: z.string().trim().min(1, 'Every hashtag set needs a name').max(80),
        tags: z
          .array(z.string().transform(normalizeHashtag).refine(isValidHashtag, 'Hashtags can only use letters, numbers and _'))
          .max(CAPTION_LIBRARY_LIMITS.tagsPerSet),
      })
    )
    .max(CAPTION_LIBRARY_LIMITS.hashtagSets),
})

/** Tolerant read of a stored library (bad rows are dropped, not fatal). */
export function normalizeCaptionLibrary(raw: unknown): CaptionLibrary {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const accounts = Array.isArray(obj.accounts) ? obj.accounts : []
  const sets = Array.isArray(obj.hashtagSets) ? obj.hashtagSets : []
  const accountSchema = captionLibrarySchema.shape.accounts.element
  const setSchema = captionLibrarySchema.shape.hashtagSets.element
  return {
    accounts: accounts.flatMap((a) => {
      const r = accountSchema.safeParse(a)
      return r.success ? [r.data] : []
    }),
    hashtagSets: sets.flatMap((s) => {
      const r = setSchema.safeParse(s)
      return r.success ? [r.data] : []
    }),
  }
}

// "@handle" not preceded by a word character (so emails don't count). Handles can
// contain dots but not end with one ("@joe." at the end of a sentence is "joe").
const HANDLE_IN_TEXT_RE = /(^|[^\w@.])@([A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?)/g
const HASHTAG_IN_TEXT_RE = /(^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}_]{1,100})/gu

export function extractHandles(text: string): string[] {
  return Array.from(text.matchAll(HANDLE_IN_TEXT_RE), (m) => m[2].toLowerCase())
}

export function extractHashtags(text: string): string[] {
  // Pure numbers ("#1") aren't hashtags on Instagram
  return Array.from(text.matchAll(HASHTAG_IN_TEXT_RE), (m) => m[2]).filter((t) => !/^\d+$/.test(t))
}

/** Count handles and hashtags across captions, most used first. Hashtags group case-insensitively. */
export function countUsage(captions: string[]): { usedHandles: UsageCount[]; usedHashtags: UsageCount[] } {
  const handles = new Map<string, number>()
  const tags = new Map<string, { value: string; count: number }>()
  for (const caption of captions) {
    for (const h of new Set(extractHandles(caption))) handles.set(h, (handles.get(h) ?? 0) + 1)
    for (const t of extractHashtags(caption)) {
      const key = t.toLowerCase()
      const entry = tags.get(key)
      if (entry) entry.count += 1
      else tags.set(key, { value: t, count: 1 })
    }
  }
  const sort = (a: UsageCount, b: UsageCount) => b.count - a.count || a.value.localeCompare(b.value)
  return {
    usedHandles: Array.from(handles, ([value, count]) => ({ value, count })).sort(sort),
    usedHashtags: Array.from(tags.values()).sort(sort),
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The caption as it should read on Facebook: each "@instagramhandle" of a saved
 * account becomes that account's Facebook name (or display name), since Facebook
 * posts made through the API can't tag and "@handle" would just be plain text there.
 */
export function facebookCaption(caption: string, accounts: CaptionAccount[]): string {
  let out = caption
  const withHandles = accounts
    .filter((a) => a.instagram)
    .sort((a, b) => (b.instagram as string).length - (a.instagram as string).length)
  for (const account of withHandles) {
    const re = new RegExp(`(^|[^\\w@.])@${escapeRe(account.instagram as string)}(?![A-Za-z0-9_]|\\.[A-Za-z0-9_])`, 'gi')
    const replacement = account.facebook || account.name
    out = out.replace(re, (_m, pre: string) => `${pre}${replacement}`)
  }
  return out
}

/** Text inserted into a caption when an account is picked from the @ menu. */
export function accountInsertText(account: Pick<CaptionAccount, 'name' | 'instagram' | 'facebook'>): string {
  return account.instagram ? `@${account.instagram}` : account.facebook || account.name
}
