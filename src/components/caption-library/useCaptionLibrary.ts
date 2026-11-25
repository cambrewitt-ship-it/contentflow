'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { authedFetchJson } from '@/lib/authedFetch'
import logger from '@/lib/logger'
import type { CaptionLibrary, CaptionLibraryResponse } from '@/lib/captionLibrary'

// One shared copy of each client's caption library, so every caption box on the page
// reads the same data and sees saves from the manager straight away.

interface Entry {
  data: CaptionLibraryResponse | null
  loading: boolean
  error: string | null
  /** When the last load finished, to refresh stale data on the next mount */
  loadedAt: number
}

const STALE_MS = 2 * 60 * 1000
const EMPTY_ENTRY: Entry = { data: null, loading: false, error: null, loadedAt: 0 }

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
const inflight = new Map<string, Promise<void>>()

function setEntry(clientId: string, patch: Partial<Entry>) {
  entries.set(clientId, { ...(entries.get(clientId) ?? EMPTY_ENTRY), ...patch })
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function loadCaptionLibrary(clientId: string, force = false): Promise<void> {
  const current = entries.get(clientId)
  if (!force && current?.data && Date.now() - current.loadedAt < STALE_MS) return Promise.resolve()
  const pending = inflight.get(clientId)
  if (pending) return pending

  setEntry(clientId, { loading: true, error: null })
  const promise = authedFetchJson<CaptionLibraryResponse>(`/api/clients/${clientId}/caption-library`)
    .then((data) => {
      setEntry(clientId, {
        data: {
          accounts: data.accounts ?? [],
          hashtagSets: data.hashtagSets ?? [],
          usedHandles: data.usedHandles ?? [],
          usedHashtags: data.usedHashtags ?? [],
          externalImport: data.externalImport ?? null,
          setupRequired: data.setupRequired,
        },
        loading: false,
        loadedAt: Date.now(),
      })
    })
    .catch((err: unknown) => {
      logger.error('Caption library load error:', err)
      setEntry(clientId, { loading: false, error: err instanceof Error ? err.message : 'Failed to load' })
    })
    .finally(() => inflight.delete(clientId))
  inflight.set(clientId, promise)
  return promise
}

export function useCaptionLibrary(clientId: string | null | undefined) {
  const entry = useSyncExternalStore(
    subscribe,
    () => (clientId ? entries.get(clientId) ?? EMPTY_ENTRY : EMPTY_ENTRY),
    () => EMPTY_ENTRY
  )

  useEffect(() => {
    if (clientId) void loadCaptionLibrary(clientId)
  }, [clientId])

  /**
   * Save accounts + hashtag sets. `removedHandles` are handles of accounts the user
   * deleted, so they aren't auto-imported again. Throws with a readable message on failure.
   */
  const save = useCallback(
    async (library: CaptionLibrary, removedHandles: string[] = []) => {
      if (!clientId) return
      const res = await authedFetchJson<{ library: CaptionLibrary }>(`/api/clients/${clientId}/caption-library`, {
        method: 'PUT',
        body: { library, removedHandles },
      })
      const current = entries.get(clientId)?.data
      setEntry(clientId, {
        data: {
          usedHandles: [],
          usedHashtags: [],
          ...current,
          ...res.library,
          setupRequired: undefined,
        },
      })
    },
    [clientId]
  )

  return { ...entry, save, reload: () => (clientId ? loadCaptionLibrary(clientId, true) : Promise.resolve()) }
}

export async function suggestHashtags(clientId: string, caption: string): Promise<string[]> {
  const res = await authedFetchJson<{ hashtags: string[] }>(
    `/api/clients/${clientId}/caption-library/suggest-hashtags`,
    { method: 'POST', body: { caption }, timeoutMs: 60_000 }
  )
  return res.hashtags ?? []
}

export interface InstagramSearchResult {
  handle: string
  name: string | null
  profilePictureUrl: string | null
  followers: number | null
  verified: boolean
  isPrivate: boolean
  facebookName: string | null
  source: 'exact' | 'search'
}

// Remembered for the page session, so re-opening the menu doesn't search (and bill) again
const searchCache = new Map<string, InstagramSearchResult[]>()

export function cachedInstagramSearch(query: string): InstagramSearchResult[] | undefined {
  return searchCache.get(query.trim().toLowerCase())
}

export async function searchInstagramAccounts(clientId: string, query: string): Promise<InstagramSearchResult[]> {
  const key = query.trim().toLowerCase()
  const hit = searchCache.get(key)
  if (hit) return hit
  const res = await authedFetchJson<{ results: InstagramSearchResult[] }>(
    `/api/clients/${clientId}/caption-library/search-accounts?q=${encodeURIComponent(query.trim())}`,
    { timeoutMs: 65_000 }
  )
  const results = res.results ?? []
  searchCache.set(key, results)
  return results
}
