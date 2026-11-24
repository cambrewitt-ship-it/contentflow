'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatHour } from '@/lib/analytics/insights'
import type { AnalyticsPost } from '@/lib/analytics/types'
import {
  bestCell,
  EMPTY_CELL,
  OTHER_COLOR,
  SEQUENTIAL,
  SHORT_DAYS,
  platformColor,
  platformLabel,
  sequentialColor,
  type DayActivity,
  type HeatCell,
  type Slice,
} from '@/lib/analytics/visuals'

// Hand-built SVG/CSS charts for analytics: day × hour heatmap, activity calendar,
// donut with legend, weekday columns, post timeline and sparklines. Every mark has a
// hover tooltip; text stays in gray ink, colour only on marks.

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function useWidth<T extends HTMLElement>(initial = 640, min = 200) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(min, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [min])
  return [ref, width] as const
}

function Tooltip({ x, y, children, containerWidth }: { x: number; y: number; children: React.ReactNode; containerWidth: number }) {
  const left = Math.min(Math.max(x, 70), Math.max(70, containerWidth - 70))
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-gray-200/80 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  )
}

export function SequentialLegend({ low = 'Less', high = 'More' }: { low?: string; high?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
      <span>{low}</span>
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: EMPTY_CELL }} />
      {SEQUENTIAL.filter((_, i) => i % 2 === 0).map((c) => (
        <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
      ))}
      <span>{high}</span>
    </div>
  )
}

function BaselineKey({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-gray-500 ${inline ? '' : 'mt-1'}`}>
      <svg width="18" height="6" aria-hidden>
        <line x1="0" x2="18" y1="3" y2="3" stroke="#52514e" strokeDasharray="4 3" />
      </svg>
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Day × hour heatmap                                                  */
/* ------------------------------------------------------------------ */

export function WeekHeatmap({
  cells,
  describe,
  compactSize,
  ariaLabel,
}: {
  cells: HeatCell[]
  /** Tooltip lines for a cell */
  describe: (cell: HeatCell) => React.ReactNode
  compactSize?: boolean
  ariaLabel: string
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ cell: HeatCell; x: number; y: number } | null>(null)
  const max = Math.max(0, ...cells.map((c) => c.value))
  const best = bestCell(cells)
  const rowH = compactSize ? 14 : 22
  const labelW = compactSize ? 28 : 36

  return (
    <div ref={wrapRef} className="relative" onPointerLeave={() => setHover(null)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `${labelW}px repeat(24, minmax(0, 1fr))` }}
      >
        {SHORT_DAYS.map((d, day) => (
          <div key={d} className="contents">
            <div className="flex items-center text-[11px] text-gray-500" style={{ height: rowH }}>
              {compactSize ? d.charAt(0) + d.charAt(1) : d}
            </div>
            {cells
              .filter((c) => c.day === day)
              .map((c) => {
                const isBest = best && c.day === best.day && c.hour === best.hour
                return (
                  <div
                    key={c.hour}
                    className={`relative rounded-[3px] transition-transform duration-100 hover:z-10 hover:scale-125 ${
                      isBest ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                    }`}
                    style={{ height: rowH, background: c.value > 0 && max > 0 ? sequentialColor(c.value / max) : EMPTY_CELL }}
                    onPointerEnter={(e) => {
                      const host = wrapRef.current?.getBoundingClientRect()
                      const r = e.currentTarget.getBoundingClientRect()
                      if (host) setHover({ cell: c, x: r.left - host.left + r.width / 2, y: r.top - host.top })
                    }}
                  />
                )
              })}
          </div>
        ))}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="pt-1 text-center text-[10px] text-gray-400">
            {h % (width < 520 ? 6 : 3) === 0 ? formatHour(h) : ''}
          </div>
        ))}
      </div>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} containerWidth={width}>
          <div className="text-gray-500">
            {DAY_NAMES[hover.cell.day]} {formatHour(hover.cell.hour)}–{formatHour((hover.cell.hour + 1) % 24)}
          </div>
          <div className="text-gray-900">{describe(hover.cell)}</div>
        </Tooltip>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Activity calendar (one square per day)                              */
/* ------------------------------------------------------------------ */

export type CalendarMetric = 'engagement' | 'reach' | 'posts'

export function ActivityCalendar({
  days,
  metric,
  weeks = 53,
  todayKey,
}: {
  days: Map<string, DayActivity>
  metric: CalendarMetric
  weeks?: number
  /** Today's YYYY-MM-DD in the client's timezone */
  todayKey: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sizeRef, available] = useWidth<HTMLDivElement>(700, 100)
  const [hover, setHover] = useState<{ key: string; row: DayActivity | null; x: number; y: number } | null>(null)
  const gap = 2
  // Fill the card on wide screens; scroll sideways (newest first in view) on phones
  const cell = Math.max(11, Math.min(18, Math.floor((available - 28) / weeks) - gap))

  const { columns, monthLabels, max } = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00Z`)
    const dow = (today.getUTCDay() + 6) % 7 // 0 = Monday
    const start = new Date(today)
    start.setUTCDate(start.getUTCDate() - dow - (weeks - 1) * 7)
    const columns: Array<Array<{ key: string; future: boolean }>> = []
    const monthLabels: Array<{ col: number; label: string }> = []
    let lastMonth = -1
    for (let w = 0; w < weeks; w++) {
      const col: Array<{ key: string; future: boolean }> = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setUTCDate(start.getUTCDate() + w * 7 + d)
        const key = date.toISOString().slice(0, 10)
        col.push({ key, future: key > todayKey })
        if (d === 0 && date.getUTCMonth() !== lastMonth) {
          lastMonth = date.getUTCMonth()
          monthLabels.push({ col: w, label: date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) })
        }
      }
      columns.push(col)
    }
    let max = 0
    for (const row of days.values()) max = Math.max(max, row[metric])
    return { columns, monthLabels, max }
  }, [days, metric, weeks, todayKey])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [columns, cell])

  const W = 28 + weeks * (cell + gap)
  const H = 18 + 7 * (cell + gap)

  return (
    <div ref={sizeRef} className="relative" onPointerLeave={() => setHover(null)}>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <svg width={W} height={H} role="img" aria-label={`Daily ${metric} calendar`} className="block">
          {monthLabels.map((m) => (
            <text key={`${m.col}-${m.label}`} x={28 + m.col * (cell + gap)} y={11} className="fill-gray-400 text-[10px]">
              {m.label}
            </text>
          ))}
          {[0, 2, 4].map((d) => (
            <text key={d} x={0} y={18 + d * (cell + gap) + cell - 2} className="fill-gray-400 text-[10px]">
              {SHORT_DAYS[d]}
            </text>
          ))}
          {columns.map((col, w) =>
            col.map(({ key, future }, d) => {
              if (future) return null
              const row = days.get(key) ?? null
              const v = row ? row[metric] : 0
              const x = 28 + w * (cell + gap)
              const y = 18 + d * (cell + gap)
              return (
                <rect
                  key={key}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={v > 0 && max > 0 ? sequentialColor(Math.sqrt(v / max)) : EMPTY_CELL}
                  stroke={hover?.key === key ? '#0d366b' : 'none'}
                  strokeWidth={1.5}
                  onPointerEnter={(e) => {
                    const host = scrollRef.current?.getBoundingClientRect()
                    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                    if (host) setHover({ key, row, x: r.left - host.left + r.width / 2, y: r.top - host.top })
                  }}
                />
              )
            })
          )}
        </svg>
      </div>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} containerWidth={scrollRef.current?.clientWidth ?? 600}>
          <div className="text-gray-500">
            {new Date(`${hover.key}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          </div>
          {hover.row ? (
            <div className="text-gray-900">
              <span className="font-semibold">{hover.row.posts}</span> post{hover.row.posts === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold">{fmt(hover.row.engagement)}</span> engagements ·{' '}
              <span className="font-semibold">{compact.format(hover.row.reach)}</span> reach
            </div>
          ) : (
            <div className="text-gray-500">No posts</div>
          )}
        </Tooltip>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Donut + legend                                                      */
/* ------------------------------------------------------------------ */

export function Donut({
  slices,
  centerLabel,
  valueFormat = (n) => compact.format(n),
  size = 150,
}: {
  slices: Slice[]
  centerLabel: string
  valueFormat?: (n: number) => string
  size?: number
}) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (!total) return <p className="text-sm text-gray-500">No results in this period yet.</p>

  const r = size / 2 - 4
  const inner = r * 0.64
  const cx = size / 2
  let angle = -Math.PI / 2
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * Math.PI * 2
      const a0 = angle
      const a1 = angle + sweep
      angle = a1
      const large = sweep > Math.PI ? 1 : 0
      const p = (rad: number, rr: number) => `${(cx + rr * Math.cos(rad)).toFixed(2)},${(cx + rr * Math.sin(rad)).toFixed(2)}`
      // A single 100% slice can't be drawn as one arc; split it in two
      const d =
        sweep >= Math.PI * 2 - 1e-6
          ? `M${p(a0, r)}A${r},${r} 0 1 1 ${p(a0 + Math.PI, r)}A${r},${r} 0 1 1 ${p(a0, r)}M${p(a0, inner)}A${inner},${inner} 0 1 0 ${p(a0 + Math.PI, inner)}A${inner},${inner} 0 1 0 ${p(a0, inner)}Z`
          : `M${p(a0, r)}A${r},${r} 0 ${large} 1 ${p(a1, r)}L${p(a1, inner)}A${inner},${inner} 0 ${large} 0 ${p(a0, inner)}Z`
      return { ...s, d }
    })
  const shown = active ? slices.find((s) => s.key === active) : null

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} split`} className="flex-shrink-0">
        {arcs.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill={a.color}
            fillRule="evenodd"
            stroke="white"
            strokeWidth={2}
            opacity={active && active !== a.key ? 0.35 : 1}
            className="cursor-default transition-opacity"
            onPointerEnter={() => setActive(a.key)}
            onPointerLeave={() => setActive(null)}
          />
        ))}
        <text x={cx} y={cx - 2} textAnchor="middle" className="fill-gray-900 text-[18px] font-semibold">
          {shown ? `${Math.round((shown.value / total) * 100)}%` : valueFormat(total)}
        </text>
        <text x={cx} y={cx + 15} textAnchor="middle" className="fill-gray-500 text-[11px]">
          {shown ? shown.label : centerLabel}
        </text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((s) => (
          <li
            key={s.key}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors ${active === s.key ? 'bg-gray-50' : ''}`}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-gray-700">{s.label}</span>
            <span className="tabular-nums text-gray-900">{valueFormat(s.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-gray-500">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Vertical columns with a baseline reference                          */
/* ------------------------------------------------------------------ */

export function Columns({
  items,
  baseline,
  baselineLabel = 'Usual',
  valueFormat = (n) => `${n.toFixed(1)}%`,
  height = 180,
  describe,
}: {
  items: Array<{ key: string; label: string; value: number; count: number }>
  baseline?: number
  baselineLabel?: string
  valueFormat?: (n: number) => string
  height?: number
  describe?: (item: { label: string; value: number; count: number }) => React.ReactNode
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const PAD = { top: 18, bottom: 22, left: 4, right: 4 }
  const max = Math.max(0.01, baseline ?? 0, ...items.map((i) => i.value)) * 1.08
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, items.length)
  const barW = Math.min(44, slot * 0.62)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const bestIdx = items.reduce((best, it, i) => (it.count >= 3 && (best < 0 || it.value > items[best].value) ? i : best), -1)

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      <svg width={width} height={height} className="block" role="img" aria-label="Column chart">
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#d9dee7" />
        {items.map((it, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const top = y(it.value)
          const h = Math.max(0, y(0) - top)
          const r = Math.min(4, h / 2, barW / 2)
          const thin = it.count < 3
          return (
            <g key={it.key} onPointerEnter={() => setHover(i)}>
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${cx - barW / 2},${y(0)}V${top + r}Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top}H${cx + barW / 2 - r}Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r}V${y(0)}Z`}
                  fill={thin ? '#b7d3f6' : '#2a78d6'}
                  opacity={hover !== null && hover !== i ? 0.55 : 1}
                  className="transition-opacity"
                />
              )}
              {(i === bestIdx || hover === i) && it.value > 0 && (
                <text x={cx} y={top - 5} textAnchor="middle" className="fill-gray-700 text-[11px] font-medium">
                  {valueFormat(it.value)}
                </text>
              )}
              <text x={cx} y={height - 6} textAnchor="middle" className={`text-[11px] ${i === bestIdx ? 'fill-gray-900 font-semibold' : 'fill-gray-500'}`}>
                {it.label}
              </text>
            </g>
          )
        })}
        {baseline !== undefined && baseline > 0 && (
          <line x1={PAD.left} x2={width - PAD.right} y1={y(baseline)} y2={y(baseline)} stroke="#52514e" strokeDasharray="4 4" strokeWidth={1} />
        )}
      </svg>
      {baseline !== undefined && baseline > 0 && <BaselineKey label={`${baselineLabel} ${valueFormat(baseline)}`} />}
      {hover !== null && items[hover] && (
        <Tooltip x={PAD.left + slot * hover + slot / 2} y={y(items[hover].value)} containerWidth={width}>
          {describe ? (
            describe(items[hover])
          ) : (
            <>
              <div className="text-gray-500">{items[hover].label}</div>
              <div className="text-gray-900">
                <span className="font-semibold">{valueFormat(items[hover].value)}</span> · {items[hover].count} posts
              </div>
            </>
          )}
        </Tooltip>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Post timeline: every post as a dot, engagement rate over time       */
/* ------------------------------------------------------------------ */

export function PostTimeline({ posts, median: med }: { posts: AnalyticsPost[]; median: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<AnalyticsPost | null>(null)
  const height = 240
  const PAD = { top: 14, right: 12, bottom: 26, left: 40 }

  // Up to three platforms keep their own colour; the rest share "Other" so dots stay distinguishable
  const platforms = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) counts.set(p.platform, (counts.get(p.platform) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [posts])
  const named = platforms.slice(0, 3)
  const colorOf = (p: string) => (named.includes(p) ? platformColor(p) : OTHER_COLOR)

  const sorted = useMemo(() => [...posts].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt)), [posts])
  if (!sorted.length) return <p className="text-sm text-gray-500">No posts in this period.</p>

  const t0 = Date.parse(sorted[0].publishedAt)
  const t1 = Math.max(t0 + 86_400_000, Date.parse(sorted[sorted.length - 1].publishedAt))
  const rates = sorted.map((p) => p.metrics.engagementRate).sort((a, b) => a - b)
  // Cap the scale at the 95th percentile so one viral post doesn't flatten the rest
  const cap = Math.max(1, rates[Math.floor(rates.length * 0.95)] ?? 1, med * 2) * 1.1
  const maxReach = Math.max(1, ...sorted.map((p) => p.metrics.reach || p.metrics.views))
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW
  const y = (v: number) => PAD.top + innerH - (Math.min(v, cap) / cap) * innerH
  const ticks = [0, cap / 2, cap]
  const tickCount = Math.max(2, Math.min(6, Math.floor(width / 120)))
  const xTicks = Array.from({ length: tickCount }, (_, i) => t0 + ((t1 - t0) * i) / (tickCount - 1))

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
        <svg width={width} height={height} className="block" role="img" aria-label="Engagement rate of each post over time">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5eaf2" strokeDasharray={i ? '3 4' : undefined} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">
                {t.toFixed(t < 10 ? 1 : 0)}%
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={t} x={x(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} className="fill-gray-400 text-[11px]">
              {new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </text>
          ))}
          {med > 0 && <line x1={PAD.left} x2={width - PAD.right} y1={y(med)} y2={y(med)} stroke="#52514e" strokeDasharray="4 4" />}
          {sorted.map((p) => {
            const reach = p.metrics.reach || p.metrics.views
            const r = 4 + Math.sqrt(reach / maxReach) * 7
            const active = hover?.id === p.id
            return (
              <circle
                key={p.id}
                cx={x(Date.parse(p.publishedAt))}
                cy={y(p.metrics.engagementRate)}
                r={active ? r + 2 : r}
                fill={colorOf(p.platform)}
                fillOpacity={hover && !active ? 0.35 : 0.85}
                stroke="white"
                strokeWidth={2}
                onPointerEnter={() => setHover(p)}
              />
            )
          })}
        </svg>
        {hover && (
          <Tooltip x={x(Date.parse(hover.publishedAt))} y={y(hover.metrics.engagementRate)} containerWidth={width}>
            <div className="flex max-w-[260px] items-start gap-2 whitespace-normal">
              {hover.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hover.thumbnailUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <div className="text-gray-500">
                  {platformLabel(hover.platform)} · {new Date(hover.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </div>
                <div className="line-clamp-2 text-gray-700">{hover.content || 'No caption'}</div>
                <div className="mt-0.5 text-gray-900">
                  <span className="font-semibold">{hover.metrics.engagementRate.toFixed(1)}%</span> engagement ·{' '}
                  {compact.format(hover.metrics.reach || hover.metrics.views)} reach
                </div>
              </div>
            </div>
          </Tooltip>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {named.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: platformColor(p) }} />
            {platformLabel(p)}
          </span>
        ))}
        {platforms.length > 3 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: OTHER_COLOR }} />
            Other
          </span>
        )}
        {med > 0 && <BaselineKey label={`Usual ${med.toFixed(1)}%`} inline />}
        <span>Bigger dot = more reach</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, color = '#2a78d6', height = 36 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(120, 40)
  if (values.length < 2) return <div ref={ref} style={{ height }} />
  const max = Math.max(...values)
  const min = Math.min(0, ...values)
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => 3 + (height - 6) * (1 - (v - min) / (max - min || 1))
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = `${line}L${x(values.length - 1).toFixed(1)},${height}L${x(0).toFixed(1)},${height}Z`
  return (
    <div ref={ref} aria-hidden>
      <svg width={width} height={height} className="block">
        <path d={area} fill={color} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={color} />
      </svg>
    </div>
  )
}
