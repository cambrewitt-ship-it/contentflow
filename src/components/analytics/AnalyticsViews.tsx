'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CalendarClock,
  Clock,
  Download,
  ExternalLink,
  Grid3x3,
  LayoutGrid,
  List,
  PieChart,
  ScatterChart,
  Table2,
} from 'lucide-react'
import { slotLabel } from '@/lib/analytics/insights'
import type { AnalyticsPost, BestTimeSlot, GroupStat, PerformanceInsights } from '@/lib/analytics/types'
import {
  dailyActivity,
  formatLabel,
  localDateKey,
  platformColor,
  platformLabel,
  postHeatmap,
  slotHeatmap,
  split,
  weekdayStats,
  type HeatmapMode,
  type SplitMeasure,
} from '@/lib/analytics/visuals'
import { ActivityCalendar, Columns, Donut, PostTimeline, SequentialLegend, WeekHeatmap, type CalendarMetric } from './charts'

// The Analytics page's deeper views: when to post (heatmaps + calendar), what to post
// (platform/format splits, caption length, hashtags) and every post as a list, grid,
// sortable table or timeline.

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function Card({
  title,
  icon,
  children,
  action,
  subtitle,
  className = '',
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
            {icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-200/80 [&>svg]:h-3.5 [&>svg]:w-3.5">
                {icon}
              </span>
            )}
            {title}
          </h3>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ key: T; label: string; icon?: React.ReactNode }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-xl border border-gray-200/80 bg-gray-50/80 p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 ${
            value === o.key ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/80' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* When to post                                                        */
/* ------------------------------------------------------------------ */

type HeatSource = HeatmapMode | 'zernio'

export function TimingView({
  posts,
  bestTimes,
  insights,
}: {
  posts: AnalyticsPost[]
  bestTimes: BestTimeSlot[]
  insights: PerformanceInsights | null
}) {
  const timeZone = insights?.timezone || 'Pacific/Auckland'
  const median = insights?.baseline.medianEngagementRate ?? 0
  const [source, setSource] = useState<HeatSource>('rate')
  const [calMetric, setCalMetric] = useState<CalendarMetric>('engagement')

  const cells = useMemo(
    () => (source === 'zernio' ? slotHeatmap(bestTimes) : postHeatmap(posts, timeZone, source)),
    [source, bestTimes, posts, timeZone]
  )
  const days = useMemo(() => dailyActivity(posts, timeZone), [posts, timeZone])
  const weekdays = useMemo(() => weekdayStats(posts, timeZone), [posts, timeZone])
  const todayKey = localDateKey(new Date(), timeZone)

  const sources: Array<{ key: HeatSource; label: string }> = [
    { key: 'rate', label: 'Engagement rate' },
    { key: 'engagement', label: 'Avg engagements' },
    { key: 'posts', label: 'When we post' },
    ...(bestTimes.length ? [{ key: 'zernio' as const, label: 'Platform best times' }] : []),
  ]
  const describe = (c: (typeof cells)[number]) => {
    if (!c.posts) return <span className="text-gray-500">No posts yet</span>
    if (source === 'zernio')
      return (
        <>
          <span className="font-semibold">{c.avgEngagement}</span> avg engagements · {c.posts} posts
        </>
      )
    return (
      <>
        <span className="font-semibold">{c.medianEngagementRate.toFixed(1)}%</span> engagement · {fmt(c.avgEngagement)} avg engagements ·{' '}
        {c.posts} post{c.posts === 1 ? '' : 's'}
      </>
    )
  }

  if (!posts.length && !bestTimes.length) {
    return (
      <Card title="When to post" icon={<Clock className="h-4 w-4 text-blue-600" />}>
        <p className="text-sm text-gray-500">Timing patterns appear once there are published posts with results.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card
        title="Best days & hours"
        icon={<Grid3x3 className="h-4 w-4 text-blue-600" />}
        subtitle={
          source === 'zernio'
            ? `Zernio's best-time data across the connected accounts, in ${timeZone} time.`
            : source === 'posts'
              ? `How often posts go out at each hour — ${posts.length} posts from the last 12 months, ${timeZone} time.`
              : `Results by when each post went out — ${posts.length} posts from the last 12 months, ${timeZone} time. Outlined: the strongest slot.`
        }
        action={<Segmented label="Heatmap measure" options={sources} value={source} onChange={setSource} />}
      >
        <WeekHeatmap cells={cells} describe={describe} ariaLabel="Results by day of week and hour" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SequentialLegend />
          {source !== 'posts' && posts.length < 20 && source !== 'zernio' && (
            <span className="text-[11px] text-gray-400">Few posts so far — single posts can make a slot look strong.</span>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="By day of the week"
          icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
          subtitle="Median engagement rate per weekday. Lighter bars have fewer than 3 posts."
        >
          <Columns
            items={weekdays.map((w) => ({ key: String(w.day), label: w.label, value: w.medianEngagementRate, count: w.posts }))}
            baseline={median}
          />
        </Card>
        <Card
          className="lg:col-span-2"
          title="Platform best times"
          icon={<CalendarClock className="h-4 w-4 text-blue-600" />}
          subtitle="Zernio's strongest slots for these accounts — the Content Agent schedules into them."
        >
          {insights?.bestSlots.length ? (
            <ol className="space-y-1.5 text-[13px]">
              {insights.bestSlots.map((s, n) => (
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
                  <span className="text-right text-xs tabular-nums text-gray-500">avg {s.avgEngagement} · {s.postCount} posts</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">Best slots appear once a time has 2+ posts with results.</p>
          )}
          <TimeOfDay groups={insights?.byTimeOfDay ?? []} />
        </Card>
      </div>

      <Card
        title="Posting calendar"
        icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
        subtitle="Every day of the last 12 months. Darker = more."
        action={
          <Segmented
            label="Calendar measure"
            options={[
              { key: 'engagement', label: 'Engagement' },
              { key: 'reach', label: 'Reach' },
              { key: 'posts', label: 'Posts' },
            ]}
            value={calMetric}
            onChange={setCalMetric}
          />
        }
      >
        <ActivityCalendar days={days} metric={calMetric} todayKey={todayKey} />
        <div className="mt-2">
          <SequentialLegend />
        </div>
      </Card>
    </div>
  )
}

function TimeOfDay({ groups }: { groups: GroupStat[] }) {
  const solid = groups.filter((g) => g.count > 0)
  if (!solid.length) return null
  const max = Math.max(...solid.map((g) => g.medianEngagementRate), 0.01)
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="mb-2 text-xs font-medium text-gray-500">Time of day</p>
      <div className="space-y-2">
        {solid.map((g) => (
          <div key={g.key} className="grid grid-cols-[112px_1fr_44px] items-center gap-2 text-[12px]" title={`${g.count} posts`}>
            <span className="truncate text-gray-600">{g.label.replace(/\s*\(.*\)/, '')}</span>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full ${g.count < 3 ? 'bg-blue-200' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(3, (g.medianEngagementRate / max) * 100)}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-gray-900">{g.medianEngagementRate.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* What to post                                                        */
/* ------------------------------------------------------------------ */

export function GroupBars({ groups, empty }: { groups: GroupStat[]; empty: string }) {
  const solid = groups.filter((g) => g.count > 0)
  if (!solid.length) return <p className="text-sm text-gray-500">{empty}</p>
  const max = Math.max(...solid.map((g) => g.medianEngagementRate), 0.01)
  return (
    <div className="space-y-2.5">
      {solid.map((g) => (
        <div key={g.key} title={`${g.count} posts · median ${g.medianEngagementRate}% engagement · median reach ${fmt(g.medianReach)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="text-gray-700">{g.label}</span>
            <span className="font-medium tabular-nums text-gray-900">
              {g.medianEngagementRate.toFixed(1)}% <span className="text-xs text-gray-400">· {g.count} posts</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full transition-[width] duration-700 ease-out ${g.count < 3 ? 'bg-blue-200' : 'bg-blue-600'}`}
              style={{ width: `${Math.max(2, (g.medianEngagementRate / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-gray-400">Median engagement rate. Lighter bars have fewer than 3 posts.</p>
    </div>
  )
}

const MEASURES: Array<{ key: SplitMeasure; label: string }> = [
  { key: 'engagement', label: 'Engagement' },
  { key: 'reach', label: 'Reach' },
  { key: 'posts', label: 'Posts' },
]

export function ContentView({ posts, insights, rangeLabel }: { posts: AnalyticsPost[]; insights: PerformanceInsights | null; rangeLabel: string }) {
  const [measure, setMeasure] = useState<SplitMeasure>('engagement')
  const byPlatform = useMemo(() => split(posts, 'platform', measure), [posts, measure])
  const byFormat = useMemo(() => split(posts, 'format', measure), [posts, measure])
  const label = MEASURES.find((m) => m.key === measure)!.label
  const valueFormat = (n: number) => (measure === 'posts' ? fmt(n) : compact.format(n))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-gray-500">
          Share of {label.toLowerCase()} in the last {rangeLabel} · {posts.length} posts
        </p>
        <Segmented label="Split measure" options={MEASURES} value={measure} onChange={setMeasure} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By platform" icon={<PieChart className="h-4 w-4 text-blue-600" />}>
          <Donut slices={byPlatform} centerLabel={label} valueFormat={valueFormat} />
        </Card>
        <Card title="By format" icon={<PieChart className="h-4 w-4 text-blue-600" />}>
          <Donut slices={byFormat} centerLabel={label} valueFormat={valueFormat} />
        </Card>
      </div>
      {insights && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Format results" icon={<BarChart3 className="h-4 w-4 text-gray-500" />} subtitle="Last 12 months">
            <GroupBars groups={insights.byFormat} empty="No posts yet." />
          </Card>
          <Card title="Caption length" icon={<BarChart3 className="h-4 w-4 text-gray-500" />} subtitle="Last 12 months">
            <GroupBars groups={insights.byCaptionLength} empty="No posts yet." />
          </Card>
          <Card title="Hashtags per post" icon={<BarChart3 className="h-4 w-4 text-gray-500" />} subtitle="Last 12 months">
            <GroupBars groups={insights.byHashtagCount} empty="No posts yet." />
          </Card>
        </div>
      )}
      {insights && insights.hashtags.length > 0 && <HashtagCloud insights={insights} />}
    </div>
  )
}

function HashtagCloud({ insights }: { insights: PerformanceInsights }) {
  const tags = insights.hashtags.slice(0, 24)
  const maxLift = Math.max(...tags.map((t) => t.lift), 1)
  const maxCount = Math.max(...tags.map((t) => t.count), 1)
  return (
    <Card
      title="Hashtags by results"
      icon={<BarChart3 className="h-4 w-4 text-gray-500" />}
      subtitle="Hashtags used on 3+ posts. Bigger = used more, darker = better results. The # menu in captions ranks by these."
    >
      <div className="flex flex-wrap gap-2">
        {tags.map((h) => {
          const strength = Math.max(0, Math.min(1, h.lift / maxLift))
          return (
            <span
              key={h.tag}
              title={`${h.count} posts · ${h.medianEngagementRate.toFixed(1)}% median engagement · ${h.lift.toFixed(2)}× usual`}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 tabular-nums"
              style={{
                fontSize: 12 + (h.count / maxCount) * 5,
                borderColor: strength > 0.6 ? '#86b6ef' : '#e5eaf2',
                background: strength > 0.6 ? '#eaf2fd' : '#f8fafc',
                color: strength > 0.6 ? '#184f95' : '#374151',
              }}
            >
              #{h.tag}
              <span className="text-[11px] text-gray-500">{h.medianEngagementRate.toFixed(1)}%</span>
            </span>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Posts: list / grid / table / timeline                               */
/* ------------------------------------------------------------------ */

type PostsLayout = 'list' | 'grid' | 'table' | 'timeline'
type SortKey = 'date' | 'reach' | 'likes' | 'comments' | 'shares' | 'engagement' | 'rate'

const reachOf = (p: AnalyticsPost) => p.metrics.reach || p.metrics.views
const SORT_VALUE: Record<SortKey, (p: AnalyticsPost) => number> = {
  date: (p) => Date.parse(p.publishedAt),
  reach: reachOf,
  likes: (p) => p.metrics.likes,
  comments: (p) => p.metrics.comments,
  shares: (p) => p.metrics.shares,
  engagement: (p) => p.metrics.engagement,
  rate: (p) => p.metrics.engagementRate,
}

function VsUsual({ rate, median }: { rate: number; median: number }) {
  if (!median) return null
  const vs = rate / median
  return (
    <span
      className={`rounded-full px-1.5 text-xs font-medium ${vs >= 1.2 ? 'bg-emerald-50 text-emerald-700' : vs <= 0.8 ? 'bg-red-50 text-red-700' : 'text-gray-500'}`}
    >
      {vs >= 1 ? `${vs.toFixed(1)}x usual` : `${Math.round((1 - vs) * 100)}% below usual`}
    </span>
  )
}

function PostMeta({ post }: { post: AnalyticsPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
        <span className="h-2 w-2 rounded-full" style={{ background: platformColor(post.platform) }} />
        {platformLabel(post.platform)}
      </span>
      <span>·</span>
      <span>{formatLabel(post.format)}</span>
      <span>·</span>
      <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      {post.isExternal && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200">posted directly</span>}
      {post.url && (
        <a href={post.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
          View <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function PostRow({ post, median }: { post: AnalyticsPost; median: number }) {
  const m = post.metrics
  return (
    <div className="-mx-2 flex items-start gap-3 rounded-xl border-b border-gray-100 px-2 py-3 transition-colors last:border-0 hover:bg-gray-50/70">
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/70">
        {post.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <PostMeta post={post} />
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-gray-800">{post.content || <span className="text-gray-400">No caption</span>}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-gray-500">
          <span>
            {compact.format(reachOf(post))} {m.reach ? 'reach' : 'views'}
          </span>
          <span>{fmt(m.likes)} likes</span>
          <span>{fmt(m.comments)} comments</span>
          {m.shares > 0 && <span>{fmt(m.shares)} shares</span>}
          {m.saves > 0 && <span>{fmt(m.saves)} saves</span>}
          <span className="font-semibold text-gray-900">{m.engagementRate.toFixed(1)}% engagement</span>
          <VsUsual rate={m.engagementRate} median={median} />
        </div>
      </div>
    </div>
  )
}

function PostTile({ post, median }: { post: AnalyticsPost; median: number }) {
  const m = post.metrics
  const vs = median ? m.engagementRate / median : 1
  return (
    <a
      href={post.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-gray-200/80 bg-white transition-shadow hover:shadow-card-hover"
    >
      <div className="relative aspect-square bg-gray-100">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <p className="line-clamp-6 px-3 pb-3 pt-10 text-xs leading-5 text-gray-600">{post.content || 'No caption'}</p>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
            vs >= 1.2 ? 'bg-emerald-600 text-white' : vs <= 0.8 ? 'bg-white/90 text-red-700' : 'bg-white/90 text-gray-800'
          }`}
        >
          {m.engagementRate.toFixed(1)}%
        </span>
        <span
          className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ background: platformColor(post.platform) }}
          title={platformLabel(post.platform)}
        />
      </div>
      <div className="space-y-0.5 p-2.5 text-[11px] tabular-nums text-gray-500">
        <div className="flex justify-between">
          <span>{new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
          <span>{formatLabel(post.format)}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>{compact.format(reachOf(post))} reach</span>
          <span>{fmt(m.engagement)} eng.</span>
        </div>
      </div>
    </a>
  )
}

const TABLE_COLS: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'rate', label: 'Eng. rate' },
]

function downloadCsv(posts: AnalyticsPost[]) {
  const head = ['Published', 'Platform', 'Format', 'Caption', 'Reach', 'Impressions', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks', 'Engagement', 'Engagement rate %', 'URL']
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const rows = posts.map((p) =>
    [
      p.publishedAt,
      platformLabel(p.platform),
      formatLabel(p.format),
      p.content.replace(/\s+/g, ' '),
      p.metrics.reach,
      p.metrics.impressions,
      p.metrics.views,
      p.metrics.likes,
      p.metrics.comments,
      p.metrics.shares,
      p.metrics.saves,
      p.metrics.clicks,
      p.metrics.engagement,
      p.metrics.engagementRate,
      p.url ?? '',
    ]
      .map(esc)
      .join(',')
  )
  const blob = new Blob([[head.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `post-results-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PostsView({ posts, median, rangeLabel }: { posts: AnalyticsPost[]; median: number; rangeLabel: string }) {
  const [layout, setLayout] = useState<PostsLayout>('list')
  const [platform, setPlatform] = useState<string>('all')
  const [format, setFormat] = useState<string>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })

  const platforms = useMemo(() => [...new Set(posts.map((p) => p.platform))], [posts])
  const formats = useMemo(() => [...new Set(posts.map((p) => p.format))], [posts])
  const shown = useMemo(() => {
    const fn = SORT_VALUE[sort.key]
    return posts
      .filter((p) => (platform === 'all' || p.platform === platform) && (format === 'all' || p.format === format))
      .sort((a, b) => (sort.dir === 'desc' ? fn(b) - fn(a) : fn(a) - fn(b)))
  }, [posts, platform, format, sort])

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  const selectCls =
    'h-8 rounded-lg border border-gray-200/80 bg-white px-2 text-xs font-medium text-gray-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <Card
      title={`Posts in the last ${rangeLabel}`}
      icon={<BarChart3 className="h-4 w-4 text-gray-500" />}
      subtitle={`${shown.length} of ${posts.length} posts`}
      action={
        <Segmented
          label="Posts layout"
          value={layout}
          onChange={setLayout}
          options={[
            { key: 'list', label: 'List', icon: <List /> },
            { key: 'grid', label: 'Grid', icon: <LayoutGrid /> },
            { key: 'table', label: 'Table', icon: <Table2 /> },
            { key: 'timeline', label: 'Timeline', icon: <ScatterChart /> },
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select aria-label="Platform" className={selectCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
        <select aria-label="Format" className={selectCls} value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="all">All formats</option>
          {formats.map((f) => (
            <option key={f} value={f}>
              {formatLabel(f)}
            </option>
          ))}
        </select>
        {layout !== 'table' && layout !== 'timeline' && (
          <select
            aria-label="Sort by"
            className={selectCls}
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']
              setSort({ key, dir })
            }}
          >
            <option value="date:desc">Newest first</option>
            <option value="date:asc">Oldest first</option>
            <option value="rate:desc">Best engagement rate</option>
            <option value="rate:asc">Lowest engagement rate</option>
            <option value="reach:desc">Most reach</option>
            <option value="engagement:desc">Most engagements</option>
            <option value="comments:desc">Most comments</option>
          </select>
        )}
        <button
          onClick={() => downloadCsv(shown)}
          disabled={!shown.length}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {!shown.length ? (
        <p className="text-sm text-gray-500">No posts match in this period.</p>
      ) : layout === 'list' ? (
        <div>
          {shown.map((p) => (
            <PostRow key={p.id} post={p} median={median} />
          ))}
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((p) => (
            <PostTile key={p.id} post={p} median={median} />
          ))}
        </div>
      ) : layout === 'timeline' ? (
        <PostTimeline posts={shown} median={median} />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-medium">Post</th>
                {TABLE_COLS.map((c) => (
                  <th key={c.key} className={`py-2 pl-3 font-medium ${c.key === 'date' ? '' : 'text-right'}`}>
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-0.5 hover:text-gray-900">
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const vs = median ? p.metrics.engagementRate / median : 1
                return (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                    <td className="max-w-[280px] py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {p.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="h-2 w-2 rounded-full" style={{ background: platformColor(p.platform) }} />
                            {platformLabel(p.platform)} · {formatLabel(p.format)}
                          </div>
                          <p className="truncate text-gray-800">
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">
                                {p.content || 'No caption'}
                              </a>
                            ) : (
                              p.content || 'No caption'
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-2 pl-3 text-gray-600">
                      {new Date(p.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">{compact.format(reachOf(p))}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{fmt(p.metrics.likes)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{fmt(p.metrics.comments)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{fmt(p.metrics.shares)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{fmt(p.metrics.engagement)}</td>
                    <td className="py-2 pl-3 text-right">
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-medium tabular-nums ${
                          vs >= 1.2 ? 'bg-emerald-50 text-emerald-700' : vs <= 0.8 ? 'bg-red-50 text-red-700' : 'text-gray-900'
                        }`}
                      >
                        {p.metrics.engagementRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {median > 0 && <p className="mt-3 text-[11px] text-gray-400">Compared with this client&apos;s usual (median) engagement rate of {median}%.</p>}
    </Card>
  )
}
