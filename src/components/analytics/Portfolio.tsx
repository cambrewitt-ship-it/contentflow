'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CheckCircle2, ChevronRight, Lightbulb } from 'lucide-react'
import { authedFetchJson } from '@/lib/authedFetch'
import type { PortfolioClient } from '@/lib/analytics/types'

// Agency overview pieces for the main dashboard: a status strip on each client card
// and a "needs attention" list across every client, so a manager running many
// accounts sees where to look first.

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function usePortfolio(enabled: boolean) {
  const [clients, setClients] = useState<Record<string, PortfolioClient>>({})
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    authedFetchJson<{ clients: PortfolioClient[] }>('/api/analytics/portfolio', { timeoutMs: 60_000 })
      .then((res) => {
        if (!cancelled) setClients(Object.fromEntries((res.clients ?? []).map((c) => [c.clientId, c])))
      })
      .catch(() => {
        // The overview is a nice-to-have; the dashboard works without it
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { clients, loaded }
}

export function ClientPulse({ clientId, pulse }: { clientId: string; pulse: PortfolioClient | undefined }) {
  if (!pulse) return null
  const r = pulse.last30
  const tile =
    'group/tile rounded-xl border border-gray-200/70 bg-gray-50/70 px-3 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/60'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Link href={`/dashboard/client/${clientId}/analytics`} className={tile}>
          <div className="text-[11px] font-medium text-gray-500">Followers</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-gray-900">
            {pulse.followers ? compact.format(pulse.followers.current) : '—'}
          </div>
          <div className="truncate text-[11px] text-gray-400">
            {pulse.followers && pulse.followers.gained30d !== 0 ? (
              <span className={`font-medium tabular-nums ${pulse.followers.gained30d > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pulse.followers.gained30d > 0 ? '+' : ''}
                {compact.format(pulse.followers.gained30d)} · 30d
              </span>
            ) : (
              '30 days'
            )}
          </div>
        </Link>
        <Link href={`/dashboard/client/${clientId}/analytics`} className={tile}>
          <div className="text-[11px] font-medium text-gray-500">Engagement</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[15px] font-semibold tabular-nums text-gray-900">
              {r && r.posts ? `${r.medianEngagementRate.toFixed(1)}%` : '—'}
            </span>
            {pulse.engagementChange !== null && Math.abs(pulse.engagementChange) >= 0.05 && (
              <span className={`inline-flex items-center text-[11px] font-medium ${pulse.engagementChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pulse.engagementChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(Math.round(pulse.engagementChange * 100))}%
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-gray-400">{r?.posts ?? 0} posts (30d)</div>
        </Link>
        <Link href={`/dashboard/client/${clientId}/calendar`} className={tile}>
          <div className="text-[11px] font-medium text-gray-500">Scheduled</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-gray-900">{pulse.scheduledNext7}</div>
          <div className="truncate text-[11px] text-gray-400">Next 7 days</div>
        </Link>
      </div>
      {pulse.attention.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pulse.attention.map((a) => (
            <Link
              href={attentionHref(clientId, a.text)}
              key={a.text}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                a.level === 'critical'
                  ? 'border-red-200/70 bg-red-50/80 text-red-700 hover:bg-red-100/70'
                  : 'border-amber-200/70 bg-amber-50/80 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              {a.level === 'critical' ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {a.text}
              {isGap(a.text) && pulse.autoFill && ' · auto-drafting'}
            </Link>
          ))}
        </div>
      )}
      {pulse.topRecommendation && (
        <Link
          href={`/dashboard/client/${clientId}/analytics`}
          className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50/60 px-3 py-2 text-xs text-gray-700 ring-1 ring-blue-100/70 transition-colors hover:from-blue-100/70"
        >
          <Lightbulb className="mt-px h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
          <span className="line-clamp-1">{pulse.topRecommendation}</span>
        </Link>
      )}
    </div>
  )
}

export const isGap = (text: string) => text.startsWith('Nothing scheduled') || text.startsWith('Only ')

/** Where each attention item leads: gaps open the Content Agent with a ready brief. */
export function attentionHref(clientId: string, text: string): string {
  if (text.startsWith('No social')) return `/dashboard/client/${clientId}/connect-platforms`
  if (isGap(text)) {
    const brief = `Fill the gaps in the next 7 days (${text.toLowerCase()}). Put posts on the empty days first and lean into what has performed best.`
    return `/dashboard/client/${clientId}/autopilot?brief=${encodeURIComponent(brief)}`
  }
  if (text.startsWith('Engagement down') || text.startsWith('Posting slowed')) return `/dashboard/client/${clientId}/analytics`
  if (text.includes('Feed Checker')) return `/dashboard/client/${clientId}/feed-checker`
  if (text.includes('waiting for a reply')) return `/dashboard/client/${clientId}/comments`
  return `/dashboard/client/${clientId}/calendar`
}

export function AttentionSummary({
  clients,
  names,
  logos = {},
  showBrand = true,
  loaded = true,
  limit = 5,
}: {
  clients: Record<string, PortfolioClient>
  names: Record<string, string>
  /** Brand logos by client id, shown next to each item */
  logos?: Record<string, string | undefined>
  /** Hide brand names when there's only one brand */
  showBrand?: boolean
  /** Overview has loaded — shows the "all clear" state when nothing needs attention */
  loaded?: boolean
  limit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const items = Object.values(clients)
    .flatMap((c) => c.attention.map((a) => ({ ...a, clientId: c.clientId })))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1))
  const critical = items.filter((a) => a.level === 'critical').length
  const warnings = items.length - critical

  if (!items.length) {
    if (!loaded) return null
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 shadow-card backdrop-blur-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">All clear</p>
          <p className="text-xs text-gray-500">Nothing needs your attention right now.</p>
        </div>
      </div>
    )
  }

  const visible = expanded ? items : items.slice(0, limit)
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Bell className="h-3.5 w-3.5" />
          </span>
          Needs attention
        </h2>
        <div className="flex items-center gap-1.5">
          {critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-100">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {critical} urgent
            </span>
          )}
          {warnings > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {warnings} to review
            </span>
          )}
        </div>
      </header>
      <ul className="divide-y divide-gray-100">
        {visible.map((a) => {
          const name = names[a.clientId] ?? 'Client'
          const logo = logos[a.clientId]
          return (
            <li key={`${a.clientId}:${a.text}`}>
              <Link
                href={attentionHref(a.clientId, a.text)}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50/80"
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.level === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                {showBrand && (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-50 text-[10px] font-semibold text-blue-700 ring-1 ring-gray-200/70">
                    {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {showBrand && <span className="font-medium text-gray-900">{name} </span>}
                  <span className={showBrand ? 'text-gray-600' : 'text-gray-800'}>
                    {showBrand && '· '}
                    {a.text}
                  </span>
                </span>
                {isGap(a.text) && clients[a.clientId]?.autoFill && (
                  <span className="hidden flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 sm:inline">
                    auto-drafting
                  </span>
                )}
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </Link>
            </li>
          )
        })}
      </ul>
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-gray-100 px-4 py-2 text-left text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50/50"
        >
          {expanded ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  )
}
