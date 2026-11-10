import logger from '@/lib/logger'
import type { AnalyticsDashboard, AnalyticsPost, DashboardTotals, PostMetrics } from './types'

// Read-only calls to Zernio's (LATE's) Analytics API. Zernio syncs metrics from the
// platforms about hourly and serves them from its own store, so these are cheap,
// but they are rate limited — callers cache results (see ./store.ts).

const BASE = 'https://getlate.dev/api/v1'
const TIMEOUT_MS = 20_000

export class ZernioAnalyticsError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
  /** 402/403: the Zernio plan doesn't include analytics */
  get unavailable() {
    return this.status === 402 || this.status === 403
  }
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) throw new ZernioAnalyticsError('LATE_API_KEY is not configured', 500)
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status !== 402) logger.error('Zernio analytics error', { path, status: res.status, body: body.slice(0, 500) })
    throw new ZernioAnalyticsError(`Zernio analytics ${path} failed (${res.status})`, res.status)
  }
  return (await res.json()) as T
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function toMetrics(raw: Record<string, unknown> | null | undefined): PostMetrics {
  const m = raw ?? {}
  const likes = num(m.likes)
  const comments = num(m.comments)
  const shares = num(m.shares)
  const saves = num(m.saves)
  const impressions = num(m.impressions)
  const reach = num(m.reach)
  const views = num(m.views)
  const engagement = likes + comments + shares + saves
  const denominator = impressions || reach || views
  const engagementRate =
    typeof m.engagementRate === 'number' ? m.engagementRate : denominator ? (engagement / denominator) * 100 : 0
  return { impressions, reach, likes, comments, shares, saves, views, clicks: num(m.clicks), engagement, engagementRate }
}

function formatOf(raw: Record<string, unknown>): string {
  const product = String(raw.mediaProductType ?? '').toUpperCase()
  if (product === 'REELS') return 'reel'
  if (product === 'STORY') return 'story'
  const type = String(raw.mediaType ?? '')
  if (type === 'carousel' || type === 'image' || type === 'video' || type === 'text') return type
  return 'image'
}

interface ListResponse {
  posts?: Array<Record<string, unknown>>
  pagination?: { total?: number }
}

/**
 * Published posts (through the app and made directly on the platforms) from the last
 * `days`, newest first. A post published to several platforms becomes one entry per
 * platform with that platform's metrics.
 */
export async function fetchPublishedPosts(profileId: string, days = 365, maxPages = 10): Promise<AnalyticsPost[]> {
  const to = new Date()
  const from = new Date(to.getTime() - (Math.min(days, 366) - 1) * 86_400_000)
  const out: AnalyticsPost[] = []
  const pageSize = 100

  for (let page = 1; page <= maxPages; page++) {
    const data = await get<ListResponse>('/analytics', {
      profileId,
      source: 'all',
      fromDate: day(from),
      toDate: day(to),
      sortBy: 'date',
      order: 'desc',
      limit: String(pageSize),
      page: String(page),
    })
    const posts = Array.isArray(data.posts) ? data.posts : []
    for (const p of posts) {
      const publishedAt = typeof p.publishedAt === 'string' ? p.publishedAt : null
      if (!publishedAt) continue
      const base = {
        latePostId: typeof p.latePostId === 'string' ? p.latePostId : null,
        publishedAt,
        content: typeof p.content === 'string' ? p.content.slice(0, 700) : '',
        thumbnailUrl: typeof p.thumbnailUrl === 'string' ? p.thumbnailUrl : null,
        format: formatOf(p),
        isExternal: p.isExternal === true,
      }
      const id = String(p._id ?? p.postId ?? '')
      const perPlatform = Array.isArray(p.platformAnalytics)
        ? (p.platformAnalytics as Array<Record<string, unknown>>).filter(
            (pa) => pa && pa.status !== 'failed' && pa.analytics
          )
        : []
      if (perPlatform.length > 1) {
        for (const pa of perPlatform) {
          out.push({
            ...base,
            id: `${id}:${pa.platform}`,
            platform: String(pa.platform ?? p.platform ?? 'unknown'),
            url: typeof pa.platformPostUrl === 'string' ? pa.platformPostUrl : null,
            metrics: toMetrics(pa.analytics as Record<string, unknown>),
          })
        }
      } else {
        out.push({
          ...base,
          id,
          platform: String(p.platform ?? perPlatform[0]?.platform ?? 'unknown'),
          url: typeof p.platformPostUrl === 'string' ? p.platformPostUrl : null,
          metrics: toMetrics((p.analytics as Record<string, unknown>) ?? (perPlatform[0]?.analytics as Record<string, unknown>)),
        })
      }
    }
    const total = data.pagination?.total
    if (posts.length < pageSize || (typeof total === 'number' && page * pageSize >= total)) break
  }
  return out
}

/** Zernio's best posting slots (UTC; day 0 = Monday). */
export async function fetchBestTimes(
  profileId: string
): Promise<Array<{ day: number; hour: number; avgEngagement: number; postCount: number }>> {
  const data = await get<{ slots?: Array<Record<string, unknown>> }>('/analytics/best-time', { profileId })
  return (data.slots ?? []).map((s) => ({
    day: num(s.day_of_week),
    hour: num(s.hour),
    avgEngagement: num(s.avg_engagement),
    postCount: num(s.post_count),
  }))
}

function toTotals(raw: unknown): DashboardTotals {
  const t = (raw ?? {}) as Record<string, unknown>
  return {
    impressions: num(t.impressions),
    reach: num(t.reach),
    likes: num(t.likes),
    comments: num(t.comments),
    shares: num(t.shares),
    saves: num(t.saves),
    clicks: num(t.clicks),
    views: num(t.views),
    engagementRate: num(t.engagementRate),
  }
}

/** Totals, follower growth and a daily series for the last `days` (plus the period before). */
export async function fetchDashboard(profileId: string, days: number): Promise<AnalyticsDashboard> {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * 86_400_000)
  return fetchDashboardRange(profileId, day(from), day(to))
}

/** The same for fixed dates (YYYY-MM-DD, inclusive), e.g. a calendar month. */
export async function fetchDashboardRange(profileId: string, fromDate: string, toDate: string): Promise<AnalyticsDashboard> {
  const data = await get<Record<string, unknown>>('/analytics/dashboard', {
    profileId,
    fromDate,
    toDate,
    compare: 'previous_period',
    topPosts: '0',
    recentPosts: '0',
  })
  const followers = (data.followers ?? {}) as Record<string, unknown>
  const prevFollowers = data.previousFollowers as Record<string, unknown> | undefined
  return {
    fromDate,
    toDate,
    totals: toTotals(data.totals),
    previousTotals: data.previousTotals ? toTotals(data.previousTotals) : null,
    followers: { current: num(followers.current), gained: num(followers.gained) },
    previousFollowers: prevFollowers ? { current: num(prevFollowers.current), gained: num(prevFollowers.gained) } : null,
    daily: Array.isArray(data.daily)
      ? (data.daily as Array<Record<string, unknown>>).map((d) => ({
          date: String(d.date),
          impressions: num(d.impressions),
          reach: num(d.reach),
          engagement: num(d.engagement),
          views: num(d.views),
          followersGained: num(d.followersGained),
        }))
      : [],
    dataAsOf: typeof data.dataAsOf === 'string' ? data.dataAsOf : null,
  }
}
