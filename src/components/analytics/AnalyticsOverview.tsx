'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Clock, ExternalLink, Grid3x3, MapPin, PieChart, Trophy, Users } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import { slotLabel } from '@/lib/analytics/insights'
import type { AnalyticsPost, ClientAnalyticsResponse, DashboardTotals } from '@/lib/analytics/types'
import { bestCell, platformColor, platformLabel, postHeatmap, postsSince, split } from '@/lib/analytics/visuals'
import { Donut, SequentialLegend, Sparkline, WeekHeatmap } from './charts'
import { PersonaAvatar } from './AudienceView'

// Compact analytics for the client overview: last 30 days' headline numbers with
// sparklines, a best-time heatmap, the platform split and the month's top post.
// Links through to the full Analytics page.

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const engagementOf = (t: DashboardTotals) => t.likes + t.comments + t.shares + t.saves

function change(current: number, previous: number | null | undefined): number | null {
  if (previous === undefined || previous === null || previous === 0) return null
  return (current - previous) / previous
}

function Delta({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-[11px] text-gray-400">no comparison yet</span>
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(Math.round(value * 100))}%
    </span>
  )
}

function Kpi({ label, value, delta, note, spark }: { label: string; value: string; delta?: number | null; note?: React.ReactNode; spark?: number[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-[24px] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-gray-900">{value}</p>
        {note ?? <Delta value={delta ?? null} />}
      </div>
      <div className="mt-2">{spark ? <Sparkline values={spark} /> : <div className="h-9" />}</div>
    </div>
  )
}

function TopPost({ post, median }: { post: AnalyticsPost; median: number }) {
  const vs = median ? post.metrics.engagementRate / median : null
  return (
    <div className="flex gap-3">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/70">
        {post.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full" style={{ background: platformColor(post.platform) }} />
          {platformLabel(post.platform)} · {new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          {post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 text-blue-600 hover:underline">
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-gray-800">{post.content || 'No caption'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs tabular-nums text-gray-500">
          <span className="font-semibold text-gray-900">{post.metrics.engagementRate.toFixed(1)}%</span>
          <span>{compact.format(post.metrics.reach || post.metrics.views)} reach</span>
          <span>{fmt(post.metrics.engagement)} eng.</span>
          {vs !== null && vs >= 1.2 && <span className="rounded-full bg-emerald-50 px-1.5 font-medium text-emerald-700">{vs.toFixed(1)}x usual</span>}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsOverview({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ClientAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    authedFetchJson<ClientAnalyticsResponse>(`/api/clients/${clientId}/analytics?range=30`, { timeoutMs: 120_000 })
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [clientId])

  const d = data?.dashboard ?? null
  const i = data?.insights ?? null
  const timeZone = i?.timezone || 'Pacific/Auckland'
  const allPosts = useMemo(() => data?.posts ?? data?.recentPosts ?? [], [data])
  const monthPosts = useMemo(() => postsSince(allPosts, 30), [allPosts])
  const heat = useMemo(() => postHeatmap(allPosts, timeZone, 'rate'), [allPosts, timeZone])
  const bestSlot = useMemo(() => bestCell(heat), [heat])
  const platforms = useMemo(() => split(monthPosts, 'platform', 'engagement'), [monthPosts])
  const top = useMemo(
    () => [...monthPosts].sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate || b.metrics.engagement - a.metrics.engagement)[0] ?? null,
    [monthPosts]
  )
  const median = i?.baseline.medianEngagementRate ?? 0
  const analyticsHref = `/dashboard/client/${clientId}/analytics`
  const persona = i?.audience?.persona ?? null

  const header = (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 md:text-2xl">
          <BarChart3 className="h-5 w-5 text-blue-600" /> Performance
        </h2>
        <p className="mt-0.5 text-[13px] text-gray-500">Last 30 days across every connected account</p>
      </div>
      <Link href={analyticsHref} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
        Full analytics <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )

  if (loading) {
    return (
      <section className="mb-8" aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-[132px] animate-pulse rounded-2xl border border-gray-200/60 bg-white/70" />
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-[220px] animate-pulse rounded-2xl border border-gray-200/60 bg-white/70" />
          ))}
        </div>
      </section>
    )
  }

  // Nothing to show: keep the overview tidy with a single line instead of an empty card
  if (error || !data || data.status === 'setup_required' || (!d && !allPosts.length)) {
    const message =
      data?.status === 'not_connected'
        ? 'Connect a social account to see reach, engagement and best times here.'
        : data?.status === 'unavailable'
          ? "The Zernio plan doesn't include analytics."
          : error
            ? "Couldn't load results just now."
            : data?.message || 'Results appear here once posts have been published.'
    return (
      <section className="mb-8">
        {header}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 py-4 text-[13px] text-gray-600">
          <span>{message}</span>
          {data?.status === 'not_connected' && (
            <a href="#social-media-platforms" className="font-medium text-blue-600 hover:underline">
              Connect accounts
            </a>
          )}
        </div>
      </section>
    )
  }

  const daily = d?.daily ?? []
  return (
    <section className="mb-8">
      {header}
      {d && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Followers"
            value={fmt(d.followers.current)}
            note={
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${d.followers.gained >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
              >
                {d.followers.gained >= 0 ? '+' : ''}
                {fmt(d.followers.gained)}
              </span>
            }
            spark={daily.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p.followersGained], [])}
          />
          <Kpi label="Reach" value={compact.format(d.totals.reach)} delta={change(d.totals.reach, d.previousTotals?.reach)} spark={daily.map((p) => p.reach)} />
          <Kpi
            label="Engagement"
            value={compact.format(engagementOf(d.totals))}
            delta={change(engagementOf(d.totals), d.previousTotals ? engagementOf(d.previousTotals) : null)}
            spark={daily.map((p) => p.engagement)}
          />
          <Kpi
            label="Engagement rate"
            value={`${d.totals.engagementRate.toFixed(2)}%`}
            delta={change(d.totals.engagementRate, d.previousTotals?.engagementRate)}
            spark={daily.map((p) => (p.impressions || p.reach ? (p.engagement / (p.impressions || p.reach)) * 100 : 0))}
          />
        </div>
      )}

      {persona && (
        <Link
          href={`${analyticsHref}?view=audience`}
          className="group mt-3 flex flex-col gap-3 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-white to-blue-50/80 p-4 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <PersonaAvatar name={persona.name} size={52} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">Most engaged audience</p>
              <p className="text-[16px] font-semibold text-gray-900">
                {persona.name}
                <span className="ml-2 text-[13px] font-normal text-gray-500">
                  {[persona.ageRange && `${persona.ageRange}`, persona.gender].filter(Boolean).join(' · ')}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-gray-600">{persona.summary}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:max-w-[45%] sm:justify-end">
            {persona.location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200/80">
                <MapPin className="h-3.5 w-3.5 text-blue-600" /> {persona.location}
              </span>
            )}
            {persona.whenOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200/80">
                <Clock className="h-3.5 w-3.5 text-blue-600" /> {persona.whenOnline.split(' and ')[0]}
              </span>
            )}
            {persona.loves[0] && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200/80">
                <Users className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" /> <span className="truncate">{persona.loves[0]}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:underline">
              Audience <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-gray-200/80 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900">
              <Grid3x3 className="h-4 w-4 text-blue-600" /> Best times
            </h3>
            <Link href={`${analyticsHref}?view=timing`} className="text-xs font-medium text-blue-600 hover:underline">
              Details
            </Link>
          </div>
          {allPosts.length ? (
            <>
              <WeekHeatmap
                compactSize
                cells={heat}
                ariaLabel="Engagement rate by day and hour"
                describe={(c) =>
                  c.posts ? (
                    <>
                      <span className="font-semibold">{c.medianEngagementRate.toFixed(1)}%</span> engagement · {c.posts} post{c.posts === 1 ? '' : 's'}
                    </>
                  ) : (
                    <span className="text-gray-500">No posts yet</span>
                  )
                }
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <SequentialLegend />
                {bestSlot && <span className="text-[11px] text-gray-500">Strongest: {slotLabel(bestSlot)}</span>}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Appears once posts have results.</p>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-gray-200/80 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-gray-900">
            <PieChart className="h-4 w-4 text-blue-600" /> Engagement by platform
          </h3>
          {platforms.length ? <Donut slices={platforms} centerLabel="Engagements" size={120} /> : <p className="text-sm text-gray-500">No posts in the last 30 days.</p>}
        </div>

        <div className="min-w-0 rounded-2xl border border-gray-200/80 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900">
              <Trophy className="h-4 w-4 text-amber-500" /> Top post this month
            </h3>
            <Link href={`${analyticsHref}?view=posts`} className="text-xs font-medium text-blue-600 hover:underline">
              All posts
            </Link>
          </div>
          {top ? <TopPost post={top} median={median} /> : <p className="text-sm text-gray-500">No posts in the last 30 days.</p>}
          {i?.findings[0] && (
            <p className="mt-3 rounded-xl bg-emerald-50/60 px-3 py-2 text-[12px] leading-5 text-emerald-900 ring-1 ring-emerald-100">{i.findings[0]}</p>
          )}
        </div>
      </div>
    </section>
  )
}
