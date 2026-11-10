'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarClock,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authedFetchJson } from '@/lib/authedFetch'
import { slotLabel } from '@/lib/analytics/insights'
import type { AnalyticsPost, ClientAnalyticsResponse, GroupStat, Recommendation } from '@/lib/analytics/types'
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
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-700'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(Math.round(value * 100))}% <span className="font-normal text-gray-500">vs previous</span>
    </span>
  )
}

function StatTile({ label, value, delta, note }: { label: string; value: string; delta?: number | null; note?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      <div className="mt-1">{note ?? <Delta value={delta ?? null} />}</div>
    </div>
  )
}

function Card({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function GroupBars({ groups, empty }: { groups: GroupStat[]; empty: string }) {
  const solid = groups.filter((g) => g.count > 0)
  if (!solid.length) return <p className="text-sm text-gray-500">{empty}</p>
  const max = Math.max(...solid.map((g) => g.medianEngagementRate), 0.01)
  return (
    <div className="space-y-2.5">
      {solid.map((g) => (
        <div key={g.key} title={`${g.count} posts · median ${g.medianEngagementRate}% engagement · median reach ${fmt(g.medianReach)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-gray-700">{g.label}</span>
            <span className="tabular-nums text-gray-900">
              {g.medianEngagementRate.toFixed(1)}% <span className="text-xs text-gray-400">· {g.count} posts</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full ${g.count < 3 ? 'bg-blue-300' : 'bg-blue-600'}`}
              style={{ width: `${Math.max(2, (g.medianEngagementRate / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-gray-400">Median engagement rate. Lighter bars have fewer than 3 posts.</p>
    </div>
  )
}

function PostRow({ post, median }: { post: AnalyticsPost; median: number }) {
  const m = post.metrics
  const vs = median ? m.engagementRate / median : null
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {post.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          <span className="font-medium capitalize text-gray-700">{post.platform}</span>
          <span>·</span>
          <span className="capitalize">{post.format}</span>
          <span>·</span>
          <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {post.isExternal && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">posted directly</span>}
          {post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-gray-800">{post.content || <span className="text-gray-400">No caption</span>}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-gray-600">
          <span>{compact.format(m.reach || m.views)} {m.reach ? 'reach' : 'views'}</span>
          <span>{fmt(m.likes)} likes</span>
          <span>{fmt(m.comments)} comments</span>
          {m.shares > 0 && <span>{fmt(m.shares)} shares</span>}
          {m.saves > 0 && <span>{fmt(m.saves)} saves</span>}
          <span className="font-medium text-gray-900">{m.engagementRate.toFixed(1)}% engagement</span>
          {vs !== null && (
            <span className={vs >= 1.2 ? 'text-emerald-700' : vs <= 0.8 ? 'text-red-700' : 'text-gray-500'}>
              {vs >= 1 ? `${vs.toFixed(1)}x usual` : `${Math.round((1 - vs) * 100)}% below usual`}
            </span>
          )}
        </div>
      </div>
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
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="font-medium text-gray-900">{rec.title}</p>
      <p className="mt-1 text-sm text-gray-600">{rec.detail}</p>
      {href && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
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
  const rangePosts = useMemo(() => {
    const since = Date.now() - range * 86_400_000
    return (data?.recentPosts ?? []).filter((p) => Date.parse(p.publishedAt) >= since)
  }, [data?.recentPosts, range])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6 text-blue-600" /> Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Results from every connected account, including posts made directly on the platforms.
            {data?.syncedAt && ` Updated ${new Date(data.syncedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                role="tab"
                aria-selected={range === r.days}
                onClick={() => setRange(r.days)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${range === r.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh('data')} disabled={!!refreshing} title="Re-read results from Zernio">
            <RefreshCw className={`h-4 w-4 ${refreshing === 'data' ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && data.status !== 'ok' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
        <div className="flex items-center justify-center gap-2 py-24 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Reading results…
        </div>
      ) : (
        <>
          {d && (
            <div className={`grid grid-cols-2 gap-3 md:grid-cols-5 ${loading ? 'opacity-60' : ''}`}>
              <StatTile
                label="Followers"
                value={fmt(d.followers.current)}
                note={
                  <span className={`text-xs font-medium ${d.followers.gained >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {d.followers.gained >= 0 ? '+' : ''}
                    {fmt(d.followers.gained)} <span className="font-normal text-gray-500">this period</span>
                  </span>
                }
              />
              <StatTile label="Reach" value={compact.format(d.totals.reach)} delta={change(d.totals.reach, d.previousTotals?.reach)} />
              <StatTile
                label="Impressions"
                value={compact.format(d.totals.impressions)}
                delta={change(d.totals.impressions, d.previousTotals?.impressions)}
              />
              <StatTile
                label="Engagement"
                value={compact.format(engagement(d.totals))}
                delta={change(engagement(d.totals), d.previousTotals ? engagement(d.previousTotals) : null)}
              />
              <StatTile
                label="Engagement rate"
                value={`${d.totals.engagementRate.toFixed(2)}%`}
                delta={change(d.totals.engagementRate, d.previousTotals?.engagementRate)}
              />
            </div>
          )}
          {d && <p className="-mt-3 text-xs text-gray-500">Engagement is likes, comments, shares and saves. Changes compare with the period before.</p>}

          {d && (
            <Card
              title="Daily results"
              icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
              action={
                <div className="inline-flex flex-wrap rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Metric">
                  {CHART_METRICS.map((m) => (
                    <button
                      key={m.key}
                      role="tab"
                      aria-selected={metric === m.key}
                      onClick={() => setMetric(m.key)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${metric === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              }
            >
              <MetricChart points={points} label={CHART_METRICS.find((m) => m.key === metric)!.label} />
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <Card
                title="Recommended next"
                icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
                action={
                  i && i.postCount >= 5 ? (
                    <Button variant="ghost" size="sm" onClick={() => refresh('ideas')} disabled={!!refreshing}>
                      {refreshing === 'ideas' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
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
                        {new Date(data.recommendationsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. New ones arrive
                        weekly.
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

              <Card title="Posts in this period" icon={<BarChart3 className="h-4 w-4 text-gray-500" />}>
                {rangePosts.length ? (
                  <div>
                    {rangePosts.map((p) => (
                      <PostRow key={p.id} post={p} median={median} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No posts published in this period.</p>
                )}
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-2">
              <ReportsCard clientId={clientId} />

              <Card title="What's working" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}>
                {i?.findings.length ? (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {i.findings.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
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
                    The Content Agent and caption writer use these learnings automatically. Based on {i.postCount} posts from the last 12
                    months · {i.postsPerWeek} posts a week · median engagement {median}%.
                  </p>
                )}
              </Card>

              {i && i.bestSlots.length > 0 && (
                <Card title="Best times to post" icon={<CalendarClock className="h-4 w-4 text-blue-600" />}>
                  <ol className="space-y-1.5 text-sm">
                    {i.bestSlots.map((s, n) => (
                      <li key={`${s.day}-${s.hour}`} className="flex justify-between">
                        <span className="text-gray-700">
                          {n + 1}. {slotLabel(s)}
                        </span>
                        <span className="tabular-nums text-gray-500">
                          avg {s.avgEngagement} engagements · {s.postCount} posts
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[11px] text-gray-400">In {i.timezone} time. The Content Agent schedules into these slots.</p>
                </Card>
              )}

              {i && (
                <Card title="By format" icon={<BarChart3 className="h-4 w-4 text-gray-500" />}>
                  <GroupBars groups={i.byFormat} empty="No posts yet." />
                </Card>
              )}
              {i && (
                <Card title="By caption length" icon={<BarChart3 className="h-4 w-4 text-gray-500" />}>
                  <GroupBars groups={i.byCaptionLength} empty="No posts yet." />
                </Card>
              )}
              {i && i.hashtags.length > 0 && (
                <Card title="Hashtags by results" icon={<BarChart3 className="h-4 w-4 text-gray-500" />}>
                  <div className="space-y-1.5 text-sm">
                    {i.hashtags.slice(0, 12).map((h) => (
                      <div key={h.tag} className="flex justify-between">
                        <span className="text-gray-700">#{h.tag}</span>
                        <span className="tabular-nums text-gray-500">
                          {h.medianEngagementRate.toFixed(1)}% · {h.count} posts
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">Hashtags used on 3+ posts. The # menu in captions ranks by these.</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
