'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bot, Clock, Globe2, Heart, Loader2, MapPin, MessageCircle, RefreshCw, Sparkles, Users } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import type { AccountAudience, AudienceData, AudienceFan, AudiencePersona, AudienceSlice } from '@/lib/analytics/types'
import { platformColor, platformLabel } from '@/lib/analytics/visuals'
import { Card, Segmented } from './AnalyticsViews'

// The Audience tab: the "most engaged audience" avatar (AI-written from who engages,
// what they engage with, when they're online and what they say), the demographics
// behind it per connected account, and the people who comment most.

const pct = (n: number) => `${n >= 0.095 ? Math.round(n * 100) : (n * 100).toFixed(1)}%`

function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

export function PersonaAvatar({ name, size = 72 }: { name: string; size?: number }) {
  return (
    <span
      className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 font-semibold text-white shadow-[0_8px_24px_-8px_rgb(53_109_243/0.6)] ring-4 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-orange-500 shadow-sm ring-1 ring-gray-200"
        style={{ width: size * 0.36, height: size * 0.36 }}
      >
        <Heart className="fill-orange-500" style={{ width: size * 0.18, height: size * 0.18 }} />
      </span>
    </span>
  )
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200/80 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-blue-600">
      {icon}
      {children}
    </span>
  )
}

function PersonaCard({
  persona,
  clientId,
  busy,
  onRewrite,
}: {
  persona: AudiencePersona
  clientId: string
  busy: boolean
  onRewrite: () => void
}) {
  const brief = `Create posts for our most engaged audience, "${persona.name}" (${persona.headline}). ${persona.summary} They engage most with: ${persona.loves.join('; ')}. Ideas: ${persona.contentIdeas.join('; ')}`
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-white to-blue-50/80 shadow-card">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
          <PersonaAvatar name={persona.name} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">Most engaged audience</p>
            <h2 className="mt-0.5 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-gray-900">Meet {persona.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {persona.ageRange && <Chip icon={<Users />}>{persona.ageRange}</Chip>}
              {persona.gender && <Chip>{persona.gender}</Chip>}
              {persona.location && <Chip icon={<MapPin />}>{persona.location}</Chip>}
              {persona.whenOnline && <Chip icon={<Clock />}>{persona.whenOnline}</Chip>}
            </div>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-gray-700">{persona.summary}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-row gap-2 md:flex-col md:items-end">
          <Link
            href={`/dashboard/client/${clientId}/autopilot?brief=${encodeURIComponent(brief.slice(0, 1500))}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-ai px-3.5 text-[13px] font-medium text-white shadow-button hover:brightness-105"
          >
            <Bot className="h-4 w-4" /> Create for {persona.name}
          </Link>
          <button
            onClick={onRewrite}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            title="Write the avatar again from the latest results"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-orange-500" />}
            Rewrite
          </button>
        </div>
      </div>

      <div className="grid gap-px border-t border-blue-100/80 bg-blue-100/60 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Who they are', items: persona.traits },
          { title: 'What they engage with', items: persona.loves },
          { title: 'How to talk to them', items: persona.howToTalk },
          { title: `Post ideas for ${persona.name}`, items: persona.contentIdeas },
        ].map((col) => (
          <div key={col.title} className="bg-white/90 p-4">
            <p className="mb-2 text-xs font-semibold text-gray-900">{col.title}</p>
            <ul className="space-y-1.5">
              {col.items.map((t) => (
                <li key={t} className="flex gap-2 text-[13px] leading-5 text-gray-700">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-blue-100/80 bg-white/70 px-5 py-2.5 text-[11px] text-gray-500">
        Built from {persona.basedOn} · {new Date(persona.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Captions and the
        Content Agent write for {persona.name} automatically.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Share bars: one series, or engaged vs all followers side by side    */
/* ------------------------------------------------------------------ */

const SERIES_A = '#2a78d6' // engaged / single series
const SERIES_B = '#eb6834' // all followers (orange: the palette's one accent)

function ShareBars({
  a,
  b,
  aLabel,
  bLabel,
  limit = 8,
  flags,
}: {
  a: AudienceSlice[]
  b?: AudienceSlice[] | null
  aLabel?: string
  bLabel?: string
  limit?: number
  flags?: boolean
}) {
  const rows = a.slice(0, limit).map((s) => ({ s, other: b?.find((x) => x.key === s.key) ?? null }))
  const max = Math.max(...rows.map((r) => Math.max(r.s.share, r.other?.share ?? 0)), 0.01)
  return (
    <div>
      {b && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_A }} />
            {aLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_B }} />
            {bLabel}
          </span>
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map(({ s, other }) => (
          <div key={s.key} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-[13px]" title={`${s.label}: ${pct(s.share)}`}>
            <span className="truncate text-gray-700">
              {flags && flag(s.key) && <span className="mr-1.5">{flag(s.key)}</span>}
              {s.label}
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (s.share / max) * 100)}%`, background: SERIES_A }} />
                </div>
                <span className="w-11 text-right text-xs font-medium tabular-nums text-gray-900">{pct(s.share)}</span>
              </div>
              {b && (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-2 rounded-full" style={{ width: `${Math.max(other ? 2 : 0, ((other?.share ?? 0) / max) * 100)}%`, background: SERIES_B }} />
                  </div>
                  <span className="w-11 text-right text-xs tabular-nums text-gray-500">{other ? pct(other.share) : '—'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Women / men / other as one 100% bar with a legend. */
function GenderSplit({ slices }: { slices: AudienceSlice[] }) {
  const colors: Record<string, string> = { Women: SERIES_A, Men: '#0d366b', Other: '#86b6ef', Unspecified: '#c3c8d2' }
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        {slices.map((s, i) => (
          <div
            key={s.key}
            title={`${s.label}: ${pct(s.share)}`}
            style={{ width: `${s.share * 100}%`, background: colors[s.label] ?? '#97a3b6', marginLeft: i ? 2 : 0 }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {slices.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-gray-700">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colors[s.label] ?? '#97a3b6' }} />
            {s.label} <span className="font-semibold tabular-nums text-gray-900">{pct(s.share)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* One account's demographics                                          */
/* ------------------------------------------------------------------ */

type Lens = 'engaged' | 'followers'

function AccountDemographics({ account }: { account: AccountAudience }) {
  const hasEngaged = !!account.engaged && Object.values(account.engaged).some((s) => s?.length)
  const [lens, setLens] = useState<Lens>(hasEngaged ? 'engaged' : 'followers')
  const main = (lens === 'engaged' ? account.engaged : account.followers) ?? {}
  const compare = hasEngaged && lens === 'engaged' ? account.followers : null
  const aLabel = lens === 'engaged' ? 'Engaged audience' : account.platform === 'youtube' ? 'Viewers' : 'Followers'
  const who = account.platform === 'youtube' ? 'viewers' : lens === 'engaged' ? 'people who engage' : 'followers'

  const sections: Array<{ key: string; title: string; icon: React.ReactNode; body: React.ReactNode; wide?: boolean }> = []
  if (main.age?.length)
    sections.push({
      key: 'age',
      title: 'Age',
      icon: <Users className="h-4 w-4 text-blue-600" />,
      body: <ShareBars a={main.age} b={compare?.age} aLabel={aLabel} bLabel="All followers" limit={8} />,
    })
  if (main.gender?.length)
    sections.push({
      key: 'gender',
      title: 'Gender',
      icon: <Users className="h-4 w-4 text-blue-600" />,
      body: (
        <div className="space-y-5">
          <div>
            {compare?.gender && <p className="mb-2 text-xs font-medium text-gray-500">{aLabel}</p>}
            <GenderSplit slices={main.gender} />
          </div>
          {compare?.gender && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">All followers</p>
              <GenderSplit slices={compare.gender} />
            </div>
          )}
        </div>
      ),
    })
  if (main.city?.length)
    sections.push({
      key: 'city',
      title: 'Top cities',
      icon: <MapPin className="h-4 w-4 text-blue-600" />,
      body: <ShareBars a={main.city} b={compare?.city} aLabel={aLabel} bLabel="All followers" />,
    })
  if (main.country?.length)
    sections.push({
      key: 'country',
      title: 'Top countries',
      icon: <Globe2 className="h-4 w-4 text-blue-600" />,
      body: <ShareBars a={main.country} b={compare?.country} aLabel={aLabel} bLabel="All followers" flags />,
    })
  for (const [key, title] of [
    ['function', 'Job function'],
    ['seniority', 'Seniority'],
    ['industry', 'Industry'],
    ['company_size', 'Company size'],
    ['region', 'Region'],
  ] as const) {
    const s = main[key]
    if (s?.length) sections.push({ key, title, icon: <Users className="h-4 w-4 text-blue-600" />, body: <ShareBars a={s} /> })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-gray-500">
          Share of {who}
          {account.username ? ` on @${account.username.replace(/^@/, '')}` : ''}.
          {compare && ' Orange shows all followers, so you can see who engages more than their share.'}
        </p>
        {hasEngaged && (
          <Segmented
            label="Audience"
            value={lens}
            onChange={setLens}
            options={[
              { key: 'engaged', label: 'Most engaged' },
              { key: 'followers', label: 'All followers' },
            ]}
          />
        )}
      </div>
      {account.note && <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-200/70">{account.note}</p>}
      {sections.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((s) => (
            <Card key={s.key} title={s.title} icon={s.icon}>
              {s.body}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No details in this view yet.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Top fans                                                            */
/* ------------------------------------------------------------------ */

function TopFans({ fans, clientId }: { fans: AudienceFan[]; clientId: string }) {
  return (
    <Card
      title="Top fans"
      icon={<MessageCircle className="h-4 w-4 text-blue-600" />}
      subtitle="The people who comment most, last 90 days"
      action={
        <Link href={`/dashboard/client/${clientId}/comments`} className="text-xs font-medium text-blue-600 hover:underline">
          Comments →
        </Link>
      }
    >
      {fans.length ? (
        <ol className="space-y-1">
          {fans.map((f, i) => (
            <li key={`${f.platform}-${f.username ?? f.name}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50">
              <span className="w-4 text-right text-xs tabular-nums text-gray-400">{i + 1}</span>
              <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-blue-50 ring-1 ring-gray-200">
                {f.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.picture} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-blue-700">{f.name.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-gray-900">{f.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: platformColor(f.platform) }} />
                  {f.username ? `@${f.username.replace(/^@/, '')}` : platformLabel(f.platform)}
                </span>
              </span>
              <span className="text-right text-xs tabular-nums text-gray-600">
                <span className="font-semibold text-gray-900">{f.comments}</span> comments
                {f.positive > 0 && <span className="block text-[11px] text-emerald-700">{Math.round((f.positive / f.comments) * 100)}% positive</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-500">People who comment twice or more show up here once comments are syncing.</p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* The tab                                                             */
/* ------------------------------------------------------------------ */

export function AudienceView({
  clientId,
  audience,
  fans,
  onChanged,
}: {
  clientId: string
  audience: AudienceData | null | undefined
  fans: AudienceFan[]
  onChanged: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState<'audience' | 'persona' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const accounts = useMemo(() => audience?.accounts ?? [], [audience])
  const ready = accounts.filter((a) => a.status === 'ok')
  const blocked = accounts.filter((a) => a.status !== 'ok')
  const [selected, setSelected] = useState<string | null>(null)
  const current = ready.find((a) => a.accountId === selected) ?? ready.find((a) => a.engaged) ?? ready[0] ?? null

  const run = async (what: 'audience' | 'persona') => {
    setBusy(what)
    setError(null)
    try {
      await authedFetchJson(`/api/clients/${clientId}/analytics/refresh`, { method: 'POST', body: { [what]: true }, timeoutMs: 120_000 })
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>}

      {audience?.persona ? (
        <PersonaCard persona={audience.persona} clientId={clientId} busy={busy === 'persona'} onRewrite={() => run('persona')} />
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-blue-200 bg-white/70 p-5 sm:flex-row sm:items-center">
          <PersonaAvatar name="?" size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-gray-900">Your most engaged audience avatar</p>
            <p className="mt-0.5 text-[13px] text-gray-600">
              {audience
                ? 'Built from who engages, what they engage with, when they’re online and what they say in comments.'
                : 'Appears after the next results refresh, once accounts are connected.'}
            </p>
          </div>
          {audience && (
            <button
              onClick={() => run('persona')}
              disabled={!!busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-ai px-3.5 text-[13px] font-medium text-white shadow-button disabled:opacity-60"
            >
              {busy === 'persona' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Build avatar
            </button>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-gray-900">Demographics</h3>
            <div className="flex items-center gap-2">
              {ready.length > 1 && (
                <Segmented
                  label="Account"
                  value={current?.accountId ?? ''}
                  onChange={setSelected}
                  options={ready.map((a) => ({ key: a.accountId, label: platformLabel(a.platform) }))}
                />
              )}
              <button
                onClick={() => run('audience')}
                disabled={!!busy}
                title="Re-read audience details from the platforms"
                aria-label="Refresh audience details"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy === 'audience' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {current ? (
            <AccountDemographics key={current.accountId} account={current} />
          ) : (
            <Card title="No audience details yet" icon={<Users className="h-4 w-4 text-gray-500" />}>
              <p className="text-sm text-gray-500">
                {audience
                  ? 'None of the connected accounts share audience details yet — see below for why.'
                  : 'Audience details load with the next results refresh (at most daily).'}
              </p>
            </Card>
          )}
          {blocked.length > 0 && (
            <ul className="space-y-1.5">
              {blocked.map((a) => (
                <li key={a.accountId} className="flex items-start gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-100">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  <span>
                    <span className="font-medium">{platformLabel(a.platform)}</span>
                    {a.username ? ` (@${a.username.replace(/^@/, '')})` : ''}: {a.message}
                    {a.status === 'needs_reconnect' && (
                      <>
                        {' '}
                        <Link href={`/dashboard/client/${clientId}/connect-platforms`} className="font-medium underline">
                          Reconnect
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {audience?.fetchedAt && (
            <p className="text-[11px] text-gray-400">
              Audience details from {new Date(audience.fetchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Platforms update them
              every day or two. Threads, X, Pinterest and Google Business don&apos;t share audience details.
            </p>
          )}
        </div>
        <div className="min-w-0">
          <TopFans fans={fans} clientId={clientId} />
        </div>
      </div>
    </div>
  )
}
