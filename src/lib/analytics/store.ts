import OpenAI from 'openai'
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { createSupabaseAdmin } from '@/lib/supabaseServer'
import { completionParams } from '@/lib/openaiParams'
import { computeInsights, formatPerformancePrompt, localiseSlots, slotLabel } from './insights'
import { fetchBestTimes, fetchDashboard, fetchPublishedPosts, ZernioAnalyticsError } from './zernio'
import { formatAudiencePrompt, getAudienceSummary } from '@/lib/comments/store'
import type { AnalyticsPost, AnalyticsStatus, BestTimeSlot, PerformanceInsights, Recommendation } from './types'

// Per-client analytics snapshot (table client_analytics, migration 034): the posts'
// results from Zernio, best times, computed insights and weekly AI recommendations.
// Everything that wants analytics — the Analytics page, post results, caption and
// agent prompts — reads the snapshot; it's refreshed from Zernio when stale.

const TABLE = 'client_analytics'
export const ANALYTICS_STALE_MS = 6 * 60 * 60 * 1000
export const RECOMMENDATIONS_STALE_MS = 7 * 24 * 60 * 60 * 1000
export const ANALYTICS_SETUP_MESSAGE = 'Analytics needs a one-off database update (migrations/034-client-analytics.sql).'

const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01'

export interface AnalyticsSnapshot {
  posts: AnalyticsPost[]
  bestTimes: BestTimeSlot[]
  insights: PerformanceInsights | null
  recommendations: Recommendation[]
  recommendationsAt: string | null
  status: AnalyticsStatus
  message: string | null
  syncedAt: string | null
}

export function isStale(syncedAt: string | null, maxAge = ANALYTICS_STALE_MS): boolean {
  return !syncedAt || Date.now() - Date.parse(syncedAt) >= maxAge
}

export async function readSnapshot(
  admin: SupabaseClient,
  clientId: string
): Promise<AnalyticsSnapshot | 'missing_table' | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('posts, best_times, insights, recommendations, recommendations_at, status, message, synced_at')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) {
    if (isMissingTable(error)) return 'missing_table'
    logger.error('Read analytics snapshot failed:', error)
    return null
  }
  if (!data) return null
  return {
    posts: Array.isArray(data.posts) ? (data.posts as AnalyticsPost[]) : [],
    bestTimes: Array.isArray(data.best_times) ? (data.best_times as BestTimeSlot[]) : [],
    insights: (data.insights as PerformanceInsights | null) ?? null,
    recommendations: Array.isArray(data.recommendations) ? (data.recommendations as Recommendation[]) : [],
    recommendationsAt: data.recommendations_at ?? null,
    status: (data.status as AnalyticsStatus) ?? 'ok',
    message: data.message ?? null,
    syncedAt: data.synced_at ?? null,
  }
}

/** Re-read the client's results from Zernio, recompute insights and store them. */
export async function refreshSnapshot(admin: SupabaseClient, clientId: string): Promise<AnalyticsSnapshot | 'missing_table'> {
  const existing = await readSnapshot(admin, clientId)
  if (existing === 'missing_table') return existing

  const { data: client } = await admin
    .from('clients')
    .select('late_profile_id, timezone')
    .eq('id', clientId)
    .maybeSingle()
  const profileId = client?.late_profile_id as string | null | undefined
  const timeZone = (client?.timezone as string | null) || 'Pacific/Auckland'
  const now = new Date().toISOString()

  let snapshot: AnalyticsSnapshot = {
    posts: existing?.posts ?? [],
    bestTimes: existing?.bestTimes ?? [],
    insights: existing?.insights ?? null,
    recommendations: existing?.recommendations ?? [],
    recommendationsAt: existing?.recommendationsAt ?? null,
    status: 'ok',
    message: null,
    syncedAt: now,
  }

  if (!profileId) {
    snapshot = { ...snapshot, status: 'not_connected', message: 'Connect a social account to see results.' }
  } else {
    try {
      const [posts, rawSlots, dashboard] = await Promise.all([
        fetchPublishedPosts(profileId),
        fetchBestTimes(profileId).catch((err) => {
          logger.warn('Zernio best-time failed', { clientId, error: err instanceof Error ? err.message : String(err) })
          return []
        }),
        fetchDashboard(profileId, 30).catch(() => null),
      ])
      const bestTimes = localiseSlots(rawSlots, timeZone)
      const insights = computeInsights(posts, bestTimes, timeZone)
      insights.followers = dashboard ? { current: dashboard.followers.current, gained30d: dashboard.followers.gained } : null
      snapshot = { ...snapshot, posts, bestTimes, insights }
    } catch (err) {
      const unavailable = err instanceof ZernioAnalyticsError && err.unavailable
      snapshot = {
        ...snapshot,
        status: unavailable ? 'unavailable' : 'failed',
        message: unavailable
          ? "The Zernio plan doesn't include analytics."
          : "Couldn't read results from Zernio just now — showing the last saved numbers.",
        // Retry a failed sync sooner than a successful one
        syncedAt: unavailable ? now : new Date(Date.now() - ANALYTICS_STALE_MS + 30 * 60 * 1000).toISOString(),
      }
    }
  }

  const { error } = await admin.from(TABLE).upsert({
    client_id: clientId,
    posts: snapshot.posts,
    best_times: snapshot.bestTimes,
    insights: snapshot.insights,
    status: snapshot.status,
    message: snapshot.message,
    synced_at: snapshot.syncedAt,
    updated_at: now,
  })
  if (error) {
    if (isMissingTable(error)) return 'missing_table'
    logger.error('Save analytics snapshot failed:', error)
  }
  return snapshot
}

/** The stored snapshot, refreshed first only when there is none yet. Stale ones refresh after the response. */
export async function getSnapshot(
  admin: SupabaseClient,
  clientId: string,
  opts: { background?: boolean } = {}
): Promise<AnalyticsSnapshot | 'missing_table'> {
  const existing = await readSnapshot(admin, clientId)
  if (existing === 'missing_table') return existing
  if (!existing) return refreshSnapshot(admin, clientId)
  if (isStale(existing.syncedAt) && opts.background !== false) {
    runAfterResponse(() => refreshSnapshot(createSupabaseAdmin(), clientId))
  }
  return existing
}

/** Run work after the response when inside a request; otherwise fire and forget. */
export function runAfterResponse(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => logger.error('Background analytics task failed:', err))
  try {
    after(safe)
  } catch {
    void safe()
  }
}

/**
 * "What works for this account" for caption and agent prompts. Never calls Zernio
 * inline: uses the stored insights and refreshes stale ones in the background.
 */
export async function getPerformancePrompt(clientId: string): Promise<string> {
  try {
    const admin = createSupabaseAdmin()
    const snapshot = await readSnapshot(admin, clientId)
    if (!snapshot || snapshot === 'missing_table') {
      if (snapshot === null) runAfterResponse(() => refreshSnapshot(createSupabaseAdmin(), clientId))
      return formatAudiencePrompt(await getAudienceSummary(admin, clientId).catch(() => null))
    }
    if (isStale(snapshot.syncedAt)) runAfterResponse(() => refreshSnapshot(createSupabaseAdmin(), clientId))
    // What the audience asks and says in comments: questions make good post ideas
    const audience = formatAudiencePrompt(await getAudienceSummary(admin, clientId).catch(() => null))
    return [formatPerformancePrompt(snapshot.insights), audience].filter(Boolean).join('\n\n')
  } catch (err) {
    logger.error('Performance prompt failed:', err)
    return ''
  }
}

/** Best posting times for scheduling (client timezone), strongest first. */
export async function getBestTimes(clientId: string): Promise<BestTimeSlot[]> {
  const snapshot = await readSnapshot(createSupabaseAdmin(), clientId).catch(() => null)
  if (!snapshot || snapshot === 'missing_table') return []
  return snapshot.insights?.bestSlots ?? []
}

// ---------------------------------------------------------------------------
// Proactive recommendations: what a social media manager would suggest next
// ---------------------------------------------------------------------------

const RECOMMENDATION_PROMPT = `You are a senior social media manager reviewing one client's real results.
Give 3-5 specific, practical recommendations for the next two weeks, based ONLY on the data given.
Each one must be something the team can act on now: a post or series to make, a format to lean into,
a time to post, something to stop doing. Refer to their actual best posts when suggesting content.
No generic advice ("be consistent", "engage with your audience") unless the data clearly shows it.
Return JSON: {"recommendations": [{"title": "short imperative, max 60 chars", "detail": "1-2 sentences citing the numbers",
"action": "create_post" | "run_agent" | "adjust_schedule" | "none",
"brief": "for create_post/run_agent: a brief for the content team/AI describing exactly what to create; else omit"}]}`

export async function generateRecommendations(
  admin: SupabaseClient,
  clientId: string
): Promise<Recommendation[] | null> {
  if (!process.env.OPENAI_API_KEY) return null
  const snapshot = await readSnapshot(admin, clientId)
  if (!snapshot || snapshot === 'missing_table' || !snapshot.insights || snapshot.insights.postCount < 5) return null
  const i = snapshot.insights

  const { data: client } = await admin
    .from('clients')
    .select('name, company_description, target_audience')
    .eq('id', clientId)
    .maybeSingle()

  const data = {
    business: client?.name,
    about: String(client?.company_description ?? '').slice(0, 600),
    audience: String(client?.target_audience ?? '').slice(0, 300),
    posts_last_12_months: i.postCount,
    posts_per_week: i.postsPerWeek,
    median_engagement_rate: i.baseline.medianEngagementRate,
    findings: i.findings,
    formats: i.byFormat.map((g) => `${g.label}: ${g.count} posts, ${g.medianEngagementRate}%`),
    best_times: i.bestSlots.map(slotLabel),
    last_30_days: i.trend.recent,
    previous_30_days: i.trend.previous,
    top_posts: i.topPosts.map((p) => ({ format: p.format, er: p.metrics.engagementRate, caption: p.content.slice(0, 300) })),
    weak_posts: i.weakPosts.map((p) => ({ format: p.format, er: p.metrics.engagementRate, caption: p.content.slice(0, 200) })),
    // Questions and complaints in comments: answering them makes good content
    audience_comments_last_30_days: await getAudienceSummary(admin, clientId).catch(() => null),
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 1200, temperature: 0.5 }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RECOMMENDATION_PROMPT },
        { role: 'user', content: JSON.stringify(data) },
      ],
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}') as { recommendations?: unknown[] }
    const actions = new Set(['create_post', 'run_agent', 'adjust_schedule', 'none'])
    const recommendations: Recommendation[] = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).title === 'string')
      .slice(0, 5)
      .map((r) => ({
        id: crypto.randomUUID(),
        title: String(r.title).slice(0, 80),
        detail: String(r.detail ?? '').slice(0, 400),
        action: (actions.has(String(r.action)) ? r.action : 'none') as Recommendation['action'],
        ...(typeof r.brief === 'string' && r.brief.trim() ? { brief: r.brief.slice(0, 800) } : {}),
      }))

    await admin
      .from(TABLE)
      .update({ recommendations, recommendations_at: new Date().toISOString() })
      .eq('client_id', clientId)
    return recommendations
  } catch (err) {
    logger.error('Generate recommendations failed:', err)
    return null
  }
}
