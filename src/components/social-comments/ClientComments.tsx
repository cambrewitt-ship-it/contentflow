'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, MessagesSquare, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authedFetchJson } from '@/lib/authedFetch'
import type { CommentRow } from '@/lib/comments/types'
import { CommentCard } from './CommentCard'
import { AutoDmCard } from './AutoDmCard'
import { AdPostsCard } from './AdPostsCard'

// A client's comments inbox: every comment on their posts across platforms, triaged by
// the AI with a reply drafted in the brand's voice, grouped by post.

const VIEWS = [
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'questions', label: 'Questions' },
  { key: 'negative', label: 'Negative & spam' },
  { key: 'ads', label: 'Ads' },
  { key: 'auto', label: 'Feed Checker actions' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'all', label: 'All' },
] as const

type View = (typeof VIEWS)[number]['key']

export default function ClientComments({ clientId }: { clientId: string }) {
  const [view, setView] = useState<View>('needs_reply')
  const [comments, setComments] = useState<CommentRow[]>([])
  const [needsReply, setNeedsReply] = useState(0)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [setup, setSetup] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (v: View) => {
      setLoading(true)
      setError(null)
      try {
        const res = await authedFetchJson<{ comments: CommentRow[]; needsReply?: number; syncedAt?: string | null; setupRequired?: string }>(
          `/api/clients/${clientId}/comments?view=${v}`
        )
        setComments(res.comments ?? [])
        setNeedsReply(res.needsReply ?? 0)
        setSyncedAt(res.syncedAt ?? null)
        setSetup(res.setupRequired ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comments')
      } finally {
        setLoading(false)
      }
    },
    [clientId]
  )

  useEffect(() => {
    void load(view)
  }, [load, view])

  const sync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await authedFetchJson(`/api/clients/${clientId}/comments`, { method: 'POST', timeoutMs: 120_000 })
      await load(view)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setSyncing(false)
    }
  }

  const update = (c: CommentRow) => {
    setComments((list) => list.map((x) => (x.id === c.id ? c : x)))
    if (c.status !== 'new') setNeedsReply((n) => Math.max(0, n - 1))
  }

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; postText: string | null; postUrl: string | null; thumb: string | null; platform: string; isAd: boolean; adTitle: string | null; items: CommentRow[] }>()
    for (const c of comments) {
      const key = `${c.platform}:${c.platformPostId}`
      const g = map.get(key) ?? { key, postText: c.postText, postUrl: c.postUrl, thumb: c.postThumbnail, platform: c.platform, isAd: c.isAd, adTitle: c.adTitle, items: [] }
      g.items.push(c)
      map.set(key, g)
    }
    return Array.from(map.values())
  }, [comments])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MessagesSquare className="h-6 w-6 text-blue-600" /> Comments
            {needsReply > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{needsReply}</span>}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Comments on this client&apos;s posts, with a reply drafted in their voice. New comments arrive automatically.
            {syncedAt && ` Checked ${new Date(syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/client/${clientId}/feed-checker`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ShieldCheck className="h-4 w-4 text-violet-600" /> Feed Checker
          </Link>
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {setup && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {setup}
        </p>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v.label}
                {v.key === 'needs_reply' && needsReply > 0 && ` (${needsReply})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading comments…
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              {view === 'needs_reply' ? 'All caught up — no comments waiting for a reply.' : 'Nothing here.'}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
                    {g.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.thumb} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-gray-700">
                      {g.isAd && <span className="mr-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">AD</span>}
                      {g.postText || g.adTitle || 'Post'}
                    </p>
                    <p className="text-xs capitalize text-gray-400">
                      {g.platform} · {g.items.length} comment{g.items.length === 1 ? '' : 's'}
                      {g.postUrl && (
                        <>
                          {' · '}
                          <a href={g.postUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            view post
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {g.items.map((c) => (
                    <CommentCard key={c.id} clientId={clientId} comment={c} onChange={update} compact />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <AdPostsCard clientId={clientId} onAdded={() => setView('ads')} />
          <AutoDmCard clientId={clientId} />
        </aside>
      </div>
    </div>
  )
}
