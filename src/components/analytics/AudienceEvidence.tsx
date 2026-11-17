'use client'

import { useMemo } from 'react'
import { Clock, Heart, Info, MapPin, MessageCircle, Users } from 'lucide-react'
import { slotLabel } from '@/lib/analytics/insights'
import { ageRangeOf, genderLeanOf, primaryAudience, withIndex, type IndexedSlice } from '@/lib/analytics/audienceFacts'
import type {
  AccountAudience,
  AnalyticsPost,
  AudiencePersona,
  BestTimeSlot,
  ClientAnalyticsResponse,
  PerformanceInsights,
} from '@/lib/analytics/types'
import { formatLabel, platformLabel, postHeatmap, slotHeatmap } from '@/lib/analytics/visuals'
import { Columns, WeekHeatmap } from './charts'

// "Why {name}?": the data behind each line of the audience avatar. Every claim gets
// the chart it comes from and a takeaway computed from the numbers (never AI-written),
// using the same rules as the server (./audienceFacts), so the two always agree.

const ENGAGED = '#2a78d6'
const FOLLOWERS = '#eb6834'
const pct = (n: number) => `${n >= 0.095 ? Math.round(n * 100) : (n * 100).toFixed(1)}%`
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })

function Evidence({
  icon,
  claim,
  value,
  takeaway,
  children,
}: {
  icon: React.ReactNode
  claim: string
  value: string
  takeaway: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{claim}</p>
          <p className="text-[17px] font-semibold leading-6 text-gray-900">{value}</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-blue-50/60 px-3 py-2 text-[13px] leading-5 text-gray-800 ring-1 ring-blue-100/80">{takeaway}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function IndexBadge({ index }: { index: number | null }) {
  if (index === null) return <span className="w-12 text-right text-[11px] text-gray-400">—</span>
  const x = index / 100
  const tone = x >= 1.1 ? 'bg-blue-50 text-blue-700 ring-blue-100' : x <= 0.9 ? 'bg-orange-50 text-orange-700 ring-orange-100' : 'bg-gray-50 text-gray-600 ring-gray-200'
  return (
    <span className={`w-12 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ring-1 ${tone}`} title={`${index} — engages ${x >= 1 ? `${Math.round((x - 1) * 100)}% more` : `${Math.round((1 - x) * 100)}% less`} than their share of followers`}>
      {x.toFixed(1)}×
    </span>
  )
}

/** Engaged share (blue) vs follower share (orange) per group, with the engagement index. */
function CompareBars({ rows, highlight, compare }: { rows: IndexedSlice[]; highlight: string[]; compare: boolean }) {
  const max = Math.max(...rows.map((r) => Math.max(r.share, r.followerShare ?? 0)), 0.01)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: ENGAGED }} />
          {compare ? 'People who engage' : 'Followers'}
        </span>
        {compare && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: FOLLOWERS }} />
              All followers
            </span>
            <span className="ml-auto">Index = engages vs their share</span>
          </>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const on = highlight.includes(r.key)
          return (
            <div
              key={r.key}
              className={`grid items-center gap-3 rounded-lg px-1.5 py-1 text-[13px] ${compare ? 'grid-cols-[minmax(0,7.5rem)_1fr_3rem]' : 'grid-cols-[minmax(0,7.5rem)_1fr]'} ${
                on ? 'bg-blue-50/70 ring-1 ring-blue-100' : ''
              }`}
            >
              <span className={`truncate ${on ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{r.label}</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.share / max) * 100)}%`, background: ENGAGED, opacity: on || !highlight.length ? 1 : 0.55 }} />
                  </div>
                  <span className="w-10 text-right text-xs font-medium tabular-nums text-gray-900">{pct(r.share)}</span>
                </div>
                {compare && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-2 rounded-full" style={{ width: `${r.followerShare ? Math.max(2, (r.followerShare / max) * 100) : 0}%`, background: FOLLOWERS, opacity: 0.85 }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-gray-500">{r.followerShare !== null ? pct(r.followerShare) : '—'}</span>
                  </div>
                )}
              </div>
              {compare && <IndexBadge index={r.index} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const sumShare = (rows: IndexedSlice[], keys: string[], field: 'share' | 'followerShare') =>
  rows.filter((r) => keys.includes(r.key)).reduce((s, r) => s + (r[field] ?? 0), 0)

export function AudienceEvidence({
  persona,
  accounts,
  insights,
  posts,
  bestTimes,
  commentSummary,
}: {
  persona: AudiencePersona
  accounts: AccountAudience[]
  insights: PerformanceInsights | null | undefined
  posts: AnalyticsPost[]
  /** Zernio's best-time grid: the same source as the avatar's "when they're online" */
  bestTimes: BestTimeSlot[]
  commentSummary: ClientAnalyticsResponse['commentSummary']
}) {
  const primary = useMemo(() => primaryAudience(accounts), [accounts])
  const timeZone = insights?.timezone || 'Pacific/Auckland'
  const fromSlots = bestTimes.length > 0
  const heat = useMemo(() => (fromSlots ? slotHeatmap(bestTimes) : postHeatmap(posts, timeZone, 'rate')), [fromSlots, bestTimes, posts, timeZone])

  const b = primary?.breakdowns
  const f = primary?.followers
  const compare = !!primary?.engaged && !!f
  const who = primary ? (primary.engaged ? 'people who engage' : 'followers') : ''
  const where = primary ? `${platformLabel(primary.account.platform)}${primary.account.username ? ` (@${primary.account.username.replace(/^@/, '')})` : ''}` : ''
  // Instagram's engaged-audience counts are accounts: their total is the sample size
  const sample = b?.age?.reduce((s, x) => s + x.value, 0) ?? b?.gender?.reduce((s, x) => s + x.value, 0) ?? 0

  const ages = withIndex(b?.age, f?.age)
  const range = ageRangeOf(b?.age)
  const genders = withIndex(b?.gender, f?.gender)
  const lean = genderLeanOf(b?.gender)
  const places = b?.city?.length ? withIndex(b.city, f?.city).slice(0, 6) : withIndex(b?.country, f?.country).slice(0, 6)
  const placeKind = b?.city?.length ? 'city' : 'country'
  const topPlace = places[0]

  const baseline = insights?.baseline
  const slots = insights?.bestSlots ?? []
  const formats = (insights?.byFormat ?? []).filter((g) => g.count > 0)
  const bestFormat = formats.filter((g) => g.count >= 3).sort((a, b) => b.medianEngagementRate - a.medianEngagementRate)[0]
  const topPosts = (insights?.topPosts ?? []).slice(0, 3)
  const c = commentSummary
  const neutral = c ? Math.max(0, c.total - c.positive - c.negative) : 0

  const cards: React.ReactNode[] = []

  if (range && ages.length) {
    const inRange = sumShare(ages, range.keys, 'share')
    const fInRange = sumShare(ages, range.keys, 'followerShare')
    cards.push(
      <Evidence
        key="age"
        icon={<Users />}
        claim="Age"
        value={range.label}
        takeaway={
          <>
            <b>{range.label}</b> make up <b>{pct(inRange)}</b> of {who}
            {compare && fInRange > 0 ? (
              <>
                {' '}
                — vs {pct(fInRange)} of all followers, so they engage{' '}
                {inRange >= fInRange ? <b>{(inRange / fInRange).toFixed(1)}× their share</b> : 'a little less than their share'}.
              </>
            ) : (
              '.'
            )}
          </>
        }
      >
        <CompareBars rows={ages} highlight={range.keys} compare={compare} />
      </Evidence>
    )
  }

  if (lean && genders.length) {
    const top = genders.find((g) => g.key === lean.key)
    cards.push(
      <Evidence
        key="gender"
        icon={<Users />}
        claim="Gender"
        value={lean.label.charAt(0).toUpperCase() + lean.label.slice(1)}
        takeaway={
          top ? (
            <>
              <b>{top.label}</b> are <b>{pct(top.share)}</b> of {who}
              {compare && top.followerShare !== null ? (
                <>
                  {' '}
                  (vs {pct(top.followerShare)} of followers{top.index ? <>, index <b>{(top.index / 100).toFixed(1)}×</b></> : ''}).
                </>
              ) : (
                '.'
              )}
            </>
          ) : (
            <>Women and men engage in roughly equal numbers.</>
          )
        }
      >
        <CompareBars rows={genders} highlight={lean.key ? [lean.key] : []} compare={compare} />
      </Evidence>
    )
  }

  if (topPlace) {
    cards.push(
      <Evidence
        key="place"
        icon={<MapPin />}
        claim="Location"
        value={persona.location ?? topPlace.label}
        takeaway={
          <>
            <b>{pct(topPlace.share)}</b> of {who} are in <b>{topPlace.label.split(',')[0]}</b> — the top {placeKind}
            {places[1] ? (
              <>
                , {Math.max(1, Math.round(topPlace.share / Math.max(places[1].share, 0.001)))}× the next ({places[1].label.split(',')[0]})
              </>
            ) : null}
            .
          </>
        }
      >
        <CompareBars rows={places} highlight={[topPlace.key]} compare={compare} />
      </Evidence>
    )
  }

  if (slots.length || posts.length) {
    const top = slots[0]
    const lift = top && baseline?.medianEngagement ? top.avgEngagement / baseline.medianEngagement : null
    cards.push(
      <Evidence
        key="time"
        icon={<Clock />}
        claim="When they're online"
        value={persona.whenOnline ?? (top ? slotLabel(top) : 'Not enough posts yet')}
        takeaway={
          top ? (
            <>
              Posts at <b>{slotLabel(top)}</b> average <b>{fmt(top.avgEngagement)} engagements</b> across {top.postCount} posts
              {lift && lift > 1.05 ? (
                <>
                  {' '}
                  — <b>{lift.toFixed(1)}×</b> a typical post ({fmt(baseline!.medianEngagement)}).
                </>
              ) : (
                '.'
              )}
            </>
          ) : (
            <>Darker squares are the hours posts get the best engagement rate. Outlined: the strongest.</>
          )
        }
      >
        <WeekHeatmap
          compactSize
          cells={heat}
          ariaLabel="Engagement rate by day and hour"
          describe={(cell) =>
            cell.posts ? (
              fromSlots ? (
                <>
                  <span className="font-semibold">{fmt(cell.avgEngagement)}</span> avg engagements · {cell.posts} post{cell.posts === 1 ? '' : 's'}
                </>
              ) : (
                <>
                  <span className="font-semibold">{cell.medianEngagementRate.toFixed(1)}%</span> engagement · {cell.posts} post{cell.posts === 1 ? '' : 's'}
                </>
              )
            ) : (
              <span className="text-gray-500">No posts yet</span>
            )
          }
        />
        {slots.length > 0 && (
          <ol className="mt-3 space-y-1 text-[12px]">
            {slots.slice(0, 3).map((s, n) => (
              <li key={`${s.day}-${s.hour}`} className="flex justify-between gap-2 text-gray-600">
                <span>
                  <span className="mr-1.5 tabular-nums text-gray-400">{n + 1}.</span>
                  <span className="font-medium text-gray-800">{slotLabel(s)}</span>
                </span>
                <span className="tabular-nums">
                  avg {fmt(s.avgEngagement)} · {s.postCount} posts
                </span>
              </li>
            ))}
          </ol>
        )}
      </Evidence>
    )
  }

  if (formats.length) {
    cards.push(
      <Evidence
        key="content"
        icon={<Heart />}
        claim="What they engage with"
        value={bestFormat ? bestFormat.label : persona.loves[0] ?? 'Mixed formats'}
        takeaway={
          bestFormat && baseline ? (
            <>
              <b>{bestFormat.label}</b> get <b>{bestFormat.medianEngagementRate.toFixed(1)}%</b> engagement over {bestFormat.count} posts — vs{' '}
              {baseline.medianEngagementRate.toFixed(1)}% for a typical post
              {bestFormat.lift > 1.05 ? (
                <>
                  {' '}
                  (<b>{Math.round((bestFormat.lift - 1) * 100)}% more</b>)
                </>
              ) : null}
              .
            </>
          ) : (
            <>Median engagement rate per format over the last 12 months.</>
          )
        }
      >
        <Columns
          height={160}
          items={formats.map((g) => ({ key: g.key, label: g.label.replace('Single photos', 'Photos'), value: g.medianEngagementRate, count: g.count }))}
          baseline={baseline?.medianEngagementRate}
          baselineLabel="Typical post"
        />
        {topPosts.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {topPosts.map((p) => (
              <a
                key={p.id}
                href={p.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200"
                title={p.content}
              >
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="line-clamp-4 p-2 text-[10px] leading-4 text-gray-600">{p.content || 'No caption'}</span>
                )}
                <span className="absolute bottom-1 left-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-gray-900 shadow-sm">
                  {p.metrics.engagementRate.toFixed(1)}% · {formatLabel(p.format)}
                </span>
              </a>
            ))}
          </div>
        )}
      </Evidence>
    )
  }

  if (c && c.total > 0) {
    cards.push(
      <Evidence
        key="comments"
        icon={<MessageCircle />}
        claim="What they say"
        value={`${fmt(c.total)} comments · ${Math.round((c.positive / c.total) * 100)}% positive`}
        takeaway={
          c.questions.length ? (
            <>
              <b>{c.questions.length}</b> recurring questions in the last 90 days — answering them is the fastest way to win this audience.
            </>
          ) : (
            <>How people reacted in comments over the last 90 days.</>
          )
        }
      >
        <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
          {[
            { v: c.positive, color: '#1baf7a', label: 'Positive' },
            { v: neutral, color: '#c3c8d2', label: 'Neutral' },
            { v: c.negative, color: '#e34948', label: 'Negative' },
          ]
            .filter((x) => x.v > 0)
            .map((x, i) => (
              <div key={x.label} title={`${x.label}: ${x.v}`} style={{ width: `${(x.v / c.total) * 100}%`, background: x.color, marginLeft: i ? 2 : 0 }} />
            ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-[#1baf7a]" />
            Positive <b className="tabular-nums text-gray-900">{c.positive}</b>
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-[#c3c8d2]" />
            Neutral <b className="tabular-nums text-gray-900">{neutral}</b>
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-[#e34948]" />
            Negative <b className="tabular-nums text-gray-900">{c.negative}</b>
          </span>
        </div>
        {c.questions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-gray-500">Questions they keep asking</p>
            <ul className="space-y-1.5">
              {c.questions.slice(0, 4).map((q) => (
                <li key={q} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[12px] leading-5 text-gray-700 ring-1 ring-gray-200/70">
                  “{q}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </Evidence>
    )
  }

  if (!cards.length) return null

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-gray-900">Why {persona.name}? The data behind the avatar</h3>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-gray-600">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
          <span>
            {primary ? (
              <>
                Built from the <b>{who}</b> on {where}
                {sample > 0 && primary.engaged ? <> — {fmt(sample)} accounts that interacted this month</> : null}
                {compare ? ', compared with all its followers. An index above 1.0× means that group engages more than its share of followers.' : '.'}
              </>
            ) : (
              <>No platform shares audience details for these accounts yet, so the avatar is based on post results and comments only.</>
            )}{' '}
            Highlighted rows are the ones the avatar is built from.
          </span>
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{cards}</div>
    </section>
  )
}
