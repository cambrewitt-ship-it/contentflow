import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { generateContentPlan } from '@/lib/autopilot-engine'
import { checkAICreditsPermissionForUser } from '@/lib/subscriptionMiddleware'
import { creditsForRun } from '@/lib/autopilot-agent/constants'
import { DEFAULT_RUN_BRIEF, type RunBrief } from '@/lib/autopilot-agent/runBrief'
import { readSnapshot } from '@/lib/analytics/store'

// "Keep the calendar filled": when a client's next 7 days fall short of their
// posts-per-week target, run the Content Agent for just that window so a pool of
// drafts is waiting for approval — briefed with what has performed best for them.
// Runs daily from /api/cron/fill-gaps for clients with autopilot_settings.fill_gaps.

const WINDOW_DAYS = 7
// Don't stack runs: skip if the agent ran for this client recently or has a plan waiting
const RECENT_RUN_DAYS = 3
const RUN_POST_COUNT = 6 as const

export interface GapCheck {
  clientId: string
  target: number
  scheduled: number
  shortfall: number
  emptyDates: string[]
  windowStart: string
  windowEnd: string
}

/** YYYY-MM-DD for `date` in a timezone */
function localDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function checkGap(
  admin: SupabaseClient,
  client: { id: string; timezone?: string | null; posting_preferences?: Record<string, unknown> | null },
  now = new Date()
): Promise<GapCheck> {
  const tz = client.timezone || 'Pacific/Auckland'
  const windowStart = addDays(localDate(now, tz), 1)
  const windowEnd = addDays(windowStart, WINDOW_DAYS - 1)
  const target = Math.max(1, Number(client.posting_preferences?.posts_per_week) || 3)

  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('scheduled_date')
    .eq('client_id', client.id)
    .gte('scheduled_date', windowStart)
    .lte('scheduled_date', windowEnd)
  const dates = new Set((data ?? []).map((r) => String(r.scheduled_date)))
  const avoid = new Set(
    (Array.isArray(client.posting_preferences?.avoid_days) ? (client.posting_preferences!.avoid_days as string[]) : []).map((d) =>
      d.toLowerCase()
    )
  )
  const emptyDates: string[] = []
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = addDays(windowStart, i)
    const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase()
    if (!dates.has(day) && !avoid.has(weekday)) emptyDates.push(day)
  }
  const scheduled = data?.length ?? 0
  return { clientId: client.id, target, scheduled, shortfall: Math.max(0, target - scheduled), emptyDates, windowStart, windowEnd }
}

/** The run brief: fill the gap, steered by the client's latest recommendation and results. */
async function gapBrief(admin: SupabaseClient, gap: GapCheck): Promise<RunBrief> {
  const snapshot = await readSnapshot(admin, gap.clientId).catch(() => null)
  const s = snapshot && snapshot !== 'missing_table' ? snapshot : null
  const rec = s?.recommendations.find((r) => (r.action === 'create_post' || r.action === 'run_agent') && r.brief)
  const lines = [
    `The calendar is short ${gap.shortfall} post${gap.shortfall === 1 ? '' : 's'} for ${gap.windowStart} to ${gap.windowEnd}` +
      (gap.emptyDates.length ? ` — days with nothing scheduled: ${gap.emptyDates.join(', ')}. Put posts on those days first.` : '.'),
    rec ? `This week's focus from the analytics: ${rec.brief}` : '',
    s?.insights?.findings.length ? `Lean into what has worked: ${s.insights.findings.slice(0, 2).join(' ')}` : '',
  ]
  return {
    ...DEFAULT_RUN_BRIEF,
    prompt: lines.filter(Boolean).join('\n').slice(0, 1000),
    postCount: RUN_POST_COUNT,
    window: 'next_week',
  }
}

export type GapFillResult =
  | { status: 'filled'; shortfall: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function fillGapsForClient(
  admin: SupabaseClient,
  client: { id: string; user_id: string; name?: string; timezone?: string | null; posting_preferences?: Record<string, unknown> | null }
): Promise<GapFillResult> {
  const gap = await checkGap(admin, client)
  if (gap.shortfall === 0) return { status: 'skipped', reason: 'calendar is full' }

  const since = new Date(Date.now() - RECENT_RUN_DAYS * 86_400_000).toISOString()
  const { data: recent } = await admin
    .from('autopilot_plans')
    .select('id, status, created_at')
    .eq('client_id', client.id)
    .or(`status.in.(generating,pending_approval),created_at.gte.${since}`)
    .limit(1)
  if (recent?.length) return { status: 'skipped', reason: 'a recent plan is waiting for review' }

  const credits = await checkAICreditsPermissionForUser(client.user_id, creditsForRun(RUN_POST_COUNT))
  if (!credits.allowed) return { status: 'skipped', reason: 'not enough AI credits' }

  try {
    const brief = await gapBrief(admin, gap)
    await generateContentPlan(
      client.id,
      client.user_id,
      new Date(`${gap.windowStart}T00:00:00Z`),
      new Date(`${gap.windowEnd}T23:59:59Z`),
      brief
    )
    return { status: 'filled', shortfall: gap.shortfall }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logger.error('Gap fill failed', { clientId: client.id, reason })
    return { status: 'failed', reason }
  }
}
