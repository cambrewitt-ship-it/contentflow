'use client'

import { useEffect, useState } from 'react'
import { BarChart3, ExternalLink, Loader2 } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import type { AnalyticsPost } from '@/lib/analytics/types'

// Results of a published post (one row per platform), compared with the client's usual
// engagement. Shown in the calendar post modal.

interface Response {
  results: Record<string, AnalyticsPost[]>
  medianEngagementRate: number | null
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function PostResults({ clientId, latePostId }: { clientId: string; latePostId: string }) {
  const [data, setData] = useState<{ posts: AnalyticsPost[]; median: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    authedFetchJson<Response>(`/api/clients/${clientId}/analytics/posts?ids=${encodeURIComponent(latePostId)}`, { timeoutMs: 120_000 })
      .then((res) => {
        if (!cancelled) setData({ posts: res.results?.[latePostId] ?? [], median: res.medianEngagementRate })
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, latePostId])

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <BarChart3 className="h-3.5 w-3.5" /> Results
      </p>
      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading results…
        </p>
      ) : !data?.posts.length ? (
        <p className="text-xs text-gray-500">No results yet — they appear about an hour after the post goes live.</p>
      ) : (
        <div className="space-y-2">
          {data.posts.map((p) => {
            const m = p.metrics
            const vs = data.median ? m.engagementRate / data.median : null
            return (
              <div key={p.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize text-gray-800">{p.platform}</span>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
                      View post <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-4 gap-2 text-center">
                  {[
                    [m.reach ? 'Reach' : 'Views', compact.format(m.reach || m.views)],
                    ['Likes', compact.format(m.likes)],
                    ['Comments', compact.format(m.comments)],
                    ['Engagement', `${m.engagementRate.toFixed(1)}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white px-1 py-1.5">
                      <div className="text-sm font-semibold tabular-nums text-gray-900">{value}</div>
                      <div className="text-[10px] text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {vs !== null && (
                  <p className={`mt-1 text-xs ${vs >= 1.2 ? 'text-emerald-700' : vs <= 0.8 ? 'text-red-700' : 'text-gray-500'}`}>
                    {vs >= 1.2
                      ? `${vs.toFixed(1)}x this account's usual engagement (${data.median}%)`
                      : vs <= 0.8
                        ? `${Math.round((1 - vs) * 100)}% below this account's usual engagement (${data.median}%)`
                        : `About this account's usual engagement (${data.median}%)`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
