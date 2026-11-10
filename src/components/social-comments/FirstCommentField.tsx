'use client'

import { useEffect, useState } from 'react'
import { Check, Link2, Loader2 } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'

// A post's "first comment" — usually the link for "link in comments" posts. Zernio posts
// it on Facebook as the post goes live; the Feed Checker posts it on Instagram.

export function FirstCommentField({ clientId, postId }: { clientId: string; postId: string }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  const [postedAt, setPostedAt] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    authedFetchJson<{ firstComment: string | null; postedAt?: string | null; unavailable?: boolean }>(
      `/api/clients/${clientId}/first-comment/${postId}`
    )
      .then((res) => {
        if (cancelled) return
        setValue(res.firstComment ?? '')
        setSaved(res.firstComment ?? '')
        setPostedAt(res.postedAt ?? null)
        setUnavailable(!!res.unavailable)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [clientId, postId])

  if (unavailable) return null

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await authedFetchJson<{ firstComment: string | null }>(`/api/clients/${clientId}/first-comment/${postId}`, {
        method: 'PUT',
        body: { firstComment: value },
      })
      setSaved(res.firstComment ?? '')
      setPostedAt(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <Link2 className="h-3.5 w-3.5" /> First comment
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Book here 👉 https://… (posted as soon as the post goes live)"
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2.5 text-sm focus:border-blue-400 focus:outline-none"
        />
        {value.trim() !== saved.trim() && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-gray-900 px-2.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
          </button>
        )}
      </div>
      {postedAt && <p className="mt-1 text-[11px] text-emerald-700">Posted {new Date(postedAt).toLocaleString()}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
