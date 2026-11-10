'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, AtSign, Check, Hash, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CAPTION_LIBRARY_LIMITS,
  normalizeHashtag,
  normalizeHandle,
  isValidHashtag,
  type CaptionLibrary,
} from '@/lib/captionLibrary'
import { useCaptionLibrary } from './useCaptionLibrary'

// Edit a client's accounts to tag and hashtag sets — what the @ and # menus in caption
// boxes suggest, alongside handles and hashtags from the client's past captions.

interface DraftAccount {
  id: string
  name: string
  instagram: string
  facebook: string
}

interface DraftSet {
  id: string
  name: string
  tagsText: string
}

const toDraft = (lib: CaptionLibrary) => ({
  accounts: lib.accounts.map((a) => ({ id: a.id, name: a.name, instagram: a.instagram ?? '', facebook: a.facebook ?? '' })),
  sets: lib.hashtagSets.map((s) => ({ id: s.id, name: s.name, tagsText: s.tags.map((t) => `#${t}`).join(' ') })),
})

const parseTags = (text: string) => {
  const seen = new Set<string>()
  return text
    .split(/[\s,]+/)
    .map(normalizeHashtag)
    .filter((t) => {
      const key = t.toLowerCase()
      if (!isValidHashtag(t) || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function CaptionLibraryManager({ clientId, onSaved }: { clientId: string; onSaved?: () => void }) {
  const library = useCaptionLibrary(clientId)
  const { data } = library
  const [accounts, setAccounts] = useState<DraftAccount[]>([])
  const [sets, setSets] = useState<DraftSet[]>([])
  const [loadedFor, setLoadedFor] = useState<CaptionLibrary | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Start the draft from the saved library (and take later loads while nothing's been edited)
  useEffect(() => {
    if (!data || dirty) return
    if (loadedFor && loadedFor.accounts === data.accounts && loadedFor.hashtagSets === data.hashtagSets) return
    const d = toDraft(data)
    setAccounts(d.accounts)
    setSets(d.sets)
    setLoadedFor({ accounts: data.accounts, hashtagSets: data.hashtagSets })
  }, [data, dirty, loadedFor])

  const edit = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (fn: (prev: T) => T) => {
    setter(fn)
    setDirty(true)
    setSavedAt(null)
  }
  const editAccounts = edit(setAccounts)
  const editSets = edit(setSets)

  const savedHandles = useMemo(
    () => new Set(accounts.map((a) => normalizeHandle(a.instagram)).filter(Boolean)),
    [accounts]
  )
  const unsavedUsedHandles = (data?.usedHandles ?? []).filter((h) => !savedHandles.has(h.value)).slice(0, 24)
  const topUsedTags = (data?.usedHashtags ?? []).slice(0, 30)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await library.save({
        accounts: accounts
          .filter((a) => a.name.trim() || a.instagram.trim() || a.facebook.trim())
          .map((a) => ({
            id: a.id,
            name: a.name.trim() || normalizeHandle(a.instagram) || a.facebook.trim(),
            instagram: normalizeHandle(a.instagram) || null,
            facebook: a.facebook.trim() || null,
          })),
        hashtagSets: sets
          .filter((s) => s.name.trim() || s.tagsText.trim())
          .map((s) => ({
            id: s.id,
            name: s.name.trim() || 'Untitled set',
            tags: parseTags(s.tagsText).slice(0, CAPTION_LIBRARY_LIMITS.tagsPerSet),
          })),
      })
      setDirty(false)
      setLoadedFor(null)
      setSavedAt(Date.now())
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (library.loading && !data) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts and hashtags…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {data?.setupRequired && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{data.setupRequired} Suggestions from past captions still work.</span>
        </div>
      )}
      {library.error && !data && <p className="text-sm text-red-600">{library.error}</p>}

      {/* Accounts */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <AtSign className="h-4 w-4 text-fuchsia-500" />
          <h4 className="font-semibold text-gray-900">Accounts to tag</h4>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Type @ in a caption to tag these. Instagram gets <span className="font-medium">@handle</span>{' '}(a real tag);
          Facebook can&apos;t tag through the API, so on Facebook the handle is swapped for the Facebook name.
        </p>

        {accounts.length > 0 && (
          <div className="mb-2 hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <span>Name</span>
            <span>Instagram handle</span>
            <span>Facebook name</span>
            <span className="w-9" />
          </div>
        )}
        <div className="space-y-2">
          {accounts.map((a) => {
            const handle = normalizeHandle(a.instagram)
            const badHandle = !!a.instagram.trim() && !/^[a-z0-9._]{1,30}$/.test(handle)
            const set = (patch: Partial<DraftAccount>) =>
              editAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...patch } : x)))
            return (
              <div
                key={a.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:border-0 sm:p-0"
              >
                <Input value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" aria-label="Name" />
                <div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
                    <Input
                      value={a.instagram.replace(/^@+/, '')}
                      onChange={(e) => set({ instagram: e.target.value })}
                      placeholder="handle"
                      aria-label="Instagram handle"
                      className="pl-7"
                      aria-invalid={badHandle}
                    />
                  </div>
                  {badHandle && <p className="mt-1 text-[11px] text-red-600">Letters, numbers, . and _ only</p>}
                </div>
                <Input
                  value={a.facebook}
                  onChange={(e) => set({ facebook: e.target.value })}
                  placeholder="Page name (optional)"
                  aria-label="Facebook name"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => editAccounts((prev) => prev.filter((x) => x.id !== a.id))}
                  aria-label="Remove account"
                  className="justify-self-end text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={accounts.length >= CAPTION_LIBRARY_LIMITS.accounts}
          onClick={() =>
            editAccounts((prev) => [...prev, { id: crypto.randomUUID(), name: '', instagram: '', facebook: '' }])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add account
        </Button>

        {unsavedUsedHandles.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Tagged in past captions — click to save:</p>
            <div className="flex flex-wrap gap-1.5">
              {unsavedUsedHandles.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() =>
                    editAccounts((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), name: h.value, instagram: h.value, facebook: '' },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:border-fuchsia-300 hover:bg-fuchsia-50"
                >
                  <Plus className="h-3 w-3" />@{h.value}
                  <span className="text-gray-400">{h.count}×</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Hashtag sets */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Hash className="h-4 w-4 text-blue-500" />
          <h4 className="font-semibold text-gray-900">Hashtag sets</h4>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Type # in a caption to insert a whole set or single hashtags. Hashtags from past captions are suggested too.
        </p>
        <div className="space-y-3">
          {sets.map((s) => {
            const count = parseTags(s.tagsText).length
            const set = (patch: Partial<DraftSet>) =>
              editSets((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
            return (
              <div key={s.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={s.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Set name, e.g. Brunch"
                    aria-label="Set name"
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editSets((prev) => prev.filter((x) => x.id !== s.id))}
                    aria-label="Remove set"
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <textarea
                  value={s.tagsText}
                  onChange={(e) => set({ tagsText: e.target.value })}
                  placeholder="#brunch #aucklandeats #coffeetime"
                  rows={2}
                  className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p
                  className={`mt-1 text-[11px] ${count > CAPTION_LIBRARY_LIMITS.tagsPerSet ? 'text-red-600' : 'text-gray-400'}`}
                >
                  {count} hashtag{count === 1 ? '' : 's'}
                  {count > CAPTION_LIBRARY_LIMITS.tagsPerSet && ` — Instagram allows ${CAPTION_LIBRARY_LIMITS.tagsPerSet} per post; extras are dropped`}
                </p>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sets.length >= CAPTION_LIBRARY_LIMITS.hashtagSets}
            onClick={() => editSets((prev) => [...prev, { id: crypto.randomUUID(), name: '', tagsText: '' }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add hashtag set
          </Button>
          {topUsedTags.length >= 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sets.length >= CAPTION_LIBRARY_LIMITS.hashtagSets}
              onClick={() =>
                editSets((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    name: 'Most used',
                    tagsText: topUsedTags
                      .slice(0, 15)
                      .map((t) => `#${t.value}`)
                      .join(' '),
                  },
                ])
              }
            >
              <Hash className="mr-1 h-4 w-4" /> New set from most-used hashtags
            </Button>
          )}
        </div>

        {topUsedTags.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Most used in past captions:</p>
            <div className="flex flex-wrap gap-1.5">
              {topUsedTags.map((t) => (
                <span key={t.value} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                  #{t.value} <span className="text-gray-400">{t.count}×</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <Button type="button" onClick={save} disabled={!dirty || saving || !!data?.setupRequired}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save accounts &amp; hashtags
        </Button>
        {savedAt && !dirty && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
        {dirty && !saving && <span className="text-xs text-gray-500">Unsaved changes</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
