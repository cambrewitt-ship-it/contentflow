import { localDayHour, median } from './insights'
import type { AnalyticsPost, BestTimeSlot } from './types'

// Shapes the analytics snapshot into what the charts draw: day × hour heatmaps,
// a daily activity calendar, platform/format splits and per-weekday columns.
// Pure and browser-safe (used by the Analytics page and the client overview).

export const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'X',
  threads: 'Threads',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  googlebusiness: 'Google Business',
  bluesky: 'Bluesky',
}

export const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reels',
  carousel: 'Carousels',
  image: 'Single photos',
  video: 'Videos',
  story: 'Stories',
  text: 'Text posts',
}

// Categorical colours follow the entity, never its rank: each platform / format
// always gets the same slot, so filtering never repaints the survivors.
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const PLATFORM_SLOTS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'threads', 'youtube', 'pinterest']
const FORMAT_SLOTS = ['image', 'carousel', 'reel', 'video', 'text', 'story']
export const OTHER_COLOR = '#a3a29c'

export function platformColor(platform: string): string {
  const i = PLATFORM_SLOTS.indexOf(platform)
  return i >= 0 ? CATEGORICAL[i] : OTHER_COLOR
}
export function formatColor(format: string): string {
  const i = FORMAT_SLOTS.indexOf(format)
  return i >= 0 ? CATEGORICAL[i] : OTHER_COLOR
}
export const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1)
export const formatLabel = (f: string) => FORMAT_LABELS[f] ?? f.charAt(0).toUpperCase() + f.slice(1)

/** Sequential blue ramp (light → dark) for heatmaps. */
export const SEQUENTIAL = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
export const EMPTY_CELL = '#f1f3f7'

/** Colour for t in 0..1 on the sequential ramp. */
export function sequentialColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor(clamped * SEQUENTIAL.length))]
}

export function postsSince(posts: AnalyticsPost[], days: number, now = Date.now()): AnalyticsPost[] {
  const since = now - days * 86_400_000
  return posts.filter((p) => Date.parse(p.publishedAt) >= since)
}

export interface HeatCell {
  day: number
  hour: number
  /** The value the colour encodes (see HeatmapMode) */
  value: number
  posts: number
  medianEngagementRate: number
  avgEngagement: number
}

export type HeatmapMode = 'rate' | 'engagement' | 'posts'

/** 7 × 24 grid of the client's own posts by local publish day and hour. */
export function postHeatmap(posts: AnalyticsPost[], timeZone: string, mode: HeatmapMode): HeatCell[] {
  const buckets = new Map<number, AnalyticsPost[]>()
  for (const p of posts) {
    const { day, hour } = localDayHour(p.publishedAt, timeZone)
    const key = day * 24 + hour
    const list = buckets.get(key)
    if (list) list.push(p)
    else buckets.set(key, [p])
  }
  const cells: HeatCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const list = buckets.get(day * 24 + hour) ?? []
      const rate = list.length ? median(list.map((p) => p.metrics.engagementRate)) : 0
      const avg = list.length ? list.reduce((s, p) => s + p.metrics.engagement, 0) / list.length : 0
      cells.push({
        day,
        hour,
        posts: list.length,
        medianEngagementRate: Math.round(rate * 100) / 100,
        avgEngagement: Math.round(avg * 10) / 10,
        value: mode === 'posts' ? list.length : mode === 'rate' ? rate : avg,
      })
    }
  }
  return cells
}

/** The strongest cell, preferring slots with 2+ posts so a single lucky post doesn't win. */
export function bestCell(cells: HeatCell[]): HeatCell | null {
  const pick = (list: HeatCell[]) => list.reduce<HeatCell | null>((a, b) => (b.value > 0 && (!a || b.value > a.value) ? b : a), null)
  return pick(cells.filter((c) => c.posts >= 2)) ?? pick(cells)
}

/** Zernio's best-time slots (all of them) as a 7 × 24 grid. */
export function slotHeatmap(slots: BestTimeSlot[]): HeatCell[] {
  const bySlot = new Map<number, BestTimeSlot>()
  for (const s of slots) {
    const key = s.day * 24 + s.hour
    const prev = bySlot.get(key)
    // Timezone conversion can fold two UTC slots into one local hour; keep the stronger
    if (!prev || s.avgEngagement > prev.avgEngagement) bySlot.set(key, s)
  }
  const cells: HeatCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const s = bySlot.get(day * 24 + hour)
      cells.push({
        day,
        hour,
        posts: s?.postCount ?? 0,
        medianEngagementRate: 0,
        avgEngagement: s?.avgEngagement ?? 0,
        value: s?.avgEngagement ?? 0,
      })
    }
  }
  return cells
}

export interface DayActivity {
  /** YYYY-MM-DD in the client's timezone */
  date: string
  posts: number
  engagement: number
  reach: number
}

export function localDateKey(iso: string | Date, timeZone: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** Posts and their results per local day. */
export function dailyActivity(posts: AnalyticsPost[], timeZone: string): Map<string, DayActivity> {
  const out = new Map<string, DayActivity>()
  for (const p of posts) {
    const date = localDateKey(p.publishedAt, timeZone)
    const row = out.get(date) ?? { date, posts: 0, engagement: 0, reach: 0 }
    row.posts += 1
    row.engagement += p.metrics.engagement
    row.reach += p.metrics.reach || p.metrics.views
    out.set(date, row)
  }
  return out
}

export interface Slice {
  key: string
  label: string
  color: string
  value: number
  posts: number
}

export type SplitMeasure = 'posts' | 'reach' | 'engagement'

function measureOf(p: AnalyticsPost, m: SplitMeasure): number {
  if (m === 'posts') return 1
  if (m === 'reach') return p.metrics.reach || p.metrics.views
  return p.metrics.engagement
}

/** Share of posts / reach / engagement by a dimension, largest first; more than 6 groups fold into "Other". */
export function split(posts: AnalyticsPost[], by: 'platform' | 'format', measure: SplitMeasure): Slice[] {
  const groups = new Map<string, Slice>()
  for (const p of posts) {
    const key = by === 'platform' ? p.platform : p.format || 'other'
    const g =
      groups.get(key) ??
      ({
        key,
        label: by === 'platform' ? platformLabel(key) : formatLabel(key),
        color: by === 'platform' ? platformColor(key) : formatColor(key),
        value: 0,
        posts: 0,
      } satisfies Slice)
    g.value += measureOf(p, measure)
    g.posts += 1
    groups.set(key, g)
  }
  const sorted = [...groups.values()].sort((a, b) => b.value - a.value)
  if (sorted.length <= 6) return sorted
  const rest = sorted.slice(5)
  return [
    ...sorted.slice(0, 5),
    {
      key: 'other',
      label: 'Other',
      color: OTHER_COLOR,
      value: rest.reduce((s, g) => s + g.value, 0),
      posts: rest.reduce((s, g) => s + g.posts, 0),
    },
  ]
}

export interface WeekdayStat {
  day: number
  label: string
  posts: number
  medianEngagementRate: number
}

export function weekdayStats(posts: AnalyticsPost[], timeZone: string): WeekdayStat[] {
  const rates: number[][] = Array.from({ length: 7 }, () => [])
  for (const p of posts) rates[localDayHour(p.publishedAt, timeZone).day].push(p.metrics.engagementRate)
  return rates.map((r, day) => ({
    day,
    label: SHORT_DAYS[day],
    posts: r.length,
    medianEngagementRate: Math.round(median(r) * 100) / 100,
  }))
}

/** Engagement rate per post over time, for the post-performance timeline. */
export function postTimeline(posts: AnalyticsPost[]) {
  return [...posts]
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))
    .map((p) => ({ post: p, t: Date.parse(p.publishedAt), rate: p.metrics.engagementRate, reach: p.metrics.reach || p.metrics.views }))
}
