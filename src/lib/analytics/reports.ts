import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { completionParams } from '@/lib/openaiParams'
import { median } from './insights'
import { refreshSnapshot } from './store'
import { fetchDashboardRange, ZernioAnalyticsError } from './zernio'
import type { AnalyticsDashboard, AnalyticsPost } from './types'
import type { ReportData, ReportListItem, ReportSummary } from './reportTypes'

// Monthly client reports: the month's numbers from Zernio, the month's posts from the
// analytics snapshot, and a plain-English summary written for the business owner.
// Stored frozen in client_reports (migration 035) with a share token for a no-login link.

const TABLE = 'client_reports'
export const REPORTS_SETUP_MESSAGE = 'Reports need a one-off database update (migrations/035-client-reports.sql).'
const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01'

export class ReportError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { start: string; end: string; label: string } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  return {
    start: ymd(start),
    end: ymd(end),
    label: start.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

/** "YYYY-MM" of the month before `now`. */
export function previousMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7)
}

const engagementOf = (t: { likes: number; comments: number; shares: number; saves: number }) =>
  t.likes + t.comments + t.shares + t.saves

const pct = (now: number, before: number | undefined | null) =>
  before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : 'n/a'

function fallbackSummary(d: Omit<ReportData, 'summary' | 'generatedAt'>): ReportSummary {
  const reach = d.totals?.reach ?? 0
  const gained = d.followers?.gained ?? 0
  return {
    headline: `${d.periodLabel}: ${d.postCount} posts, ${reach.toLocaleString()} people reached`,
    overview: `We published ${d.postCount} posts in ${d.periodLabel}, reaching ${reach.toLocaleString()} people${
      gained ? ` and ${gained > 0 ? 'gaining' : 'losing'} ${Math.abs(gained).toLocaleString()} followers` : ''
    }.`,
    wins: d.topPosts
      .slice(0, 2)
      .map(
        (p, n) =>
          `${n === 0 ? 'Your top post' : 'Your next best post'} on ${p.platform.charAt(0).toUpperCase()}${p.platform.slice(1)} reached ${(
            p.metrics.reach || p.metrics.views
          ).toLocaleString()} people and got ${p.metrics.likes.toLocaleString()} likes.`
      ),
    nextMonth: [],
  }
}

async function writeSummary(
  d: Omit<ReportData, 'summary' | 'generatedAt'>,
  plans: string[]
): Promise<ReportSummary> {
  if (!process.env.OPENAI_API_KEY) return fallbackSummary(d)
  const facts = {
    business: d.clientName,
    month: d.periodLabel,
    posts_published: d.postCount,
    reach: d.totals?.reach,
    reach_change_vs_previous_month: pct(d.totals?.reach ?? 0, d.previousTotals?.reach),
    impressions: d.totals?.impressions,
    engagements: d.totals ? engagementOf(d.totals) : null,
    engagement_change: d.totals ? pct(engagementOf(d.totals), d.previousTotals ? engagementOf(d.previousTotals) : null) : 'n/a',
    engagement_rate_percent: d.totals?.engagementRate,
    followers_now: d.followers?.current,
    followers_gained: d.followers?.gained,
    followers_gained_previous_month: d.previousFollowers?.gained,
    by_platform: d.byPlatform,
    by_format: d.byFormat,
    top_posts: d.topPosts.map((p) => ({
      platform: p.platform,
      format: p.format,
      reach: p.metrics.reach || p.metrics.views,
      likes: p.metrics.likes,
      comments: p.metrics.comments,
      caption: p.content.slice(0, 160),
    })),
    planned_focus_from_analytics: plans,
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 900, temperature: 0.4 }),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write the monthly social media report a marketing agency sends its client, a small business owner.
Plain English, warm and confident, no jargon ("engagement rate" is fine, "impressions" needs no explanation, never "KPIs" or "algorithm").
Use ONLY the numbers given — never invent figures. Be honest about dips but frame what's being done about them.
Return JSON: {"headline": "max 90 chars, the month in one line", "overview": "2-3 sentences",
"wins": ["2-3 specific highlights citing numbers or top posts"], "next_month": ["2-3 concrete things we'll focus on next month, based on planned_focus_from_analytics and the results"]}`,
        },
        { role: 'user', content: JSON.stringify(facts) },
      ],
    })
    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}') as Record<string, unknown>
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, 4) : [])
    if (typeof raw.headline !== 'string' || typeof raw.overview !== 'string') return fallbackSummary(d)
    return {
      headline: raw.headline.slice(0, 120),
      overview: raw.overview.slice(0, 800),
      wins: list(raw.wins),
      nextMonth: list(raw.next_month),
    }
  } catch (err) {
    logger.error('Report summary failed:', err)
    return fallbackSummary(d)
  }
}

/** Build (or rebuild) the report for one client and month ("YYYY-MM"), and store it. */
export async function generateReport(
  admin: SupabaseClient,
  clientId: string,
  month: string,
  userId: string | null
): Promise<{ id: string; shareToken: string; data: ReportData }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ReportError('Pick a month')
  const { start, end, label } = monthRange(month)
  if (start > new Date().toISOString().slice(0, 10)) throw new ReportError("That month hasn't started yet")

  const { data: client } = await admin
    .from('clients')
    .select('name, logo_url, late_profile_id')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) throw new ReportError('Client not found', 404)
  if (!client.late_profile_id) throw new ReportError('Connect a social account first — reports are built from its results.')

  let dashboard: AnalyticsDashboard | null = null
  try {
    dashboard = await fetchDashboardRange(client.late_profile_id, start, end)
  } catch (err) {
    if (err instanceof ZernioAnalyticsError && err.unavailable) {
      throw new ReportError("Your Zernio plan doesn't include analytics, so there are no results to report.", 402)
    }
    throw new ReportError("Couldn't read results from Zernio just now. Try again in a minute.", 502)
  }

  // Fresh posts for the month (the snapshot keeps a year)
  const snapshot = await refreshSnapshot(admin, clientId)
  const allPosts: AnalyticsPost[] = snapshot === 'missing_table' ? [] : snapshot.posts
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T23:59:59Z`)
  const posts = allPosts.filter((p) => {
    const t = Date.parse(p.publishedAt)
    return t >= startMs && t <= endMs && p.format !== 'story'
  })

  const byPlatform = new Map<string, { posts: number; engagement: number }>()
  const byFormat = new Map<string, number[]>()
  for (const p of posts) {
    const pl = byPlatform.get(p.platform) ?? { posts: 0, engagement: 0 }
    pl.posts++
    pl.engagement += p.metrics.engagement
    byPlatform.set(p.platform, pl)
    byFormat.set(p.format, [...(byFormat.get(p.format) ?? []), p.metrics.engagementRate])
  }

  const base: Omit<ReportData, 'summary' | 'generatedAt'> = {
    clientName: client.name,
    logoUrl: typeof client.logo_url === 'string' && client.logo_url.startsWith('https://') ? client.logo_url : null,
    periodLabel: label,
    periodStart: start,
    periodEnd: end,
    totals: dashboard.totals,
    previousTotals: dashboard.previousTotals,
    followers: dashboard.followers,
    previousFollowers: dashboard.previousFollowers,
    daily: dashboard.daily.map((d) => ({
      date: d.date,
      reach: d.reach,
      engagement: d.engagement,
      impressions: d.impressions,
      followersGained: d.followersGained,
    })),
    postCount: posts.length,
    byPlatform: Array.from(byPlatform, ([platform, v]) => ({ platform, ...v })).sort((a, b) => b.posts - a.posts),
    byFormat: Array.from(byFormat, ([format, ers]) => ({ format, posts: ers.length, medianEngagementRate: Math.round(median(ers) * 100) / 100 })).sort(
      (a, b) => b.posts - a.posts
    ),
    topPosts: [...posts]
      .sort((a, b) => b.metrics.engagement - a.metrics.engagement || b.metrics.reach - a.metrics.reach)
      .slice(0, 5),
  }
  const plans = snapshot === 'missing_table' ? [] : snapshot.recommendations.map((r) => `${r.title}: ${r.detail}`)
  const data: ReportData = { ...base, summary: await writeSummary(base, plans), generatedAt: new Date().toISOString() }

  const { data: existing, error: readError } = await admin
    .from(TABLE)
    .select('id, share_token')
    .eq('client_id', clientId)
    .eq('period_start', start)
    .maybeSingle()
  if (isMissingTable(readError)) throw new ReportError(REPORTS_SETUP_MESSAGE, 503)

  const shareToken = (existing?.share_token as string | undefined) ?? crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const { data: saved, error } = await admin
    .from(TABLE)
    .upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        client_id: clientId,
        period_start: start,
        period_end: end,
        data,
        share_token: shareToken,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,period_start' }
    )
    .select('id')
    .single()
  if (error) {
    if (isMissingTable(error)) throw new ReportError(REPORTS_SETUP_MESSAGE, 503)
    logger.error('Save report failed:', error)
    throw new ReportError('Could not save the report', 500)
  }
  return { id: saved.id as string, shareToken, data }
}

export async function listReports(admin: SupabaseClient, clientId: string): Promise<ReportListItem[] | 'missing_table'> {
  const { data, error } = await admin
    .from(TABLE)
    .select('id, period_start, share_token, created_at, updated_at, data')
    .eq('client_id', clientId)
    .order('period_start', { ascending: false })
    .limit(24)
  if (error) {
    if (isMissingTable(error)) return 'missing_table'
    throw error
  }
  return (data ?? []).map((r) => {
    const d = r.data as ReportData
    return {
      id: r.id as string,
      periodStart: r.period_start as string,
      periodLabel: d?.periodLabel ?? String(r.period_start),
      shareToken: r.share_token as string,
      createdAt: (r.updated_at ?? r.created_at) as string,
      headline: d?.summary?.headline ?? '',
    }
  })
}

/** A report by its share token, for the public page. */
export async function reportByToken(admin: SupabaseClient, token: string): Promise<ReportData | null> {
  if (!/^[a-f0-9]{32,64}$/.test(token)) return null
  const { data, error } = await admin.from(TABLE).select('data').eq('share_token', token).maybeSingle()
  if (error || !data) return null
  return data.data as ReportData
}
