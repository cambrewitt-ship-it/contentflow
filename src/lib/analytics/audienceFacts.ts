import type { AccountAudience, AudienceBreakdowns, AudienceSlice } from './types'

// The deterministic facts behind the "most engaged audience" persona — which account and
// audience it's built from, its age range, gender lean and location — plus the comparisons
// the Audience tab charts to show *why*. Browser-safe: the server uses it to brief the AI,
// the UI uses the same rules to draw the evidence, so the two always agree.

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const hasAudienceData = (b: AudienceBreakdowns | null | undefined) => !!b && Object.values(b).some((s) => s && s.length)

export interface PrimaryAudience {
  account: AccountAudience
  breakdowns: AudienceBreakdowns
  /** true = Instagram's engaged audience (people who interacted), false = followers */
  engaged: boolean
  /** All followers of the same account, to compare the engaged audience against */
  followers: AudienceBreakdowns | null
}

/** The account whose audience best represents the most engaged people: Instagram engaged first. */
export function primaryAudience(accounts: AccountAudience[]): PrimaryAudience | null {
  const ok = accounts.filter((a) => a.status === 'ok')
  const engaged = ok.find((a) => hasAudienceData(a.engaged))
  if (engaged) return { account: engaged, breakdowns: engaged.engaged!, engaged: true, followers: engaged.followers }
  const withAge = ok.find((a) => a.followers?.age?.length)
  const any = withAge ?? ok.find((a) => hasAudienceData(a.followers))
  return any ? { account: any, breakdowns: any.followers!, engaged: false, followers: null } : null
}

const bounds = (k: string) =>
  k
    .split(/[-–+]/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))

/** The dominant age band, or two neighbouring bands that together dominate, e.g. "25–44". */
export function ageRangeOf(age: AudienceSlice[] | undefined): { label: string; keys: string[] } | null {
  if (!age?.length) return null
  const sorted = [...age].sort((a, b) => b.share - a.share)
  const top = sorted[0]
  const next = sorted[1]
  // Two bands that together dominate read better as one range
  if (next && next.share > top.share * 0.7) {
    const [a1, a2] = bounds(top.key)
    const [b1, b2] = bounds(next.key)
    if (a1 !== undefined && b1 !== undefined) {
      const lo = Math.min(a1, b1)
      const hi = Math.max(a2 ?? a1, b2 ?? b1)
      return { label: hi > lo ? `${lo}–${hi}` : `${lo}+`, keys: [top.key, next.key] }
    }
  }
  return { label: top.label, keys: [top.key] }
}

export function genderLeanOf(gender: AudienceSlice[] | undefined): { label: string; key: string | null; share: number } | null {
  const known = (gender ?? []).filter((g) => g.label === 'Women' || g.label === 'Men')
  if (!known.length) return null
  const total = known.reduce((s, g) => s + g.value, 0)
  const top = [...known].sort((a, b) => b.value - a.value)[0]
  const share = top.value / total
  if (share >= 0.7) return { label: `mostly ${top.label.toLowerCase()}`, key: top.key, share }
  if (share >= 0.57) return { label: `more ${top.label.toLowerCase()}`, key: top.key, share }
  return { label: 'women and men equally', key: null, share }
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
    ageRange: ageRangeOf(b.age)?.label ?? null,
    gender: genderLeanOf(b.gender)?.label ?? null,
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

export interface IndexedSlice extends AudienceSlice {
  /** Share among all followers (same key), when known */
  followerShare: number | null
  /** engaged share ÷ follower share × 100: 140 = engages 40% more than their share of followers */
  index: number | null
}

/** Pair each engaged-audience slice with the same group's share of followers. */
export function withIndex(engaged: AudienceSlice[] | undefined, followers: AudienceSlice[] | undefined | null): IndexedSlice[] {
  return (engaged ?? []).map((s) => {
    const f = followers?.find((x) => x.key === s.key)
    const followerShare = f ? f.share : null
    return { ...s, followerShare, index: followerShare && followerShare > 0.005 ? Math.round((s.share / followerShare) * 100) : null }
  })
}
