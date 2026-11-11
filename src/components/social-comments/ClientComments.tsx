'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  ExternalLink,
  HelpCircle,
  Inbox,
  Megaphone,
  MessageCircleReply,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
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

const VIEW_ICONS: Record<View, LucideIcon> = {
  needs_reply: MessageCircleReply,
  questions: HelpCircle,
  negative: ShieldAlert,
  ads: Megaphone,
  auto: ShieldCheck,
  hidden: EyeOff,
  all: Inbox,
}

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
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <MessagesSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">
              Comments
              {needsReply > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold tracking-normal text-white shadow-sm">{needsReply}</span>
              )}
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-gray-500">
              Comments on this client&apos;s posts, with a reply drafted in their voice. New comments arrive automatically.
              {syncedAt && ` Checked ${new Date(syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href={`/dashboard/client/${clientId}/feed-checker`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 shadow-xs transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Feed Checker
          </Link>
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing} className="h-9 rounded-xl text-[13px]">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </header>

      {setup && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {setup}
        </p>
      )}
      {error && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
        {/* ── Inbox folders ────────────────────────────────────────────── */}
        <nav
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-hide lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:border-gray-200/80 lg:bg-white/80 lg:p-2 lg:shadow-card lg:backdrop-blur-sm"
          role="tablist"
          aria-label="Comment folders"
        >
          {VIEWS.map((v) => {
            const Icon = VIEW_ICONS[v.key]
            const active = view === v.key
            return (
              <button
                key={v.key}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.key)}
                className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition-colors lg:w-full ${
                  active
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 lg:ring-0'
                    : 'bg-white/70 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100/80 hover:text-gray-900 lg:bg-transparent lg:ring-0'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="flex-1 text-left">{v.label}</span>
                {v.key === 'needs_reply' && needsReply > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${active ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'}`}>
                    {needsReply}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ── Conversations, grouped by post ───────────────────────────── */}
        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="space-y-4" aria-busy="true">
              <p className="sr-only">Loading comments…</p>
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200/70 bg-white/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
                    <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="h-16 animate-pulse rounded-xl bg-gray-50" />
                    <div className="h-16 animate-pulse rounded-xl bg-gray-50" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-white/90 px-6 py-14 text-center shadow-card backdrop-blur-sm">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                {view === 'needs_reply' ? <CheckCircle2 className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
              </span>
              <p className="text-sm font-medium text-gray-900">{view === 'needs_reply' ? 'All caught up' : 'Nothing here'}</p>
              {view === 'needs_reply' && <p className="mt-1 text-[13px] text-gray-500">No comments waiting for a reply.</p>}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
                <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/70">
                    {g.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.thumb} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium text-gray-900">
                      {g.isAd && <span className="mr-1.5 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">AD</span>}
                      {g.postText || g.adTitle || 'Post'}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-gray-500">
                      {g.platform} · {g.items.length} comment{g.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {g.postUrl && (
                    <a
                      href={g.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
                    >
                      view post <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </header>
                <div className="divide-y divide-gray-100">
                  {g.items.map((c) => (
                    <CommentCard key={c.id} clientId={clientId} comment={c} onChange={update} compact flush />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* ── Ads and automations ──────────────────────────────────────── */}
        <aside className="space-y-4 lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4">
          <AdPostsCard clientId={clientId} onAdded={() => setView('ads')} />
          <AutoDmCard clientId={clientId} />
        </aside>
      </div>
    </div>
  )
}
