import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { completionParams } from '@/lib/openaiParams'
import { listAccounts, zernio, ZernioError, type ZernioAccount } from '@/lib/zernio/api'
import { getAudienceSummary } from '@/lib/comments/store'
import { slotLabel } from './insights'
import type {
  AccountAudience,
  AudienceBreakdowns,
  AudienceData,
  AudienceDimension,
  AudienceFan,
  AudiencePersona,
  AudienceSlice,
  PerformanceInsights,
} from './types'

// Audience demographics from Zernio's (LATE's) per-platform demographics endpoints, plus
// the "most engaged audience" persona: an AI-written avatar built from who engages
// (Instagram's engaged-audience demographics, else followers), what they engage with
// (post results), when they're online (best times) and what they say (comments).
// Stored on the analytics snapshot (insights.audience), refreshed at most daily —
// platforms only update demographics every day or two.

export const AUDIENCE_STALE_MS = 24 * 60 * 60 * 1000
export const PERSONA_STALE_MS = 7 * 24 * 60 * 60 * 1000

// ── Labels ──────────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  f: 'Women',
  female: 'Women',
  m: 'Men',
  male: 'Men',
  u: 'Unspecified',
  unknown: 'Unspecified',
  other: 'Other',
  user_specified: 'Other',
}
let countryNames: Intl.DisplayNames | null = null
function countryLabel(code: string): string {
  try {
    countryNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return (code.length === 2 && countryNames.of(code.toUpperCase())) || code
  } catch {
    return code
  }
}
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function labelFor(dim: AudienceDimension, key: string): string {
  if (dim === 'gender') return GENDER_LABELS[key.toLowerCase()] ?? titleCase(key)
  if (dim === 'country') return key.toLowerCase() === 'other' ? 'Other countries' : countryLabel(key)
  if (dim === 'age') return key.replace('-', '–')
  if (dim === 'company_size') return `${key.replace('-', '–')} employees`
  if (dim === 'city') return key.split(',').slice(0, 2).join(',').trim()
  return /[a-z]/.test(key) ? key : titleCase(key.toLowerCase())
}

// ── Parsing (tolerant: Zernio's per-dimension shape isn't the same everywhere) ──

const DIMENSIONS: Record<string, AudienceDimension> = {
  age: 'age',
  gender: 'gender',
  country: 'country',
  countries: 'country',
  city: 'city',
  cities: 'city',
  function: 'function',
  functions: 'function',
  seniority: 'seniority',
  seniorities: 'seniority',
  industry: 'industry',
  industries: 'industry',
  company_size: 'company_size',
  companySize: 'company_size',
  staffCountRange: 'company_size',
  region: 'region',
  regions: 'region',
}

function entriesOf(raw: unknown): Array<[string, number]> {
  if (Array.isArray(raw)) {
    return raw
      .map((e): [string, number] | null => {
        if (!e || typeof e !== 'object') return null
        const o = e as Record<string, unknown>
        const key = o.dimension ?? o.key ?? o.label ?? o.name ?? o.value_key ?? o.code
        const val = typeof o.value === 'number' ? o.value : typeof o.count === 'number' ? o.count : typeof o.followers === 'number' ? o.followers : o.percentage ?? o.share
        return typeof key === 'string' && typeof val === 'number' ? [key, val] : null
      })
      .filter((e): e is [string, number] => !!e)
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number')
  }
  return []
}

export function parseDemographics(raw: unknown): AudienceBreakdowns {
  const out: AudienceBreakdowns = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const dim = DIMENSIONS[name]
    if (!dim) continue
    const entries = entriesOf(value).filter(([, v]) => v > 0)
    const total = entries.reduce((s, [, v]) => s + v, 0)
    if (!total) continue
    let slices: AudienceSlice[] = entries.map(([key, v]) => ({ key, label: labelFor(dim, key), value: v, share: v / total }))
    // Ages read best youngest → oldest; everything else largest first
    slices = dim === 'age' ? slices.sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true })) : slices.sort((a, b) => b.value - a.value)
    out[dim] = slices.slice(0, 50)
  }
  return out
}

const hasData = (b: AudienceBreakdowns | null | undefined) => !!b && Object.values(b).some((s) => s && s.length)

// ── Fetching ────────────────────────────────────────────────────────────────

interface DemographicsResponse {
  demographics?: unknown
  data?: { demographics?: unknown } | unknown
  note?: string
}

async function demographics(path: string, query: Record<string, string>): Promise<{ breakdowns: AudienceBreakdowns; note?: string }> {
  const data = await zernio<DemographicsResponse>('GET', path, { query, timeoutMs: 25_000 })
  const raw = data?.demographics ?? (data?.data as { demographics?: unknown } | undefined)?.demographics ?? data?.data
  return { breakdowns: parseDemographics(raw), note: typeof data?.note === 'string' ? data.note : undefined }
}

function failure(account: ZernioAccount, err: unknown): AccountAudience {
  const base = { accountId: account._id, platform: account.platform, username: account.username ?? account.displayName ?? null, followers: null, engaged: null }
  if (err instanceof ZernioError) {
    const text = `${err.code ?? ''} ${err.message}`.toLowerCase()
    if (err.status === 402 || err.status === 403) return { ...base, status: 'unavailable', message: "The Zernio plan doesn't include analytics." }
    // e.g. instagram_insufficient_followers: "Demographic insights require at least 100 followers."
    if (err.code === 'instagram_insufficient_followers' || text.includes('100 followers') || text.includes('insufficient'))
      return { ...base, status: 'too_small', message: 'Instagram shares audience details once an account has 100+ followers.' }
    if (err.code === 'personal_account_not_supported')
      return { ...base, status: 'unavailable', message: 'LinkedIn only shares audience details for company pages, not personal profiles.' }
    // tiktok_insights_scope_missing, youtube_analytics_scope_missing, linkedin_org_analytics_scope_missing
    if (err.status === 412 || text.includes('scope') || text.includes('reauthoriz'))
      return { ...base, status: 'needs_reconnect', message: 'Reconnect this account to allow audience insights.' }
    return { ...base, status: 'failed', message: err.message.slice(0, 200) }
  }
  return { ...base, status: 'failed', message: "Couldn't read audience details just now." }
}

async function fetchAccount(account: ZernioAccount): Promise<AccountAudience | null> {
  const base = { accountId: account._id, platform: account.platform, username: account.username ?? account.displayName ?? null }
  try {
    switch (account.platform) {
      case 'instagram': {
        const [followers, engaged] = await Promise.all([
          demographics('/analytics/instagram/demographics', { accountId: account._id, metric: 'follower_demographics', timeframe: 'this_month' }),
          demographics('/analytics/instagram/demographics', { accountId: account._id, metric: 'engaged_audience_demographics', timeframe: 'this_month' }).catch(
            () => ({ breakdowns: {} as AudienceBreakdowns, note: undefined })
          ),
        ])
        if (!hasData(followers.breakdowns) && !hasData(engaged.breakdowns))
          return { ...base, status: 'too_small', message: 'Instagram shares audience details once an account has 100+ followers.', followers: null, engaged: null }
        return { ...base, status: 'ok', followers: followers.breakdowns, engaged: hasData(engaged.breakdowns) ? engaged.breakdowns : null }
      }
      case 'facebook': {
        const r = await demographics('/analytics/facebook/demographics', { accountId: account._id })
        return {
          ...base,
          status: hasData(r.breakdowns) ? 'ok' : 'too_small',
          message: hasData(r.breakdowns) ? undefined : 'Facebook has no audience details for this Page yet.',
          followers: r.breakdowns,
          engaged: null,
          note: 'Facebook only shares where followers are — Meta stopped sharing age and gender for Pages in Nov 2025.',
        }
      }
      case 'linkedin': {
        const r = await demographics('/analytics/linkedin/demographics', {
          accountId: account._id,
          breakdown: 'function,seniority,industry,company_size,country',
        })
        return {
          ...base,
          status: hasData(r.breakdowns) ? 'ok' : 'too_small',
          message: hasData(r.breakdowns) ? undefined : 'LinkedIn has no follower details for this page yet.',
          followers: r.breakdowns,
          engaged: null,
        }
      }
      case 'tiktok': {
        const r = await demographics('/analytics/tiktok/demographics', { accountId: account._id })
        return {
          ...base,
          status: hasData(r.breakdowns) ? 'ok' : 'too_small',
          message: hasData(r.breakdowns)
            ? undefined
            : 'TikTok has no audience details yet — the owner needs Analytics turned on in the TikTok app and at least one video.',
          followers: r.breakdowns,
          engaged: null,
        }
      }
      case 'youtube': {
        // Viewers of the last 90 days (signed-in viewers only)
        const r = await demographics('/analytics/youtube/demographics', { accountId: account._id })
        return {
          ...base,
          status: hasData(r.breakdowns) ? 'ok' : 'too_small',
          message: hasData(r.breakdowns) ? undefined : 'YouTube has no viewer details for the last 90 days yet.',
          followers: r.breakdowns,
          engaged: null,
          note: 'YouTube shows who watched in the last 90 days (signed-in viewers only), not subscribers.',
        }
      }
      default:
        return null
    }
  } catch (err) {
    if (!(err instanceof ZernioError) || err.status >= 500) logger.warn('Zernio demographics failed', { platform: account.platform, error: String(err) })
    return failure(account, err)
  }
}

export async function fetchAudience(profileId: string): Promise<AccountAudience[]> {
  const accounts = await listAccounts(profileId)
  const results = await Promise.all(accounts.map((a) => fetchAccount(a)))
  return results.filter((r): r is AccountAudience => !!r)
}

// ── Engaged-audience profile (deterministic facts behind the persona) ───────

/** The account whose audience best represents the most engaged people: Instagram engaged first. */
export function primaryAudience(accounts: AccountAudience[]): { account: AccountAudience; breakdowns: AudienceBreakdowns; engaged: boolean } | null {
  const ok = accounts.filter((a) => a.status === 'ok')
  const engaged = ok.find((a) => hasData(a.engaged))
  if (engaged) return { account: engaged, breakdowns: engaged.engaged!, engaged: true }
  const withAge = ok.find((a) => a.followers?.age?.length)
  const any = withAge ?? ok.find((a) => hasData(a.followers))
  return any ? { account: any, breakdowns: any.followers!, engaged: false } : null
}

/** Top age band(s) covering a meaningful share, e.g. "25–34" or "25–44". */
function ageRange(age: AudienceSlice[] | undefined): string | null {
  if (!age?.length) return null
  const sorted = [...age].sort((a, b) => b.share - a.share)
  const top = sorted[0]
  const next = sorted[1]
  const parse = (k: string) => k.split(/[-–+]/).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  // Two adjacent bands that together dominate read better as one range
  if (next && next.share > top.share * 0.7) {
    const [a1, a2] = parse(top.key)
    const [b1, b2] = parse(next.key)
    if (a1 !== undefined && b1 !== undefined) {
      const lo = Math.min(a1, b1)
      const hi = Math.max(a2 ?? a1, b2 ?? b1)
      return hi > lo ? `${lo}–${hi}` : `${lo}+`
    }
  }
  return top.label
}

function genderLean(gender: AudienceSlice[] | undefined): string | null {
  const known = (gender ?? []).filter((g) => g.label === 'Women' || g.label === 'Men')
  if (!known.length) return null
  const total = known.reduce((s, g) => s + g.value, 0)
  const top = [...known].sort((a, b) => b.value - a.value)[0]
  const share = top.value / total
  if (share >= 0.7) return `mostly ${top.label.toLowerCase()}`
  if (share >= 0.57) return `more ${top.label.toLowerCase()}`
  return 'women and men equally'
}

export interface AudienceFacts {
  source: string
  ageRange: string | null
  gender: string | null
  location: string | null
  ages: string[]
  genders: string[]
  cities: string[]
  countries: string[]
  professional: string[]
}

export function audienceFacts(accounts: AccountAudience[]): AudienceFacts | null {
  const primary = primaryAudience(accounts)
  if (!primary) return null
  const b = primary.breakdowns
  const fmt = (s: AudienceSlice[] | undefined, n: number) => (s ?? []).slice(0, n).map((x) => `${x.label} ${Math.round(x.share * 100)}%`)
  const ages = [...(b.age ?? [])].sort((x, y) => y.share - x.share)
  const linkedin = accounts.find((a) => a.platform === 'linkedin' && a.status === 'ok')?.followers
  return {
    source: `${primary.engaged ? 'engaged audience' : 'followers'} on ${titleCase(primary.account.platform)}`,
    ageRange: ageRange(b.age),
    gender: genderLean(b.gender),
    location: b.city?.[0]?.label.split(',')[0] ?? b.country?.[0]?.label ?? null,
    ages: fmt(ages, 4),
    genders: fmt(b.gender, 3),
    cities: fmt(b.city, 5),
    countries: fmt(b.country, 4),
    professional: linkedin
      ? [
          ...fmt(linkedin.function, 3).map((s) => `job: ${s}`),
          ...fmt(linkedin.seniority, 2).map((s) => `seniority: ${s}`),
          ...fmt(linkedin.industry, 3).map((s) => `industry: ${s}`),
        ]
      : [],
  }
}

// ── Persona (AI) ────────────────────────────────────────────────────────────

const PERSONA_PROMPT = `You build an "audience avatar" for a social media team: one realistic person who represents
this account's MOST ENGAGED audience — the people who like, comment, save and share.
Base it ONLY on the data given (demographics, what content performs, when they're active, what they say in comments,
the business). Where demographics are missing, say what the content results suggest and keep claims modest.
Never invent statistics. Write in plain, warm, practical language a social media manager can use today.
Return JSON: {
 "name": "a believable first name that fits the age/gender/location",
 "summary": "2-3 sentences describing who they are and why they follow this business",
 "traits": ["3-5 short phrases about their life, values, interests"],
 "loves": ["3-4 kinds of content they engage with most, grounded in the results data"],
 "howToTalk": ["3 short tips on tone and approach that land with them"],
 "contentIdeas": ["3 specific post ideas made for them"]
}`

export async function generatePersona(
  admin: SupabaseClient,
  clientId: string,
  insights: PerformanceInsights,
  accounts: AccountAudience[]
): Promise<AudiencePersona | null> {
  if (!process.env.OPENAI_API_KEY) return null
  const facts = audienceFacts(accounts)
  // Without demographics, results alone still describe who engages — but need some history
  if (!facts && insights.postCount < 5) return null

  const [{ data: client }, comments] = await Promise.all([
    admin.from('clients').select('name, company_description, target_audience').eq('id', clientId).maybeSingle(),
    getAudienceSummary(admin, clientId, 90).catch(() => null),
  ])
  const data = {
    business: client?.name,
    about: String(client?.company_description ?? '').slice(0, 600),
    intended_audience: String(client?.target_audience ?? '').slice(0, 300),
    demographics: facts ?? 'not available — infer gently from the content results only',
    best_times: insights.bestSlots.slice(0, 3).map(slotLabel),
    findings: insights.findings,
    formats: insights.byFormat.filter((g) => g.count > 0).map((g) => `${g.label}: ${g.count} posts, ${g.medianEngagementRate}% engagement`),
    top_hashtags: insights.hashtags.slice(0, 8).map((h) => `#${h.tag} ${h.medianEngagementRate}%`),
    top_posts: insights.topPosts.slice(0, 5).map((p) => ({ format: p.format, er: p.metrics.engagementRate, caption: p.content.slice(0, 240) })),
    comments_last_90_days: comments
      ? { total: comments.total, positive: comments.positive, negative: comments.negative, questions: comments.questions, concerns: comments.complaints }
      : null,
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 900, temperature: 0.6 }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PERSONA_PROMPT },
        { role: 'user', content: JSON.stringify(data) },
      ],
    })
    const r = JSON.parse(completion.choices[0]?.message?.content || '{}') as Record<string, unknown>
    const list = (v: unknown, n: number, len = 160) =>
      (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, n).map((x) => x.slice(0, len))
    if (typeof r.name !== 'string' || typeof r.summary !== 'string') return null

    const top = insights.bestSlots[0]
    const headline = [facts?.ageRange, facts?.gender, facts?.location].filter(Boolean).join(' · ')
    const basedOn = [
      facts ? facts.source : null,
      insights.postCount ? `${insights.postCount} posts' results` : null,
      comments && comments.total ? `${comments.total} comments` : null,
    ]
      .filter(Boolean)
      .join(' + ')
    return {
      name: r.name.slice(0, 30),
      headline: headline || 'Based on what your audience engages with',
      ageRange: facts?.ageRange ?? null,
      gender: facts?.gender ?? null,
      location: facts?.location ?? null,
      summary: r.summary.slice(0, 600),
      traits: list(r.traits, 5, 80),
      loves: list(r.loves, 4, 120),
      whenOnline: top ? `${slotLabel(top)}${insights.bestSlots[1] ? ` and ${slotLabel(insights.bestSlots[1])}` : ''}` : null,
      howToTalk: list(r.howToTalk, 3, 140),
      contentIdeas: list(r.contentIdeas, 3, 200),
      basedOn,
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    logger.error('Generate audience persona failed:', err)
    return null
  }
}

/** The persona and key demographics for caption / agent prompts. */
export function formatAudiencePersonaPrompt(audience: AudienceData | null | undefined): string {
  const p = audience?.persona
  if (!p) return ''
  const lines = [
    `🎯 MOST ENGAGED AUDIENCE ("${p.name}"${p.headline ? `: ${p.headline}` : ''}):`,
    p.summary,
    p.loves.length ? `Engages most with: ${p.loves.join('; ')}.` : '',
    p.howToTalk.length ? `What lands with them: ${p.howToTalk.join('; ')}.` : '',
    'Write for this person, in the brand voice. Brand voice and caption rules take priority.',
  ]
  return lines.filter(Boolean).join('\n')
}

// ── Top fans (from the comments inbox) ──────────────────────────────────────

export async function getTopFans(admin: SupabaseClient, clientId: string, days = 90, limit = 8): Promise<AudienceFan[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('client_comments')
    .select('author_id, author_name, author_username, author_picture, platform, sentiment, commented_at')
    .eq('client_id', clientId)
    .eq('is_own', false)
    .gte('commented_at', since)
    .order('commented_at', { ascending: false })
    .limit(3000)
  if (error || !data) return []
  const fans = new Map<string, AudienceFan>()
  for (const c of data) {
    const id = c.author_id || c.author_username || c.author_name
    if (!id) continue
    const key = `${c.platform}:${id}`
    const fan =
      fans.get(key) ??
      ({
        name: c.author_name || c.author_username || 'Someone',
        username: c.author_username ?? null,
        picture: c.author_picture ?? null,
        platform: c.platform,
        comments: 0,
        positive: 0,
        lastAt: c.commented_at ?? null,
      } satisfies AudienceFan)
    fan.comments += 1
    if (c.sentiment === 'positive') fan.positive += 1
    fans.set(key, fan)
  }
  return [...fans.values()]
    .filter((f) => f.comments >= 2)
    .sort((a, b) => b.comments - a.comments || b.positive - a.positive)
    .slice(0, limit)
}

export function isAudienceStale(audience: AudienceData | null | undefined): boolean {
  return !audience?.fetchedAt || Date.now() - Date.parse(audience.fetchedAt) > AUDIENCE_STALE_MS
}
