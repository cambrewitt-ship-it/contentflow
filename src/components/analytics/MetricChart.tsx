'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Single-series daily line chart with a crosshair tooltip. One measure at a time
// (switch metrics with the toggle above it) — never two scales on one axis.

interface Point {
  date: string
  value: number
}

const H = 220
const PAD = { top: 12, right: 12, bottom: 26, left: 44 }

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

function niceMax(max: number): number {
  if (max <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  const n = max / pow
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10
  return step * pow
}

function dateLabel(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

export function MetricChart({ points, label, color = '#2563eb' }: { points: Point[]; label: string; color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  // Draw at the real width so text stays readable on phones
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { path, area, yTicks, x, y, xTicks } = useMemo(() => {
    const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
    const min = Math.min(0, ...points.map((p) => p.value))
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2)
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
    const area = points.length
      ? `${path}L${x(points.length - 1).toFixed(1)},${y(Math.max(min, 0))}L${x(0).toFixed(1)},${y(Math.max(min, 0))}Z`
      : ''
    const yTicks = [0, 0.5, 1].map((f) => min + (max - min) * f)
    const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 110))))
    const xTicks = points.map((p, i) => ({ i, date: p.date })).filter(({ i }) => i % every === 0)
    return { path, area, yTicks, x, y, xTicks }
  }, [points, W])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || !points.length) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const innerW = W - PAD.left - PAD.right
    const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  if (!points.length) {
    return (
      <div ref={wrapRef} className="flex h-[220px] items-center justify-center text-sm text-gray-400">
        No data for this period yet
      </div>
    )
  }

  const hp = hover !== null ? points[hover] : null
  const tooltipLeft = hover !== null ? (x(hover) / W) * 100 : 0

  return (
    <div ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block w-full touch-none select-none"
        role="img"
        aria-label={`${label} per day`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">
              {compact.format(t)}
            </text>
          </g>
        ))}
        {xTicks.map(({ i, date }) => (
          <text key={date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[11px]">
            {dateLabel(date)}
          </text>
        ))}
        <path d={area} fill={color} opacity={0.08} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && hp && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hp.value)} r={5} fill={color} stroke="white" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(88, Math.max(12, tooltipLeft))}%` }}
        >
          <div className="text-gray-500">{dateLabel(hp.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div className="font-semibold text-gray-900">
            {hp.value.toLocaleString()} <span className="font-normal text-gray-500">{label.toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
