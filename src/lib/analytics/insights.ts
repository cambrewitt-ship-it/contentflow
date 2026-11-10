import { extractHashtags } from '@/lib/captionLibrary'
import type { AnalyticsPost, BestTimeSlot, GroupStat, HashtagStat, PerformanceInsights } from './types'

// What works for a client, computed from their published posts' real results.
// Deterministic and cheap: recomputed whenever the analytics snapshot refreshes,
// shown on the Analytics page and fed to every caption/agent prompt so the AI keeps
// learning from results. Findings only claim a difference when both sides have
// enough posts and the gap is meaningful, so small accounts don't get noise.

const MIN_GROUP = 3
const MIN_LIFT = 0.15
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FORMAT_LABELS: Record<string, string> = {
  reel: 'Reels',
  carousel: 'Carousels',
  image: 'Single photos',
  video: 'Videos',
  story: 'Stories',
  text: 'Text posts',
}
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'X',
  threads: 'Threads',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

/** Day (0 = Monday) and hour of a moment in a timezone. */
export function localDayHour(iso: string | Date, timeZone: string): { day: number; hour: number } {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date)
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
    return { day: Math.max(0, SHORT_DAYS.indexOf(wd)), hour }
  } catch {
    return { day: (date.getUTCDay() + 6) % 7, hour: date.getUTCHours() }
  }
}

export function formatHour(hour: number): string {
  const h = hour % 12 || 12
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

export function slotLabel(slot: { day: number; hour: number }): string {
  return `${DAYS[slot.day]} ${formatHour(slot.hour)}`
}

function timeOfDay(hour: number): { key: string; label: string } {
  if (hour >= 5 && hour < 11) return { key: 'morning', label: 'Morning (5–11am)' }
  if (hour >= 11 && hour < 14) return { key: 'midday', label: 'Midday (11am–2pm)' }
  if (hour >= 14 && hour < 17) return { key: 'afternoon', label: 'Afternoon (2–5pm)' }
  if (hour >= 17 && hour < 21) return { key: 'evening', label: 'Evening (5–9pm)' }
  return { key: 'night', label: 'Night (9pm–5am)' }
}

function captionLength(content: string): { key: string; label: string } {
  const n = content.trim().length
  if (n < 125) return { key: 'short', label: 'Short (under 125 characters)' }
  if (n <= 400) return { key: 'medium', label: 'Medium (125–400 characters)' }
  return { key: 'long', label: 'Long (over 400 characters)' }
}

function hashtagCount(content: string): { key: string; label: string } {
  const n = extractHashtags(content).length
  if (n === 0) return { key: '0', label: 'No hashtags' }
  if (n <= 5) return { key: '1-5', label: '1–5 hashtags' }
  if (n <= 15) return { key: '6-15', label: '6–15 hashtags' }
  return { key: '16+', label: '16+ hashtags' }
}

function groupBy(
  posts: AnalyticsPost[],
  keyOf: (p: AnalyticsPost) => { key: string; label: string },
  baselineEr: number
): GroupStat[] {
  const groups = new Map<string, { label: string; posts: AnalyticsPost[] }>()
  for (const p of posts) {
    const { key, label } = keyOf(p)
    const g = groups.get(key) ?? { label, posts: [] }
    g.posts.push(p)
    groups.set(key, g)
  }
  return Array.from(groups, ([key, g]) => {
    const er = median(g.posts.map((p) => p.metrics.engagementRate))
    return {
      key,
      label: g.label,
      count: g.posts.length,
      medianEngagementRate: round(er),
      medianReach: Math.round(median(g.posts.map((p) => p.metrics.reach || p.metrics.views))),
      lift: baselineEr ? round(er / baselineEr) : 0,
    }
  }).sort((a, b) => b.medianEngagementRate - a.medianEngagementRate)
}

/** "2.1x" / "40% more" style wording for a lift. */
function liftText(lift: number): string {
  if (lift >= 1.95) return `${round(lift, 1)}x the`
  return `${Math.round((lift - 1) * 100)}% more`
}

/** Convert Zernio's UTC slots to the client's timezone. */
export function localiseSlots(
  slots: Array<{ day: number; hour: number; avgEngagement: number; postCount: number }>,
  timeZone: string
): BestTimeSlot[] {
  // 2024-01-01 was a Monday; any week works for converting a weekly UTC slot
  return slots.map((s) => {
    const utc = new Date(Date.UTC(2024, 0, 1 + s.day, s.hour))
    return { ...localDayHour(utc, timeZone), avgEngagement: round(s.avgEngagement, 1), postCount: s.postCount }
  })
}

export function computeInsights(
  allPosts: AnalyticsPost[],
  bestTimeSlots: BestTimeSlot[],
  timeZone: string,
  now = new Date()
): PerformanceInsights {
  // Stories have no lasting engagement and skew everything — leave them out
  const posts = allPosts.filter((p) => p.format !== 'story')
  const ers = posts.map((p) => p.metrics.engagementRate)
  const baselineEr = median(ers)
  const baseline = {
    medianEngagementRate: round(baselineEr),
    medianReach: Math.round(median(posts.map((p) => p.metrics.reach || p.metrics.views))),
    medianEngagement: Math.round(median(posts.map((p) => p.metrics.engagement))),
  }

  const firstAt = posts.length ? Math.min(...posts.map((p) => Date.parse(p.publishedAt))) : now.getTime()
  const weeks = Math.max(1, (now.getTime() - firstAt) / (7 * 86_400_000))
  const postsPerWeek = round(posts.length / weeks, 1)

  const byFormat = groupBy(posts, (p) => ({ key: p.format, label: FORMAT_LABELS[p.format] ?? p.format }), baselineEr)
  const byPlatform = groupBy(
    posts,
    (p) => ({ key: p.platform, label: PLATFORM_LABELS[p.platform] ?? p.platform }),
    baselineEr
  )
  const byDay = groupBy(
    posts,
    (p) => {
      const { day } = localDayHour(p.publishedAt, timeZone)
      return { key: String(day), label: DAYS[day] }
    },
    baselineEr
  )
  const byTimeOfDay = groupBy(posts, (p) => timeOfDay(localDayHour(p.publishedAt, timeZone).hour), baselineEr)
  const byCaptionLength = groupBy(posts, (p) => captionLength(p.content), baselineEr)
  const byHashtagCount = groupBy(posts, (p) => hashtagCount(p.content), baselineEr)

  // Hashtags used on at least 3 posts, by the engagement of the posts that used them
  const tagPosts = new Map<string, { tag: string; ers: number[] }>()
  for (const p of posts) {
    for (const t of new Set(extractHashtags(p.content))) {
      const key = t.toLowerCase()
      const e = tagPosts.get(key) ?? { tag: t, ers: [] }
      e.ers.push(p.metrics.engagementRate)
      tagPosts.set(key, e)
    }
  }
  const hashtags: HashtagStat[] = Array.from(tagPosts.values())
    .filter((t) => t.ers.length >= MIN_GROUP)
    .map((t) => {
      const er = median(t.ers)
      return { tag: t.tag, count: t.ers.length, medianEngagementRate: round(er), lift: baselineEr ? round(er / baselineEr) : 0 }
    })
    .sort((a, b) => b.medianEngagementRate - a.medianEngagementRate)

  const ranked = [...posts]
    .filter((p) => (p.metrics.impressions || p.metrics.reach || p.metrics.views) > 0)
    .sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate)
  const topPosts = ranked.slice(0, 5)
  const weakPosts = ranked.length >= 10 ? ranked.slice(-3).reverse() : []

  const dayMs = 86_400_000
  const inWindow = (from: number, to: number) =>
    posts.filter((p) => {
      const t = Date.parse(p.publishedAt)
      return t >= from && t < to
    })
  const recent = inWindow(now.getTime() - 30 * dayMs, now.getTime() + dayMs)
  const previous = inWindow(now.getTime() - 60 * dayMs, now.getTime() - 30 * dayMs)
  const windowStats = (ps: AnalyticsPost[]) => ({
    posts: ps.length,
    medianEngagementRate: round(median(ps.map((p) => p.metrics.engagementRate))),
    engagement: ps.reduce((sum, p) => sum + p.metrics.engagement, 0),
  })

  const bestSlots = [...bestTimeSlots]
    .filter((s) => s.postCount >= 2)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5)

  const insights: PerformanceInsights = {
    generatedAt: now.toISOString(),
    timezone: timeZone,
    postCount: posts.length,
    postsPerWeek,
    baseline,
    byFormat,
    byPlatform,
    byDay,
    byTimeOfDay,
    byCaptionLength,
    byHashtagCount,
    hashtags,
    bestSlots,
    topPosts,
    weakPosts,
    trend: { recent: windowStats(recent), previous: windowStats(previous) },
    findings: [],
  }
  insights.findings = findingsFor(insights)
  return insights
}

/** Strongest group vs the weakest comparable group, if the gap is real. */
function contrast(groups: GroupStat[]): { best: GroupStat; worst: GroupStat; ratio: number } | null {
  const solid = groups.filter((g) => g.count >= MIN_GROUP)
  if (solid.length < 2) return null
  const best = solid[0]
  const worst = solid[solid.length - 1]
  if (!worst.medianEngagementRate) return null
  const ratio = best.medianEngagementRate / worst.medianEngagementRate
  return ratio >= 1 + MIN_LIFT ? { best, worst, ratio } : null
}

function findingsFor(i: PerformanceInsights): string[] {
  const out: string[] = []
  if (i.postCount < 5) return out

  const format = contrast(i.byFormat)
  if (format) {
    out.push(
      `${format.best.label} get ${liftText(format.ratio)} engagement of ${format.worst.label.toLowerCase()} (median ${format.best.medianEngagementRate}% vs ${format.worst.medianEngagementRate}%).`
    )
  }

  const tod = contrast(i.byTimeOfDay)
  if (tod) {
    out.push(
      `Posts in the ${tod.best.label.split(' (')[0].toLowerCase()} do best (median ${tod.best.medianEngagementRate}% vs ${tod.worst.medianEngagementRate}% at ${tod.worst.label.split(' (')[0].toLowerCase()}).`
    )
  }

  const days = i.byDay.filter((g) => g.count >= MIN_GROUP && g.lift >= 1 + MIN_LIFT).slice(0, 2)
  if (days.length) {
    out.push(`${days.map((d) => d.label).join(' and ')} ${days.length > 1 ? 'are' : 'is'} the strongest day${days.length > 1 ? 's' : ''} to post.`)
  }

  if (i.bestSlots.length) {
    out.push(`Best time slots so far: ${i.bestSlots.slice(0, 3).map(slotLabel).join(', ')}.`)
  }

  const length = contrast(i.byCaptionLength)
  if (length) {
    out.push(`${length.best.label.split(' (')[0]} captions outperform ${length.worst.label.split(' (')[0].toLowerCase()} ones (median ${length.best.medianEngagementRate}% vs ${length.worst.medianEngagementRate}%).`)
  }

  const tags = contrast(i.byHashtagCount)
  if (tags) {
    out.push(`Posts with ${tags.best.label.toLowerCase()} do better than posts with ${tags.worst.label.toLowerCase()}.`)
  }

  const goodTags = i.hashtags.filter((h) => h.lift >= 1 + MIN_LIFT).slice(0, 6)
  if (goodTags.length) out.push(`Hashtags on the best-performing posts: ${goodTags.map((h) => `#${h.tag}`).join(' ')}.`)

  const { recent, previous } = i.trend
  if (recent.posts >= MIN_GROUP && previous.posts >= MIN_GROUP && previous.medianEngagementRate) {
    const change = recent.medianEngagementRate / previous.medianEngagementRate - 1
    if (Math.abs(change) >= MIN_LIFT) {
      out.push(
        `Engagement is ${change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% over the last 30 days compared with the 30 before.`
      )
    }
  }
  if (recent.posts < previous.posts * 0.6 && previous.posts >= 4) {
    out.push(`Posting has slowed: ${recent.posts} posts in the last 30 days vs ${previous.posts} the month before.`)
  }
  return out
}

/**
 * Compact "what works for this account" section for AI prompts. Guidance, not rules:
 * brand voice and the caption playbook still win.
 */
export function formatPerformancePrompt(i: PerformanceInsights | null | undefined): string {
  if (!i || i.postCount < 5) return ''
  const lines: string[] = [
    `📈 PERFORMANCE LEARNINGS (from ${i.postCount} published posts with real results — median engagement ${i.baseline.medianEngagementRate}%):`,
    ...i.findings.map((f) => `- ${f}`),
  ]
  const seen = new Set<string>()
  const top = i.topPosts
    .filter((p) => {
      const key = p.content.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
  if (top.length) {
    lines.push('Best-performing captions (learn from what made them work — never copy them):')
    top.forEach((p, n) =>
      lines.push(`${n + 1}. [${p.metrics.engagementRate.toFixed(1)}% engagement, ${p.format}] "${p.content.replace(/\s+/g, ' ').slice(0, 280)}"`)
    )
  }
  const weak = i.weakPosts.filter((p) => p.content.trim()).slice(0, 2)
  if (weak.length) {
    lines.push('Weakest captions (avoid what held these back):')
    weak.forEach((p) => lines.push(`- [${p.metrics.engagementRate.toFixed(1)}%] "${p.content.replace(/\s+/g, ' ').slice(0, 160)}"`))
  }
  lines.push('Use these learnings to lean into what works. Brand voice, tone of voice and caption rules take priority.')
  return lines.join('\n')
}
