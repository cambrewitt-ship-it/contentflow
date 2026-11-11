'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Info,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { PortfolioClient } from '@/lib/analytics/types'
import { attentionHref } from '@/components/analytics/Portfolio'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Building blocks for the dashboard overview (the agency Home and a brand's own
// dashboard). Presentational only: they show data the pages already have.

export interface OverviewBrand {
  id: string
  name: string
  logo_url?: string | null
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

// ── Brand logo ───────────────────────────────────────────────────────────

export function BrandLogo({ brand, size = 44, unread = 0 }: { brand: OverviewBrand; size?: number; unread?: number }) {
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold',
          brand.logo_url ? 'bg-white ring-1 ring-gray-200' : 'bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 ring-1 ring-blue-200/70'
        )}
        style={{ fontSize: size * 0.42 }}
      >
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={`${brand.name} logo`} className="h-full w-full object-cover" />
        ) : (
          brand.name.charAt(0).toUpperCase()
        )}
      </span>
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white"
          title={`${unread} unread notification${unread === 1 ? '' : 's'}`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </span>
  )
}

// ── Welcome header ───────────────────────────────────────────────────────

export function WelcomeHeader({
  logo,
  title,
  subtitle,
  meta,
  actions,
}: {
  logo: ReactNode
  title: ReactNode
  subtitle: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4 md:gap-6">
        <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-3xl border border-white/80 bg-white/90 shadow-card backdrop-blur-sm md:h-24 md:w-24">
          {logo}
        </div>
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-gray-900 md:text-[34px]">{title}</h1>
          <p className="mt-1 text-[15px] text-gray-500 md:text-lg">{subtitle}</p>
          {meta && <div className="mt-1.5 text-xs text-gray-400">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const createBtn =
  'group inline-flex h-12 items-center gap-2.5 rounded-2xl bg-gradient-ai px-6 text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgb(99_102_241/0.55)] transition-all hover:-translate-y-px hover:brightness-105 hover:shadow-[0_14px_34px_-8px_rgb(99_102_241/0.65)] active:translate-y-0'

/** Create Content: straight to the brand's Content Suite, or pick a brand when there are several. */
export function CreateContentAction({ brands }: { brands: OverviewBrand[] }) {
  if (brands.length === 1) {
    return (
      <Link href={`/dashboard/client/${brands[0].id}/content-suite`} className={createBtn}>
        <Sparkles className="h-5 w-5" />
        Create Content
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={createBtn}>
          <Sparkles className="h-5 w-5" />
          Create Content
          <ChevronDown className="h-4 w-4 opacity-80" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuLabel className="px-2">Create content for</DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {brands.map((b) => (
            <DropdownMenuItem key={b.id} asChild className="cursor-pointer gap-2.5">
              <Link href={`/dashboard/client/${b.id}/content-suite`}>
                <BrandLogo brand={b} size={26} />
                <span className="truncate text-[13px] font-medium">{b.name}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Attention banner ─────────────────────────────────────────────────────

export interface AttentionItem {
  clientId: string
  level: 'critical' | 'warning'
  text: string
}

/** Every attention item across the given portfolio entries, most urgent first. */
export function attentionItems(pulses: Array<PortfolioClient | undefined>): AttentionItem[] {
  return pulses
    .filter((p): p is PortfolioClient => !!p)
    .flatMap((p) => p.attention.map((a) => ({ ...a, clientId: p.clientId })))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1))
}

export function AttentionBanner({
  items,
  names,
  showBrand,
}: {
  items: AttentionItem[]
  names: Record<string, string>
  showBrand: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  if (!items.length || dismissed) return null
  const critical = items.some((i) => i.level === 'critical')
  const summary = items
    .slice(0, 3)
    .map((i) => (showBrand ? `${names[i.clientId] ?? 'Client'}: ${i.text.charAt(0).toLowerCase()}${i.text.slice(1)}` : i.text))
    .join(' · ')

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-white/80 bg-white/75 shadow-card backdrop-blur-xl',
        'border-l-4',
        critical ? 'border-l-red-500' : 'border-l-blue-600'
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3.5 md:px-5">
        <span
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1',
            critical ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-blue-50 text-blue-600 ring-blue-100'
          )}
        >
          <Info className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900">
            {items.length} item{items.length === 1 ? '' : 's'} need{items.length === 1 ? 's' : ''} your attention
          </p>
          <p className="truncate text-[13px] text-gray-600">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="hidden flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-800 shadow-xs transition-colors hover:bg-gray-50 sm:inline-flex"
        >
          {open ? 'Hide details' : 'View details'}
          <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border-t border-gray-100 px-4 py-2 text-left text-xs font-medium text-blue-700 sm:hidden"
      >
        {open ? 'Hide details' : 'View details'}
      </button>
      {open && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 bg-white/70">
          {items.map((a) => (
            <li key={`${a.clientId}:${a.text}`}>
              <Link
                href={attentionHref(a.clientId, a.text)}
                className="group flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
              >
                <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', a.level === 'critical' ? 'bg-red-500' : 'bg-amber-400')} />
                <span className="min-w-0 flex-1 truncate">
                  {showBrand && <span className="font-medium text-gray-900">{names[a.clientId] ?? 'Client'} · </span>}
                  <span className="text-gray-700">{a.text}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Stat cards ───────────────────────────────────────────────────────────

const TONE = {
  blue: { ring: 'bg-blue-50 text-blue-600 ring-blue-100', bar: 'from-blue-500 to-cyan-400' },
  violet: { ring: 'bg-violet-50 text-violet-600 ring-violet-100', bar: 'from-violet-500 to-fuchsia-400' },
  emerald: { ring: 'bg-emerald-50 text-emerald-600 ring-emerald-100', bar: 'from-emerald-500 to-teal-300' },
  amber: { ring: 'bg-amber-50 text-amber-600 ring-amber-100', bar: 'from-amber-500 to-orange-300' },
  red: { ring: 'bg-red-50 text-red-600 ring-red-100', bar: 'from-red-500 to-rose-300' },
} as const

export interface StatCardProps {
  icon: LucideIcon
  value: ReactNode
  label: string
  /** Positive/negative change, shown with an arrow (real data only) */
  change?: { value: string; up: boolean } | null
  /** Plain supporting line when there's no change to show */
  note?: string
  tone?: keyof typeof TONE
  /** Small bar chart of real values (e.g. one bar per brand) */
  bars?: Array<{ label: string; value: number }>
  href?: string
  loading?: boolean
}

function MiniBars({ bars, tone }: { bars: Array<{ label: string; value: number }>; tone: keyof typeof TONE }) {
  const max = Math.max(...bars.map((b) => b.value), 0)
  if (bars.length < 2 || max <= 0) return null
  return (
    <div className="flex h-10 w-16 flex-shrink-0 items-end gap-[3px] self-end" aria-hidden="true">
      {bars.slice(0, 10).map((b) => (
        <span
          key={b.label}
          title={`${b.label}: ${b.value}`}
          className={cn('flex-1 rounded-t-[3px] bg-gradient-to-t opacity-80', TONE[tone].bar)}
          style={{ height: `${Math.max(8, (b.value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export function StatCard({ icon: Icon, value, label, change, note, tone = 'blue', bars, href, loading }: StatCardProps) {
  const body = (
    <div className="flex items-center gap-3.5">
      <span className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ring-1', TONE[tone].ring)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[26px] font-bold leading-8 tracking-[-0.02em] tabular-nums text-gray-900">
          {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded-md bg-gray-100 align-middle" /> : value}
        </div>
        <div className="truncate text-[13px] text-gray-500">{label}</div>
        {change ? (
          <div className={cn('mt-1 inline-flex items-center gap-0.5 text-xs font-medium', change.up ? 'text-emerald-600' : 'text-red-600')}>
            {change.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {change.value}
          </div>
        ) : note ? (
          <div className="mt-1 truncate text-xs text-gray-400">{note}</div>
        ) : null}
      </div>
      {bars && !loading && <MiniBars bars={bars} tone={tone} />}
    </div>
  )
  const cls = 'block rounded-2xl border border-white/80 bg-white/90 p-4 shadow-card backdrop-blur-sm transition-all duration-200'
  return href ? (
    <Link href={href} className={cn(cls, 'hover:-translate-y-0.5 hover:shadow-card-hover')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────

export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-3xl border border-white/80 bg-white/90 p-5 shadow-card backdrop-blur-sm md:p-6', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[19px] font-bold tracking-[-0.02em] text-gray-900">
          {Icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Icon className="h-5 w-5" />
            </span>
          )}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function PillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-800 shadow-xs transition-colors hover:bg-gray-50"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

// ── Client cards ─────────────────────────────────────────────────────────

export function ClientCard({ brand, pulse, unread }: { brand: OverviewBrand; pulse: PortfolioClient | undefined; unread: number }) {
  const critical = pulse?.attention.filter((a) => a.level === 'critical').length ?? 0
  const issues = pulse?.attention.length ?? 0
  const status = !pulse
    ? { dot: 'bg-gray-300', text: 'text-gray-500', label: 'Loading status…' }
    : pulse.status === 'not_connected'
      ? { dot: 'bg-red-500', text: 'text-red-600', label: 'Not connected' }
      : issues === 0
        ? { dot: 'bg-emerald-500', text: 'text-gray-500', label: 'All systems good' }
        : critical > 0
          ? { dot: 'bg-red-500', text: 'text-red-600', label: `${issues} issue${issues === 1 ? '' : 's'} found` }
          : { dot: 'bg-amber-400', text: 'text-amber-700', label: `${issues} issue${issues === 1 ? '' : 's'} found` }
  const r = pulse?.last30
  const stats = [
    { label: 'Scheduled', value: pulse ? pulse.scheduledNext7 : '—', href: `/dashboard/client/${brand.id}/calendar` },
    { label: 'Engagement', value: r && r.posts ? `${r.medianEngagementRate.toFixed(1)}%` : '—', href: `/dashboard/client/${brand.id}/analytics` },
    { label: 'Actions', value: pulse ? issues : '—', href: `/dashboard/client/${brand.id}` },
  ]
  return (
    <article className="group rounded-2xl border border-white/80 bg-white/90 p-4 shadow-card backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-card-hover">
      <div className="flex items-center gap-3">
        <BrandLogo brand={brand} size={44} unread={unread} />
        <div className="min-w-0 flex-1">
          <Link href={`/dashboard/client/${brand.id}`} className="block truncate text-[16px] font-semibold tracking-[-0.01em] text-gray-900 hover:text-blue-700">
            {brand.name}
          </Link>
          <span className={cn('inline-flex items-center gap-1.5 text-xs', status.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
        </div>
        <Link
          href={`/dashboard/client/${brand.id}/content-suite`}
          title="Create content"
          className="hidden h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600 group-hover:flex"
        >
          <Sparkles className="h-4 w-4" />
        </Link>
        <Link
          href={`/dashboard/client/${brand.id}/calendar`}
          title="Calendar"
          className="hidden h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 group-hover:flex"
        >
          <CalendarDays className="h-4 w-4" />
        </Link>
        <Link
          href={`/dashboard/client/${brand.id}`}
          aria-label={`Open ${brand.name}`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-gray-100 text-center">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50">
            <div className="text-[15px] font-semibold tabular-nums text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </Link>
        ))}
      </div>
    </article>
  )
}

// ── Upcoming activity timeline ───────────────────────────────────────────

export interface TimelineItem {
  id: string
  when: Date
  /** Show only the date (no time known) */
  dateOnly?: boolean
  title: string
  subtitle?: string
  href: string
  badge?: ReactNode
}

export function formatWhen(when: Date, dateOnly?: boolean): string {
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = same(when, today)
    ? 'Today'
    : same(when, tomorrow)
      ? 'Tomorrow'
      : when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return dateOnly ? day : `${day} · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function Timeline({ items, loading, empty }: { items: TimelineItem[]; loading?: boolean; empty: ReactNode }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <span className="mt-1.5 h-3 w-3 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (!items.length) return <div className="rounded-2xl bg-gray-50/80 px-4 py-6 text-center text-[13px] text-gray-500">{empty}</div>
  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-gray-200" />
      {items.map((it, n) => (
        <li key={it.id}>
          <Link href={it.href} className="group relative flex gap-4 rounded-xl py-2.5 pr-2 transition-colors">
            <span
              className={cn(
                'relative z-10 mt-1.5 h-[11px] w-[11px] flex-shrink-0 rounded-full ring-4 ring-white',
                n === 0 ? 'bg-blue-600' : 'bg-gray-300 group-hover:bg-blue-400'
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-gray-500">{formatWhen(it.when, it.dateOnly)}</p>
              <p className="truncate text-[15px] font-semibold text-gray-900 group-hover:text-blue-700">{it.title}</p>
              {it.subtitle && <p className="truncate text-xs text-gray-500">{it.subtitle}</p>}
            </div>
            {it.badge && <div className="flex-shrink-0 self-start pt-1">{it.badge}</div>}
          </Link>
        </li>
      ))}
    </ol>
  )
}

// ── Performance KPIs ─────────────────────────────────────────────────────

export function KpiColumn({ value, label, positive }: { value: string; label: string; positive?: boolean | null }) {
  return (
    <div className="min-w-0 px-3 first:pl-0">
      <div
        className={cn(
          'text-[24px] font-bold leading-8 tracking-[-0.02em] tabular-nums',
          positive === true ? 'text-emerald-600' : positive === false ? 'text-red-600' : 'text-gray-900'
        )}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

export const formatCompact = (n: number) => compact.format(n)

// ── Content Suite promo ──────────────────────────────────────────────────

export function ContentSuitePromo({ brands }: { brands: OverviewBrand[] }) {
  const single = brands.length === 1
  const button =
    'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-900 shadow-md transition-transform hover:-translate-y-px'
  return (
    <section className="relative isolate flex min-h-[200px] overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 p-6 text-white shadow-[0_18px_40px_-16px_rgb(53_109_243/0.6)]">
      <span aria-hidden="true" className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
      <span aria-hidden="true" className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-violet-300/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-6 bottom-[-18px] hidden w-[46%] sm:block">
        <div className="relative h-44">
          <img
            src="/content-suite-screenshot.png"
            alt=""
            className="absolute right-10 top-0 w-48 rotate-[-8deg] rounded-xl border-4 border-white object-cover shadow-xl"
          />
          <img
            src="/client-dashboard.png"
            alt=""
            className="absolute right-0 top-16 w-44 rotate-[6deg] rounded-xl border-4 border-white object-cover shadow-xl"
          />
        </div>
      </div>
      <div className="relative z-10 flex max-w-[60%] flex-col justify-between gap-5 max-sm:max-w-full">
        <Sparkles className="h-7 w-7" />
        <p className="text-[20px] font-semibold leading-snug tracking-[-0.015em]">
          Turn your photos into social content, in seconds.
        </p>
        <div>
          {single ? (
            <Link href={`/dashboard/client/${brands[0].id}/content-suite`} className={button}>
              Try Content Suite <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={button}>
                  Try Content Suite <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 p-1.5">
                <DropdownMenuLabel className="px-2">Open Content Suite for</DropdownMenuLabel>
                {brands.map((b) => (
                  <DropdownMenuItem key={b.id} asChild className="cursor-pointer gap-2.5">
                    <Link href={`/dashboard/client/${b.id}/content-suite`}>
                      <BrandLogo brand={b} size={24} />
                      <span className="truncate text-[13px] font-medium">{b.name}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </section>
  )
}
