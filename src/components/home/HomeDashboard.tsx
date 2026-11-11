'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Calendar,
  CalendarClock,
  ChevronDown,
  Images,
  Lightbulb,
  Link2,
  MessagesSquare,
  PenSquare,
  Plus,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { PortfolioClient } from '@/lib/analytics/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientPulse } from '@/components/analytics/Portfolio'

// Presentational pieces for the Home screen (src/app/dashboard/page.tsx).
// They only display data the page already has — brands, unread counts and the
// portfolio overview from /api/analytics/portfolio. No fetching here.

export interface HomeBrand {
  id: string
  name: string
  logo_url?: string
  company_description?: string
  created_at: string
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

// ── Small building blocks ────────────────────────────────────────────────

export function BrandAvatar({
  brand,
  size = 'md',
  unread = 0,
}: {
  brand: Pick<HomeBrand, 'name' | 'logo_url'>
  size?: 'sm' | 'md' | 'lg'
  unread?: number
}) {
  const dims =
    size === 'sm' ? 'h-7 w-7 rounded-lg text-xs' : size === 'lg' ? 'h-14 w-14 rounded-2xl text-xl' : 'h-11 w-11 rounded-xl text-base'
  return (
    <div className="relative flex-shrink-0">
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden font-semibold ring-1',
          brand.logo_url ? 'bg-white ring-gray-200/80' : 'bg-gradient-to-br from-blue-100 to-cyan-100/70 text-blue-700 ring-blue-200/60',
          dims
        )}
      >
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={`${brand.name} logo`} className="h-full w-full object-cover" />
        ) : (
          <span>{brand.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {/* Unread notification badge */}
      {unread > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm ring-2 ring-white"
          title={`${unread} unread notification${unread === 1 ? '' : 's'}`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  )
}

const STATUS: Record<PortfolioClient['status'], { label: string; dot: string; text: string }> = {
  ok: { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  pending: { label: 'Syncing results', dot: 'bg-blue-400', text: 'text-blue-700' },
  not_connected: { label: 'Not connected', dot: 'bg-red-500', text: 'text-red-700' },
  unavailable: { label: 'Analytics unavailable', dot: 'bg-gray-400', text: 'text-gray-600' },
  failed: { label: 'Results delayed', dot: 'bg-amber-400', text: 'text-amber-800' },
  setup_required: { label: 'Setup needed', dot: 'bg-amber-400', text: 'text-amber-800' },
}

export function StatusPill({ status }: { status: PortfolioClient['status'] | undefined }) {
  if (!status) return null
  const s = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  icon: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-gray-200/80 bg-white shadow-card', className)}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
        </h2>
        {action}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  )
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

// ── Overview metrics ─────────────────────────────────────────────────────

export interface Metric {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  href?: string
  tone?: 'blue' | 'cyan' | 'amber' | 'red' | 'emerald' | 'violet'
}

const TONES: Record<NonNullable<Metric['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export function MetricGrid({ metrics, loading }: { metrics: Metric[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => {
        const body = (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{m.label}</span>
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg ring-1', TONES[m.tone ?? 'blue'])}>
                <m.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-gray-900">
              {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded-md bg-gray-100 align-middle" /> : m.value}
            </div>
            {m.hint && <div className="mt-1 truncate text-xs text-gray-500">{m.hint}</div>}
          </>
        )
        const cls =
          'group block rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-card backdrop-blur-sm transition-all duration-200'
        return m.href ? (
          <Link key={m.label} href={m.href} className={cn(cls, 'hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card-hover')}>
            {body}
          </Link>
        ) : (
          <div key={m.label} className={cls}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

// ── Create content (header action) ───────────────────────────────────────

export function CreateContentButton({ brands }: { brands: HomeBrand[] }) {
  if (brands.length === 1) {
    return (
      <Button asChild size="lg" className="h-10 rounded-xl px-4">
        <Link href={`/dashboard/client/${brands[0].id}/content-suite`}>
          <Plus />
          Create content
        </Link>
      </Button>
    )
  }
  // Several brands: pick which brand to create for
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" className="h-10 rounded-xl px-4">
          <Plus />
          Create content
          <ChevronDown className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="px-2">Create content for</DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {brands.map((b) => (
            <DropdownMenuItem key={b.id} asChild className="cursor-pointer gap-2.5">
              <Link href={`/dashboard/client/${b.id}/content-suite`}>
                <BrandAvatar brand={b} size="sm" />
                <span className="truncate text-[13px] font-medium">{b.name}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Brand cards (several brands) ─────────────────────────────────────────

export function BrandCard({ brand, pulse, unread }: { brand: HomeBrand; pulse: PortfolioClient | undefined; unread: number }) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300/80 hover:shadow-card-hover">
      <div className="flex items-start gap-3">
        <BrandAvatar brand={brand} unread={unread} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] text-gray-900">{brand.name}</h3>
          <div className="mt-0.5">
            <StatusPill status={pulse?.status} />
          </div>
        </div>
        <Link
          href={`/dashboard/client/${brand.id}`}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          View dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {brand.company_description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-gray-500">{brand.company_description}</p>
      )}

      <div className="mt-4 flex-1">
        <ClientPulse clientId={brand.id} pulse={pulse} />
      </div>

      <div className="mt-4 flex gap-2">
        <Button asChild className="h-9 flex-1 rounded-xl">
          <Link href={`/dashboard/client/${brand.id}/content-suite`}>
            <Plus />
            Create Content
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 flex-1 rounded-xl">
          <Link href={`/dashboard/client/${brand.id}/calendar`}>
            <Calendar />
            Calendar
          </Link>
        </Button>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">Created {new Date(brand.created_at).toLocaleDateString()}</p>
    </article>
  )
}

// ── Next 7 days ──────────────────────────────────────────────────────────

export function WeekAheadPanel({
  brands,
  portfolio,
  loaded,
}: {
  brands: HomeBrand[]
  portfolio: Record<string, PortfolioClient>
  loaded: boolean
}) {
  const single = brands.length === 1
  const rows = brands
    .map((b) => ({ brand: b, pulse: portfolio[b.id] }))
    .filter((r) => r.pulse)
    // Emptiest calendars first: they're the ones to act on
    .sort((a, b) => a.pulse!.scheduledNext7 - b.pulse!.scheduledNext7)

  return (
    <Panel
      title="Next 7 days"
      icon={CalendarClock}
      action={single ? <PanelLink href={`/dashboard/client/${brands[0].id}/calendar`}>Calendar</PanelLink> : undefined}
    >
      {!loaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-gray-50/80 px-3 py-4 text-center text-xs text-gray-500">No upcoming activity to show yet.</p>
      ) : (
        <ol className="relative space-y-1">
          {rows.map(({ brand, pulse }) => {
            const p = pulse!
            const empty = p.scheduledNext7 === 0
            return (
              <li key={brand.id}>
                <Link
                  href={`/dashboard/client/${brand.id}/calendar`}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50"
                >
                  {single ? (
                    <span
                      className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1',
                        empty ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-blue-50 text-blue-600 ring-blue-100'
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                    </span>
                  ) : (
                    <BrandAvatar brand={brand} size="sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    {!single && <p className="truncate text-[13px] font-medium text-gray-900">{brand.name}</p>}
                    <p className={cn('truncate text-xs', single ? 'text-[13px] font-medium text-gray-900' : 'text-gray-500')}>
                      {empty ? 'Nothing scheduled yet' : `${p.scheduledNext7} post${p.scheduledNext7 === 1 ? '' : 's'} scheduled`}
                    </p>
                    {single && p.autoFill && <p className="text-xs text-gray-500">Gaps are drafted automatically</p>}
                  </div>
                  {p.awaitingApproval > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100">
                      {p.awaitingApproval} awaiting approval
                    </span>
                  )}
                  {empty && p.awaitingApproval === 0 && (
                    <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-100">
                      Empty
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

// ── Performance ──────────────────────────────────────────────────────────

function Change({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.05) return null
  const up = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(Math.round(value * 100))}%
    </span>
  )
}

/** Several brands: median engagement rate per brand (last 30 days), as bars. */
export function PortfolioPerformancePanel({
  brands,
  portfolio,
  loaded,
}: {
  brands: HomeBrand[]
  portfolio: Record<string, PortfolioClient>
  loaded: boolean
}) {
  const rows = brands
    .map((b) => ({ brand: b, pulse: portfolio[b.id] }))
    .filter((r) => r.pulse?.last30 && r.pulse.last30.posts > 0)
    .sort((a, b) => b.pulse!.last30!.medianEngagementRate - a.pulse!.last30!.medianEngagementRate)
  // Bar lengths are scaled to the best brand, for display only
  const max = Math.max(...rows.map((r) => r.pulse!.last30!.medianEngagementRate), 0)

  return (
    <Panel title="Engagement · 30 days" icon={BarChart3}>
      {!loaded ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-gray-50/80 px-3 py-4 text-center text-xs text-gray-500">
          Results appear here once brands have connected accounts and published posts.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ brand, pulse }) => {
            const r = pulse!.last30!
            return (
              <li key={brand.id}>
                <Link href={`/dashboard/client/${brand.id}/analytics`} className="group block">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-gray-700 group-hover:text-gray-900">{brand.name}</span>
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      <Change value={pulse!.engagementChange} />
                      <span className="font-semibold tabular-nums text-gray-900">{r.medianEngagementRate.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-700 ease-out group-hover:from-blue-600"
                      style={{ width: `${max > 0 ? Math.max(4, (r.medianEngagementRate / max) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {r.posts} post{r.posts === 1 ? '' : 's'}
                    {pulse!.followers ? ` · ${compact.format(pulse!.followers.current)} followers` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** One brand: the last 30 days at a glance, with the top recommendation. */
export function BrandPerformancePanel({ brand, pulse, loaded }: { brand: HomeBrand; pulse: PortfolioClient | undefined; loaded: boolean }) {
  const r = pulse?.last30
  return (
    <Panel title="Last 30 days" icon={BarChart3} action={<PanelLink href={`/dashboard/client/${brand.id}/analytics`}>Analytics</PanelLink>}>
      {!loaded ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-50" />
      ) : !pulse || (!r && !pulse.followers) ? (
        <p className="rounded-xl bg-gray-50/80 px-3 py-4 text-center text-xs text-gray-500">
          Results appear here once your accounts are connected and posts are published.
        </p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50/80 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-gray-500">Followers</dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {pulse.followers ? compact.format(pulse.followers.current) : '—'}
                </span>
                {pulse.followers && pulse.followers.gained30d !== 0 && (
                  <span className={cn('text-xs font-medium', pulse.followers.gained30d > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {pulse.followers.gained30d > 0 ? '+' : ''}
                    {compact.format(pulse.followers.gained30d)}
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-gray-50/80 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-gray-500">Posts published</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{r?.posts ?? 0}</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50/70 px-3 py-2.5 ring-1 ring-blue-100/70">
              <dt className="text-[11px] font-medium text-gray-500">Median engagement rate</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {r && r.posts ? `${r.medianEngagementRate.toFixed(1)}%` : '—'}
                </span>
                <Change value={pulse.engagementChange} />
                {pulse.engagementChange !== null && Math.abs(pulse.engagementChange) >= 0.05 && (
                  <span className="text-[11px] text-gray-500">vs previous 30 days</span>
                )}
              </dd>
            </div>
          </dl>
          {pulse.topRecommendation && (
            <Link
              href={`/dashboard/client/${brand.id}/analytics`}
              className="flex items-start gap-2 rounded-xl border border-gray-200/80 px-3 py-2 text-xs text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            >
              <Lightbulb className="mt-px h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
              <span className="line-clamp-2">{pulse.topRecommendation}</span>
            </Link>
          )}
        </div>
      )}
    </Panel>
  )
}

// ── Quick actions (one brand) ────────────────────────────────────────────

export function QuickActions({ brandId }: { brandId: string }) {
  const base = `/dashboard/client/${brandId}`
  const actions: Array<{ label: string; href: string; icon: LucideIcon; ai?: boolean }> = [
    { label: 'Content Suite', href: `${base}/content-suite`, icon: PenSquare },
    { label: 'Calendar', href: `${base}/calendar`, icon: Calendar },
    { label: 'Content Agent', href: `${base}/autopilot`, icon: Sparkles, ai: true },
    { label: 'Comments', href: `${base}/comments`, icon: MessagesSquare },
    { label: 'Feed Checker', href: `${base}/feed-checker`, icon: ShieldCheck },
    { label: 'Media Gallery', href: `${base}/media-gallery`, icon: Images },
    { label: 'Analytics', href: `${base}/analytics`, icon: BarChart3 },
    { label: 'Social Accounts', href: `${base}/connect-platforms`, icon: Link2 },
  ]
  return (
    <Panel title="Quick actions" icon={Bot}>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex items-center gap-2 rounded-xl border border-gray-200/70 px-2.5 py-2 text-[13px] font-medium text-gray-700 transition-all hover:-translate-y-px hover:border-blue-200 hover:bg-blue-50/50 hover:text-gray-900"
          >
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md',
                a.ai ? 'bg-gradient-ai text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-blue-600'
              )}
            >
              <a.icon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{a.label}</span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

/** One brand: compact brand header card. */
export function BrandHero({ brand, pulse, unread }: { brand: HomeBrand; pulse: PortfolioClient | undefined; unread: number }) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card">
      <div className="flex items-start gap-4">
        <BrandAvatar brand={brand} size="lg" unread={unread} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.012em] text-gray-900">{brand.name}</h2>
            <StatusPill status={pulse?.status} />
          </div>
          {brand.company_description && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-gray-500">{brand.company_description}</p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">Created {new Date(brand.created_at).toLocaleDateString()}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden flex-shrink-0 rounded-lg sm:inline-flex">
          <Link href={`/dashboard/client/${brand.id}`}>
            View dashboard
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-lg sm:hidden">
        <Link href={`/dashboard/client/${brand.id}`}>
          View dashboard
          <ArrowRight />
        </Link>
      </Button>
    </section>
  )
}
