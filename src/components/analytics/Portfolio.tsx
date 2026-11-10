'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, Lightbulb } from 'lucide-react'
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
  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Link href={`/dashboard/client/${clientId}/analytics`} className="rounded-lg bg-gray-50 px-2 py-2 hover:bg-gray-100">
          <div className="text-sm font-semibold tabular-nums text-gray-900">
            {pulse.followers ? compact.format(pulse.followers.current) : '—'}
          </div>
          <div className="text-[10px] text-gray-500">
            Followers
            {pulse.followers && pulse.followers.gained30d !== 0 && (
              <span className={pulse.followers.gained30d > 0 ? 'text-emerald-700' : 'text-red-700'}>
                {' '}
                {pulse.followers.gained30d > 0 ? '+' : ''}
                {compact.format(pulse.followers.gained30d)}
              </span>
            )}
          </div>
        </Link>
        <Link href={`/dashboard/client/${clientId}/analytics`} className="rounded-lg bg-gray-50 px-2 py-2 hover:bg-gray-100">
          <div className="flex items-center justify-center gap-0.5 text-sm font-semibold tabular-nums text-gray-900">
            {r && r.posts ? `${r.medianEngagementRate.toFixed(1)}%` : '—'}
            {pulse.engagementChange !== null && Math.abs(pulse.engagementChange) >= 0.05 && (
              <span className={`inline-flex items-center text-[10px] ${pulse.engagementChange > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {pulse.engagementChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(Math.round(pulse.engagementChange * 100))}%
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500">Engagement · {r?.posts ?? 0} posts (30d)</div>
        </Link>
        <Link href={`/dashboard/client/${clientId}/calendar`} className="rounded-lg bg-gray-50 px-2 py-2 hover:bg-gray-100">
          <div className="text-sm font-semibold tabular-nums text-gray-900">{pulse.scheduledNext7}</div>
          <div className="text-[10px] text-gray-500">Scheduled next 7 days</div>
        </Link>
      </div>
      {pulse.attention.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pulse.attention.map((a) => (
            <Link
              href={attentionHref(clientId, a.text)}
              key={a.text}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                a.level === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
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
          className="flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-amber-50"
        >
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          <span className="line-clamp-1">{pulse.topRecommendation}</span>
        </Link>
      )}
    </div>
  )
}

const isGap = (text: string) => text.startsWith('Nothing scheduled') || text.startsWith('Only ')

/** Where each attention item leads: gaps open the Content Agent with a ready brief. */
function attentionHref(clientId: string, text: string): string {
  if (text.startsWith('No social')) return `/dashboard/client/${clientId}/connect-platforms`
  if (isGap(text)) {
    const brief = `Fill the gaps in the next 7 days (${text.toLowerCase()}). Put posts on the empty days first and lean into what has performed best.`
    return `/dashboard/client/${clientId}/autopilot?brief=${encodeURIComponent(brief)}`
  }
  if (text.startsWith('Engagement down') || text.startsWith('Posting slowed')) return `/dashboard/client/${clientId}/analytics`
  return `/dashboard/client/${clientId}/calendar`
}

export function AttentionSummary({
  clients,
  names,
}: {
  clients: Record<string, PortfolioClient>
  names: Record<string, string>
}) {
  const items = Object.values(clients)
    .flatMap((c) => c.attention.map((a) => ({ ...a, clientId: c.clientId })))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1))
  if (!items.length) return null
  return (
    <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
      </p>
      <ul className="space-y-1.5">
        {items.slice(0, 8).map((a) => (
          <li key={`${a.clientId}:${a.text}`} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.level === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <Link href={attentionHref(a.clientId, a.text)} className="hover:underline">
              <span className="font-medium text-gray-900">{names[a.clientId] ?? 'Client'}</span>
              <span className="text-gray-600"> — {a.text}</span>
            </Link>
            {isGap(a.text) && clients[a.clientId]?.autoFill && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">auto-drafting</span>
            )}
          </li>
        ))}
      </ul>
      {items.length > 8 && <p className="mt-2 text-xs text-gray-500">+{items.length - 8} more below</p>}
    </div>
  )
}
