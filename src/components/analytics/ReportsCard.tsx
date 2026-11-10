'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authedFetchJson } from '@/lib/authedFetch'
import type { ReportListItem } from '@/lib/analytics/reportTypes'

// Monthly client reports on the Analytics page: build one for a month, preview it,
// and copy the no-login link to send the client. Last month's is built automatically
// on the 1st (see /api/cron/monthly-reports).

function recentMonths(count = 6): Array<{ value: string; label: string }> {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return { value: d.toISOString().slice(0, 7), label: i === 0 ? `${label} (so far)` : label }
  })
}

export function ReportsCard({ clientId }: { clientId: string }) {
  const months = recentMonths()
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [setup, setSetup] = useState<string | null>(null)
  const [month, setMonth] = useState(months[1].value)
  const [building, setBuilding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [justBuilt, setJustBuilt] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await authedFetchJson<{ reports: ReportListItem[]; setupRequired?: string }>(`/api/clients/${clientId}/reports`)
      setReports(res.reports ?? [])
      setSetup(res.setupRequired ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const build = async (m: string) => {
    setBuilding(m)
    setError(null)
    try {
      const res = await authedFetchJson<{ shareToken: string }>(`/api/clients/${clientId}/reports`, {
        method: 'POST',
        body: { month: m },
        timeoutMs: 120_000,
      })
      await load()
      setJustBuilt(res.shareToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build the report')
    } finally {
      setBuilding(null)
    }
  }

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/report/${token}`)
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy — open the report and copy its address instead.')
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
        <FileText className="h-4 w-4 text-blue-600" /> Monthly reports
      </h3>
      <p className="mb-4 text-xs text-gray-500">
        A plain-English report to send the client, with a link that needs no login. Last month&apos;s is built automatically on the
        1st.
      </p>

      {setup ? (
        <p className="text-sm text-amber-700">{setup}</p>
      ) : (
        <>
          <div className="flex gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-sm"
              aria-label="Report month"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <Button size="sm" className="h-9" onClick={() => build(month)} disabled={!!building}>
              {building === month ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {reports.some((r) => r.periodStart.startsWith(month)) ? 'Rebuild' : 'Build report'}
            </Button>
          </div>
          {building && <p className="mt-2 text-xs text-gray-500">Reading the month&apos;s results and writing the summary — about 30 seconds.</p>}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          {reports.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100">
              {reports.map((r) => (
                <li key={r.id} className={`py-2.5 ${justBuilt === r.shareToken ? '-mx-2 rounded-lg bg-blue-50 px-2' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{r.periodLabel}</span>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/report/${r.shareToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                      <button
                        type="button"
                        onClick={() => copy(r.shareToken)}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        {copied === r.shareToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === r.shareToken ? 'Copied' : 'Copy link'}
                      </button>
                      <button
                        type="button"
                        title="Rebuild with the latest numbers (keeps the link)"
                        onClick={() => build(r.periodStart.slice(0, 7))}
                        disabled={!!building}
                        className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${building === r.periodStart.slice(0, 7) ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  {r.headline && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{r.headline}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
