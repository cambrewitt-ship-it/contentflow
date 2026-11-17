'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  Eye,
  Heart,
  Layers,
  Lightbulb,
  Loader2,
  RefreshCw,
  ScatterChart,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authedFetchJson } from '@/lib/authedFetch'
import { slotLabel } from '@/lib/analytics/insights'
import type { ClientAnalyticsResponse, Recommendation } from '@/lib/analytics/types'
import { postsSince } from '@/lib/analytics/visuals'
import { Card, ContentView, PostsView, Segmented, TimingView } from './AnalyticsViews'
import { PostTimeline } from './charts'
import { MetricChart } from './MetricChart'
import { ReportsCard } from './ReportsCard'

// A client's results: totals vs the previous period, a daily chart, what's working
// (computed from real post results), the AI's recommendations with one-click actions,
// and every recent post's numbers.

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
]

type ChartMetric = 'reach' | 'engagement' | 'impressions' | 'followersGained'
const CHART_METRICS: Array<{ key: ChartMetric; label: string }> = [
  { key: 'reach', label: 'Reach' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'followersGained', label: 'Followers gained' },
]

type View = 'overview' | 'timing' | 'content' | 'posts'
const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'timing', label: 'When to post' },
  { key: 'content', label: 'What to post' },
  { key: 'posts', label: 'Posts' },
]

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

function change(current: number, previous: number | undefined | null): number | null {
  if (previous === undefined || previous === null || previous === 0) return null
  return (current - previous) / previous
}

function Delta({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-gray-400">no comparison</span>
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(Math.round(value * 100))}%
      </span>
      <span className="text-gray-500">vs previous</span>
    </span>
  )
}

function StatTile({
  label,
  value,
  delta,
  note,
  icon: Icon,
  featured,
}: {
  label: string
  value: string
  delta?: number | null
  note?: React.ReactNode
  icon?: LucideIcon
  featured?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover ${
        featured ? 'border-blue-200/70 bg-gradient-to-br from-white via-white to-blue-50/80' : 'border-gray-200/80 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-gray-900">{value}</p>
      <div className="mt-1.5">{note ?? <Delta value={delta ?? null} />}</div>
    </div>
  )
}

function RecommendationCard({ rec, clientId }: { rec: Recommendation; clientId: string }) {
  const href =
    rec.action === 'create_post' || rec.action === 'run_agent'
      ? `/dashboard/client/${clientId}/autopilot?brief=${encodeURIComponent(rec.brief || `${rec.title}. ${rec.detail}`)}`
      : rec.action === 'adjust_schedule'
        ? `/dashboard/client/${clientId}/calendar`
        : null
  return (
    <div className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-blue-50/40 p-4 transition-colors hover:border-blue-200">
      <p className="text-[14px] font-semibold text-gray-900">{rec.title}</p>
      <p className="mt-1 text-[13px] leading-5 text-gray-600">{rec.detail}</p>
      {href && (
        <Link
          href={href}
          className={`mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium shadow-button transition-[filter,background-color] ${
            rec.action === 'adjust_schedule' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gradient-ai text-white hover:brightness-105'
          }`}
        >
          {rec.action === 'adjust_schedule' ? <CalendarClock className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          {rec.action === 'adjust_schedule' ? 'Open calendar' : 'Create with Content Agent'}
        </Link>
      )}
    </div>
  )
}

export default function ClientAnalytics({ clientId }: { clientId: string }) {
  const [range, setRange] = useState(30)
  const [data, setData] = useState<ClientAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<'data' | 'ideas' | null>(null)
  const [metric, setMetric] = useState<ChartMetric>('reach')
  const [view, setView] = useState<View>('overview')
  // Deep links from the client overview (?view=timing / ?view=posts); read after mount to keep hydration stable
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view')
    if (v && VIEWS.some((o) => o.key === v)) setView(v as View)
  }, [])

  const load = useCallback(
    async (r: number) => {
      setLoading(true)
      setError(null)
      try {
        setData(await authedFetchJson<ClientAnalyticsResponse>(`/api/clients/${clientId}/analytics?range=${r}`, { timeoutMs: 120_000 }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    },
    [clientId]
  )

  useEffect(() => {
    void load(range)
  }, [load, range])

  const refresh = async (what: 'data' | 'ideas') => {
    setRefreshing(what)
    try {
      await authedFetchJson(`/api/clients/${clientId}/analytics/refresh`, {
        method: 'POST',
        body: { recommendations: what === 'ideas' },
        timeoutMs: 120_000,
      })
      await load(range)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(null)
    }
  }

  const d = data?.dashboard
  const i = data?.insights
  const median = i?.baseline.medianEngagementRate ?? 0
  const engagement = (t: NonNullable<typeof d>['totals']) => t.likes + t.comments + t.shares + t.saves

  const points = useMemo(() => (d?.daily ?? []).map((p) => ({ date: p.date, value: p[metric] })), [d, metric])
  const allPosts = useMemo(() => data?.posts ?? data?.recentPosts ?? [], [data?.posts, data?.recentPosts])
  const rangePosts = useMemo(() => postsSince(allPosts, range), [allPosts, range])
  const rangeLabel = RANGES.find((r) => r.days === range)!.label

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 md:px-6 md:py-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">Analytics</h1>
          <p className="mt-1 text-[13px] leading-5 text-gray-500">
            Results from every connected account, including posts made directly on the platforms.
            {data?.syncedAt && ` Updated ${new Date(data.syncedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.`}
          </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-gray-200/80 bg-white/80 p-1 shadow-xs backdrop-blur-sm"
            role="tablist"
            aria-label="Date range"
          >
            {RANGES.map((r) => (
              <button
                key={r.days}
                role="tab"
                aria-selected={range === r.days}
                onClick={() => setRange(r.days)}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 ${
                  range === r.days ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="h-[38px] w-[38px] rounded-xl" onClick={() => refresh('data')} disabled={!!refreshing} title="Re-read results from Zernio" aria-label="Refresh results">
            <RefreshCw className={`h-4 w-4 ${refreshing === 'data' ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>}

      {data && data.status !== 'ok' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {data.message}
            {data.status === 'not_connected' && (
              <>
                {' '}
                <Link href={`/dashboard/client/${clientId}/connect-platforms`} className="font-medium underline">
                  Connect accounts
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="h-[118px] animate-pulse rounded-2xl border border-gray-200/60 bg-white/70" />
            ))}
          </div>
          <div className="flex h-72 items-center justify-center gap-2 rounded-2xl border border-gray-200/60 bg-white/70 text-[13px] text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Reading results…
          </div>
        </div>
      ) : (
        <>
          {d && (
            <div className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-5 [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1 ${loading ? 'opacity-60' : ''}`}>
              <StatTile
                icon={Users}
                featured
                label="Followers"
                value={fmt(d.followers.current)}
                note={
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium ${d.followers.gained >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                    >
                      {d.followers.gained >= 0 ? '+' : ''}
                      {fmt(d.followers.gained)}
                    </span>
                    <span className="text-gray-500">this period</span>
                  </span>
                }
              />
              <StatTile icon={Eye} label="Reach" value={compact.format(d.totals.reach)} delta={change(d.totals.reach, d.previousTotals?.reach)} />
              <StatTile
                icon={Layers}
                label="Impressions"
                value={compact.format(d.totals.impressions)}
                delta={change(d.totals.impressions, d.previousTotals?.impressions)}
              />
              <StatTile
                icon={Heart}
                label="Engagement"
                value={compact.format(engagement(d.totals))}
                delta={change(engagement(d.totals), d.previousTotals ? engagement(d.previousTotals) : null)}
              />
              <StatTile
                icon={Activity}
                label="Engagement rate"
                value={`${d.totals.engagementRate.toFixed(2)}%`}
                delta={change(d.totals.engagementRate, d.previousTotals?.engagementRate)}
              />
            </div>
          )}
          {d && <p className="-mt-3 text-[11px] text-gray-500">Engagement is likes, comments, shares and saves. Changes compare with the period before.</p>}

          <div className="border-b border-gray-200/70 pb-3">
            <Segmented label="Analytics view" options={VIEWS} value={view} onChange={setView} />
          </div>

          {view === 'overview' && (
            <>
              {d && (
                <Card
                  title="Daily results"
                  icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
                  action={<Segmented label="Metric" options={CHART_METRICS} value={metric} onChange={setMetric} />}
                >
                  <MetricChart points={points} label={CHART_METRICS.find((m) => m.key === metric)!.label} />
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-5">
                <div className="min-w-0 space-y-6 lg:col-span-3">
                  <Card
                    title="Recommended next"
                    icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
                    action={
                      i && i.postCount >= 5 ? (
                        <Button variant="ghost" size="sm" onClick={() => refresh('ideas')} disabled={!!refreshing}>
                          {refreshing === 'ideas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-violet-600" />}
                          New ideas
                        </Button>
                      ) : null
                    }
                  >
                    {data?.recommendations.length ? (
                      <div className="space-y-3">
                        {data.recommendations.map((r) => (
                          <RecommendationCard key={r.id} rec={r} clientId={clientId} />
                        ))}
                        {data.recommendationsAt && (
                          <p className="text-[11px] text-gray-400">
                            Written from this client&apos;s results on{' '}
                            {new Date(data.recommendationsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. New ones
                            arrive weekly.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {i && i.postCount >= 5
                          ? 'Recommendations are being written from the latest results — check back in a minute.'
                          : 'Recommendations start once there are at least 5 published posts with results.'}
                      </p>
                    )}
                  </Card>

                  <Card
                    title="Post performance"
                    icon={<ScatterChart className="h-4 w-4 text-blue-600" />}
                    subtitle={`Each dot is a post in the last ${rangeLabel}: higher = better engagement rate.`}
                    action={
                      <button onClick={() => setView('posts')} className="text-xs font-medium text-blue-600 hover:underline">
                        All posts →
                      </button>
                    }
                  >
                    <PostTimeline posts={rangePosts} median={median} />
                  </Card>
                </div>

                <div className="min-w-0 space-y-6 lg:col-span-2">
                  <Card title="What's working" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
                    {i?.findings.length ? (
                      <ul className="space-y-2 text-[13px] leading-5 text-gray-700">
                        {i.findings.map((f) => (
                          <li key={f} className="flex gap-2.5 rounded-xl bg-emerald-50/50 px-3 py-2 ring-1 ring-emerald-100/70">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {i && i.postCount >= 5
                          ? 'No clear patterns yet — results are fairly even across formats and times.'
                          : 'Patterns appear once there are a few more posts with results.'}
                      </p>
                    )}
                    {i && i.postCount >= 5 && (
                      <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                        The Content Agent and caption writer use these learnings automatically. Based on {i.postCount} posts from the last
                        12 months · {i.postsPerWeek} posts a week · median engagement {median}%.
                      </p>
                    )}
                  </Card>

                  {i && i.bestSlots.length > 0 && (
                    <Card
                      title="Best times to post"
                      icon={<CalendarClock className="h-4 w-4 text-blue-600" />}
                      action={
                        <button onClick={() => setView('timing')} className="text-xs font-medium text-blue-600 hover:underline">
                          Heatmap →
                        </button>
                      }
                    >
                      <ol className="space-y-1.5 text-[13px]">
                        {i.bestSlots.slice(0, 3).map((s, n) => (
                          <li key={`${s.day}-${s.hour}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50">
                            <span className="flex items-center gap-2.5 text-gray-800">
                              <span
                                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
                                  n === 0 ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                                }`}
                              >
                                {n + 1}
                              </span>
                              <span className="font-medium">{slotLabel(s)}</span>
                            </span>
                            <span className="text-right text-xs tabular-nums text-gray-500">avg {s.avgEngagement} engagements</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-[11px] text-gray-400">In {i.timezone} time. The Content Agent schedules into these slots.</p>
                    </Card>
                  )}

                  <ReportsCard clientId={clientId} />
                </div>
              </div>
            </>
          )}

          {view === 'timing' && <TimingView posts={allPosts} bestTimes={data?.bestTimes ?? []} insights={i ?? null} />}
          {view === 'content' && <ContentView posts={rangePosts} insights={i ?? null} rangeLabel={rangeLabel} />}
          {view === 'posts' && <PostsView posts={rangePosts} median={median} rangeLabel={rangeLabel} />}
        </>
      )}
    </div>
  )
}
