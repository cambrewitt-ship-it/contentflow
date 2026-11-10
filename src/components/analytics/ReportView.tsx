'use client'

import { ArrowDownRight, ArrowUpRight, Download, ExternalLink } from 'lucide-react'
import type { ReportData } from '@/lib/analytics/reportTypes'
import { MetricChart } from './MetricChart'

// The monthly report as the client sees it (shared link) and as the agency previews it.
// Prints cleanly to PDF ("Download PDF" uses the browser's print dialog).

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const PLATFORM: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', twitter: 'X', threads: 'Threads' }
const FORMAT: Record<string, string> = { reel: 'Reels', carousel: 'Carousels', image: 'Photos', video: 'Videos', text: 'Text posts' }

const longDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function Change({ now, before }: { now: number; before: number | null | undefined }) {
  if (!before) return <span className="text-xs text-gray-400">&nbsp;</span>
  const c = (now - before) / before
  const up = c >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-700'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(Math.round(c * 100))}% <span className="font-normal text-gray-500">vs last month</span>
    </span>
  )
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 break-inside-avoid">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function ReportView({ report, actions }: { report: ReportData; actions?: React.ReactNode }) {
  const t = report.totals
  const p = report.previousTotals
  const engagement = (x: NonNullable<typeof t>) => x.likes + x.comments + x.shares + x.saves
  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white p-4 text-gray-900 md:p-8 print:max-w-none print:p-0">
      {/* Print: page margins and a plain white page (the app background is a gradient) */}
      <style>{`@media print { @page { margin: 14mm; } html, body { background: #fff !important; } }`}</style>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-4">
          {report.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          )}
          <div>
            <p className="text-sm text-gray-500">Social media report</p>
            <h1 className="text-2xl font-bold">
              {report.clientName} · {report.periodLabel}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {actions}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </header>

      <section className="break-inside-avoid">
        <h2 className="text-xl font-semibold">{report.summary.headline}</h2>
        <p className="mt-2 leading-relaxed text-gray-700">{report.summary.overview}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="People reached" value={t ? compact.format(t.reach) : '—'}>
          {t && <Change now={t.reach} before={p?.reach} />}
        </Tile>
        <Tile label="Engagements" value={t ? compact.format(engagement(t)) : '—'}>
          {t && <Change now={engagement(t)} before={p ? engagement(p) : null} />}
        </Tile>
        <Tile label="Followers" value={report.followers ? fmt(report.followers.current) : '—'}>
          {report.followers && (
            <span className={`text-xs font-medium ${report.followers.gained >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {report.followers.gained >= 0 ? '+' : ''}
              {fmt(report.followers.gained)} <span className="font-normal text-gray-500">this month</span>
            </span>
          )}
        </Tile>
        <Tile label="Posts published" value={String(report.postCount)}>
          {t && <span className="text-xs text-gray-500">{t.engagementRate.toFixed(1)}% engagement rate</span>}
        </Tile>
      </section>

      {report.daily.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-4 break-inside-avoid">
          <h3 className="mb-2 font-semibold">People reached each day</h3>
          <MetricChart points={report.daily.map((d) => ({ date: d.date, value: d.reach }))} label="Reach" />
        </section>
      )}

      {report.summary.wins.length > 0 && (
        <section className="break-inside-avoid">
          <h3 className="mb-2 font-semibold">Highlights</h3>
          <ul className="space-y-1.5">
            {report.summary.wins.map((w) => (
              <li key={w} className="flex gap-2 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.topPosts.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">Top posts</h3>
          <div className="space-y-3">
            {report.topPosts.map((post, n) => (
              <div key={post.id} className="flex gap-3 rounded-xl border border-gray-200 p-3 break-inside-avoid">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {post.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">
                    #{n + 1} · {PLATFORM[post.platform] ?? post.platform} · {FORMAT[post.format] ?? post.format} ·{' '}
                    {new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {post.url && (
                      <a href={post.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-blue-600 print:hidden">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-800">{post.content}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-gray-600">
                    <span>{compact.format(post.metrics.reach || post.metrics.views)} {post.metrics.reach ? 'reached' : 'views'}</span>
                    <span>{fmt(post.metrics.likes)} likes</span>
                    <span>{fmt(post.metrics.comments)} comments</span>
                    {post.metrics.shares > 0 && <span>{fmt(post.metrics.shares)} shares</span>}
                    {post.metrics.saves > 0 && <span>{fmt(post.metrics.saves)} saves</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.byPlatform.length > 0 && (
        <section className="break-inside-avoid">
          <h3 className="mb-2 font-semibold">By platform</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 font-medium">Platform</th>
                <th className="py-2 text-right font-medium">Posts</th>
                <th className="py-2 text-right font-medium">Engagements</th>
              </tr>
            </thead>
            <tbody>
              {report.byPlatform.map((r) => (
                <tr key={r.platform} className="border-b border-gray-100">
                  <td className="py-2">{PLATFORM[r.platform] ?? r.platform}</td>
                  <td className="py-2 text-right tabular-nums">{r.posts}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.engagement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {report.summary.nextMonth.length > 0 && (
        <section className="rounded-xl bg-gray-50 p-5 break-inside-avoid">
          <h3 className="mb-2 font-semibold">Next month we&apos;ll focus on</h3>
          <ul className="space-y-1.5">
            {report.summary.nextMonth.map((n) => (
              <li key={n} className="flex gap-2 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-400">
        Results for {longDate(report.periodStart)} to {longDate(report.periodEnd)}, including posts made directly on each platform. Prepared{' '}
        {new Date(report.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
      </footer>
    </div>
  )
}
