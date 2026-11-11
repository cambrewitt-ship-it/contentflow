'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  EyeOff,
  ExternalLink,
  FileSearch,
  Heart,
  History,
  Info,
  Link2,
  ListChecks,
  Loader2,
  MessageCircleReply,
  MessagesSquare,
  Play,
  RotateCcw,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authedFetchJson } from '@/lib/authedFetch'
import { cn } from '@/lib/utils'
import type { CommentRow, FeedAgentRunSummary, FeedAgentSettings, FeedCheck, FeedIssue } from '@/lib/comments/types'
import { CommentCard } from './CommentCard'

// The Feed Checker for one client: what it checks and does automatically, its
// findings with one-click fixes, and the comment actions it took (undoable).

const SEVERITY: Record<FeedIssue['severity'], { label: string; dot: string; pill: string; rail: string }> = {
  high: { label: 'High', dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 ring-red-100', rail: 'bg-red-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-800 ring-amber-100', rail: 'bg-amber-400' },
  low: { label: 'Low', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600 ring-gray-200', rail: 'bg-gray-300' },
}
const SEVERITY_ORDER: FeedIssue['severity'][] = ['high', 'medium', 'low']
const ISSUE_LABEL: Record<string, string> = {
  spelling: 'Spelling',
  grammar: 'Grammar',
  tone_of_voice: 'Tone of voice',
  missing_link: 'Missing link',
  link_reminder: 'Link not set',
  other: 'Check this',
}
const STATUS_PILL: Record<FeedCheck['status'], string> = {
  open: 'bg-blue-50 text-blue-700 ring-blue-100',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  ignored: 'bg-gray-100 text-gray-600 ring-gray-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

/** Highest severity among a check's issues, for the card's colour rail */
const topSeverity = (check: FeedCheck): FeedIssue['severity'] | null =>
  SEVERITY_ORDER.find((s) => check.issues.some((i) => i.severity === s)) ?? null

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-2.5">
      <span>
        <span className="block text-[13px] font-medium text-gray-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-4 text-gray-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500/25',
          checked ? 'bg-blue-600' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </button>
    </label>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2">
      <p className="pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">{title}</p>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function CheckCard({ clientId, check, onChange }: { clientId: string; check: FeedCheck; onChange: (c: FeedCheck) => void }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFix, setShowFix] = useState(false)
  const [copied, setCopied] = useState(false)
  const types = new Set(check.issues.map((i) => i.type))
  const canApply = check.canApplyFix || (check.source === 'scheduled' && !check.latePostId)

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action)
    setError(null)
    try {
      const res = await authedFetchJson<{ check: FeedCheck }>(`/api/clients/${clientId}/feed-checker/checks/${check.id}`, {
        method: 'POST',
        body: { action, ...extra },
      })
      onChange(res.check)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work')
    } finally {
      setBusy(null)
    }
  }

  const copyFix = async () => {
    if (!check.suggestedCaption) return
    await navigator.clipboard.writeText(check.suggestedCaption).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const when = check.postedAt ? new Date(check.postedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  const severity = topSeverity(check)
  const isOpen = check.status === 'open'
  const platformName = check.platform === 'instagram' ? 'Instagram' : 'Facebook'

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover',
        isOpen ? 'border-gray-200/80' : 'border-gray-200/60'
      )}
    >
      {/* Severity rail */}
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-1', isOpen && severity ? SEVERITY[severity].rail : 'bg-gray-200')}
      />

      <div className="p-4 pl-5">
        {/* Post */}
        <div className="flex gap-3.5">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/70 sm:h-[72px] sm:w-[72px]">
            {check.postThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={check.postThumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <FileSearch className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                  check.source === 'scheduled' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-gray-100 text-gray-700 ring-gray-200'
                )}
              >
                {check.source === 'scheduled' ? <CalendarClock className="h-3 w-3" /> : null}
                {check.source === 'scheduled' ? 'Upcoming post' : `Published on ${platformName}`}
              </span>
              {when && <span className="text-xs text-gray-500">{when}</span>}
              {check.tovScore !== null && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100">
                  Tone of voice {check.tovScore}/10
                </span>
              )}
              {!isOpen && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1', STATUS_PILL[check.status])}>
                  {check.status}
                </span>
              )}
              <span className="ml-auto flex items-center gap-3 text-xs">
                {check.postUrl && (
                  <a
                    href={check.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {check.source === 'scheduled' && (
                  <Link href={`/dashboard/client/${clientId}/calendar`} className="font-medium text-blue-700 hover:text-blue-800">
                    Open calendar
                  </Link>
                )}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-gray-700">{check.postText}</p>
          </div>
        </div>

        {/* Issues */}
        <ul className={cn('mt-3.5 overflow-hidden rounded-xl border border-gray-200/80 divide-y divide-gray-100', !isOpen && 'opacity-75')}>
          {check.issues.map((issue, n) => (
            <li key={n} className="flex gap-3 bg-gray-50/40 px-3 py-2.5">
              <span className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', SEVERITY[issue.severity].dot)} title={`${SEVERITY[issue.severity].label} severity`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold text-gray-900">{ISSUE_LABEL[issue.type] ?? issue.type}</span>
                  <span className={cn('rounded-full px-1.5 py-px text-[10px] font-medium ring-1', SEVERITY[issue.severity].pill)}>
                    {SEVERITY[issue.severity].label}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-5 text-gray-600">{issue.detail}</p>
                {issue.excerpt && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-400/70">{issue.excerpt}</span>
                    {issue.suggestion && (
                      <>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">{issue.suggestion}</span>
                      </>
                    )}
                  </p>
                )}
                {!issue.excerpt && issue.suggestion && <p className="mt-1 text-xs text-gray-700">{issue.suggestion}</p>}
              </div>
            </li>
          ))}
        </ul>

        {isOpen && (
          <div className="mt-3 space-y-3">
            {(types.has('missing_link') || types.has('link_reminder')) && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://… (the link people are looking for)"
                    className="h-9 rounded-lg pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 whitespace-nowrap rounded-lg text-[13px]"
                  disabled={!!busy || !link.trim()}
                  onClick={() => act(types.has('missing_link') ? 'add_link_comment' : 'set_first_comment', { link })}
                >
                  {busy === 'add_link_comment' || busy === 'set_first_comment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {types.has('missing_link') ? 'Comment it now' : 'Save as first comment'}
                </Button>
              </div>
            )}

            {check.suggestedCaption && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-emerald-800"
                  onClick={() => setShowFix((v) => !v)}
                  aria-expanded={showFix}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" />
                    {showFix ? 'Hide' : 'Show'} corrected caption
                  </span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', showFix && 'rotate-180')} />
                </button>
                {showFix && (
                  <p className="whitespace-pre-wrap border-t border-emerald-100 px-3 py-2.5 text-[13px] leading-5 text-gray-800">
                    {check.suggestedCaption}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
              {check.suggestedCaption && canApply && (
                <Button size="sm" className="h-8 rounded-lg text-[13px]" disabled={!!busy} onClick={() => act('apply_fix')}>
                  {busy === 'apply_fix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {check.source === 'scheduled' ? 'Use corrected caption' : 'Fix on Facebook'}
                </Button>
              )}
              {check.suggestedCaption && !canApply && (
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[13px]" onClick={copyFix} title="Instagram captions can't be edited through the API">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy corrected caption'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[13px]" disabled={!!busy} onClick={() => act('resolve')}>
                <Check className="h-4 w-4" /> Fixed
              </Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-[13px] text-gray-500" disabled={!!busy} onClick={() => act('ignore')}>
                Ignore
              </Button>
              {busy && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
          </div>
        )}
        {!isOpen && (
          <Button size="sm" variant="ghost" className="mt-2.5 h-7 rounded-lg text-xs" onClick={() => act('reopen')} disabled={!!busy}>
            {busy === 'reopen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reopen
          </Button>
        )}
        {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
      </div>
    </article>
  )
}

export default function FeedChecker({ clientId }: { clientId: string }) {
  const [settings, setSettings] = useState<FeedAgentSettings | null>(null)
  const [saved, setSaved] = useState<FeedAgentSettings | null>(null)
  const [checks, setChecks] = useState<FeedCheck[]>([])
  const [autoActions, setAutoActions] = useState<CommentRow[]>([])
  const [lastRun, setLastRun] = useState<FeedAgentRunSummary | null>(null)
  const [view, setView] = useState<'open' | 'all'>('open')
  const [setup, setSetup] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (v: 'open' | 'all') => {
      setLoading(true)
      try {
        const res = await authedFetchJson<{
          settings: FeedAgentSettings
          checks: FeedCheck[]
          autoActions: CommentRow[]
          lastRun: FeedAgentRunSummary | null
          setupRequired?: string
        }>(`/api/clients/${clientId}/feed-checker?view=${v}`)
        setSettings(res.settings)
        setSaved(res.settings)
        setChecks(res.checks ?? [])
        setAutoActions(res.autoActions ?? [])
        setLastRun(res.lastRun ?? null)
        setSetup(res.setupRequired ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [clientId]
  )

  useEffect(() => {
    void load(view)
  }, [load, view])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await authedFetchJson<{ settings: FeedAgentSettings }>(`/api/clients/${clientId}/feed-checker`, { method: 'PUT', body: { settings } })
      setSaved(res.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      await authedFetchJson(`/api/clients/${clientId}/feed-checker`, { method: 'POST', timeoutMs: 300_000 })
      await load(view)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check didn’t finish')
    } finally {
      setRunning(false)
    }
  }

  const set = <K extends keyof FeedAgentSettings>(k: K, v: FeedAgentSettings[K]) => setSettings((s) => (s ? { ...s, [k]: v } : s))
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)

  // Issues in the findings on screen, by severity (for the results header)
  const issueCounts = SEVERITY_ORDER.map((s) => ({
    severity: s,
    count: checks.filter((c) => c.status === 'open').reduce((n, c) => n + c.issues.filter((i) => i.severity === s).length, 0),
  })).filter((x) => x.count > 0)

  const lastRunStats = lastRun
    ? [
        { label: 'Posts checked', value: lastRun.postsChecked, icon: ListChecks, tone: 'text-blue-600 bg-blue-50 ring-blue-100' },
        {
          label: 'Issues found',
          value: lastRun.issuesFound,
          icon: AlertTriangle,
          tone: lastRun.issuesFound ? 'text-red-600 bg-red-50 ring-red-100' : 'text-gray-500 bg-gray-100 ring-gray-200',
        },
        { label: 'Comments hidden', value: lastRun.autoHidden, icon: EyeOff, tone: 'text-gray-600 bg-gray-100 ring-gray-200' },
        { label: 'Liked', value: lastRun.autoLiked + lastRun.autoHearted, icon: Heart, tone: 'text-pink-600 bg-pink-50 ring-pink-100' },
        {
          label: 'Waiting for a reply',
          value: lastRun.needsReply,
          icon: MessageCircleReply,
          tone: lastRun.needsReply ? 'text-amber-600 bg-amber-50 ring-amber-100' : 'text-gray-500 bg-gray-100 ring-gray-200',
        },
      ]
    : []

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6 md:py-7">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">Feed Checker</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-gray-500">
              Goes over this client&apos;s Facebook and Instagram like a careful social media manager: spelling, tone of voice and
              &ldquo;link in comments&rdquo; posts with no link — on upcoming posts before they go out — and keeps the comments tidy.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Button variant="ai" onClick={run} disabled={running || !!setup} className="h-10 rounded-xl px-4">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? 'Checking…' : 'Run check now'}
          </Button>
          {lastRun && (
            <span className="text-[11px] text-gray-500">
              Last check {new Date(lastRun.ranAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {setup && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {setup}
        </p>
      )}
      {error && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>}
      {running && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white/80 px-3.5 py-2.5 shadow-xs backdrop-blur-sm">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
          <p className="thinking-shimmer text-[13px] font-medium">
            Reading posts and comments and checking them with AI — this can take a minute or two.
          </p>
        </div>
      )}

      {/* ── Last check summary ─────────────────────────────────────────── */}
      {lastRun && (
        <section aria-label="Last check" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {lastRunStats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/90 px-3.5 py-3 shadow-card backdrop-blur-sm',
                // Odd one out on the 2-column phone grid spans the row
                i === lastRunStats.length - 1 && 'col-span-2 sm:col-span-1'
              )}
            >
              <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1', s.tone)}>
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-6 tabular-nums text-gray-900">{s.value}</p>
                <p className="truncate text-[11px] text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
          {lastRun.needsReply > 0 && (
            <Link
              href={`/dashboard/client/${clientId}/comments`}
              className="col-span-2 flex items-center justify-between gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-[13px] font-medium text-amber-900 transition-colors hover:bg-amber-50 sm:col-span-3 lg:col-span-5"
            >
              <span className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4" />
                {lastRun.needsReply} comment{lastRun.needsReply === 1 ? '' : 's'} waiting for a reply
              </span>
              <span className="inline-flex items-center gap-1">
                Reply now <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── Results ──────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-gray-200/80 bg-white/70 p-1 shadow-xs backdrop-blur-sm" role="tablist">
              {(['open', 'all'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    view === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {v === 'open' ? <ListChecks className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                  {v === 'open' ? `To fix${view === 'open' && checks.length ? ` (${checks.length})` : ''}` : 'History'}
                </button>
              ))}
            </div>
            {!loading && issueCounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {issueCounts.map(({ severity, count }) => (
                  <span key={severity} className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', SEVERITY[severity].pill)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY[severity].dot)} />
                    {count} {SEVERITY[severity].label.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200/70 bg-white/80 p-4">
                  <div className="flex gap-3.5">
                    <div className="h-16 w-16 animate-pulse rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
                      <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="mt-4 h-14 animate-pulse rounded-xl bg-gray-50" />
                </div>
              ))}
              <p className="sr-only">Loading…</p>
            </div>
          ) : checks.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-white/90 px-6 py-12 text-center shadow-card backdrop-blur-sm">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                {view === 'open' ? <CheckCircle2 className="h-5 w-5" /> : <History className="h-5 w-5" />}
              </span>
              <p className="text-sm font-medium text-gray-900">{view === 'open' ? 'Nothing to fix' : 'No findings yet'}</p>
              {view === 'open' && <p className="mt-1 text-[13px] text-gray-500">Posts that were checked look good.</p>}
            </div>
          ) : (
            checks.map((c) => (
              <CheckCard
                key={c.id}
                clientId={clientId}
                check={c}
                onChange={(u) => setChecks((list) => (view === 'open' && u.status !== 'open' ? list.filter((x) => x.id !== u.id) : list.map((x) => (x.id === u.id ? u : x))))}
              />
            ))
          )}

          {autoActions.length > 0 && (
            <section className="rounded-2xl border border-gray-200/80 bg-white/70 p-4 shadow-card backdrop-blur-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-gray-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <MessagesSquare className="h-3.5 w-3.5" />
                </span>
                What it did with comments
                <span className="text-xs font-normal text-gray-500">{autoActions.length}</span>
              </h3>
              <div className="space-y-2">
                {autoActions.map((c) => (
                  <CommentCard
                    key={c.id}
                    clientId={clientId}
                    comment={c}
                    compact
                    onChange={(u) => setAutoActions((list) => list.map((x) => (x.id === u.id ? u : x)))}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-[15px] font-semibold text-gray-900">Settings</h3>
              {settings && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                    saved?.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-gray-100 text-gray-600 ring-gray-200'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', saved?.enabled ? 'bg-emerald-500' : 'bg-gray-400')} />
                  {saved?.enabled ? 'Automatic' : 'Manual'}
                </span>
              )}
            </header>
            {!settings ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-50" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                <SettingsGroup title="Schedule">
                  <Toggle
                    checked={settings.enabled}
                    onChange={(v) => set('enabled', v)}
                    label="Run automatically"
                    hint="Three times a day, plus instantly on new comments"
                  />
                </SettingsGroup>
                <SettingsGroup title="What to check">
                  <Toggle checked={settings.checkPosts} onChange={(v) => set('checkPosts', v)} label="Check published posts" hint="Spelling, grammar, tone of voice, missing links" />
                  <Toggle checked={settings.checkScheduled} onChange={(v) => set('checkScheduled', v)} label="Check upcoming posts" hint="The next 7 days in the calendar, before they go out" />
                </SettingsGroup>
                <SettingsGroup title="Comments">
                  <div className="py-2.5">
                    <label htmlFor="feed-autohide" className="text-[13px] font-medium text-gray-900">
                      Hide comments automatically
                    </label>
                    <div className="relative mt-1.5">
                      <select
                        id="feed-autohide"
                        value={settings.autoHide}
                        onChange={(e) => set('autoHide', e.target.value as FeedAgentSettings['autoHide'])}
                        className="h-9 w-full appearance-none rounded-lg border border-input bg-white pl-3 pr-8 text-[13px] text-gray-900 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
                      >
                        <option value="off">Off — only flag them</option>
                        <option value="spam_abuse">Spam and abuse</option>
                        <option value="negative">All negative comments</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    {settings.autoHide === 'negative' && (
                      <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                        Genuine complaints get hidden too. Hidden comments are still visible to the person who wrote them.
                      </p>
                    )}
                  </div>
                  <Toggle checked={settings.autoLike} onChange={(v) => set('autoLike', v)} label="Like positive comments" hint="Facebook. Instagram once Meta allows it" />
                  <Toggle
                    checked={settings.heartReplyFallback}
                    onChange={(v) => set('heartReplyFallback', v)}
                    label="Reply ❤️ where a like isn't possible"
                    hint="e.g. Instagram — a public reply from the account"
                  />
                </SettingsGroup>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
              <span className="text-[11px] text-gray-500">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Button size="sm" className="rounded-lg" onClick={save} disabled={!dirty || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save settings
              </Button>
            </div>
          </section>

          <details className="group rounded-2xl border border-blue-100/80 bg-blue-50/50 text-xs text-gray-600 backdrop-blur-sm" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-gray-800 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-600" /> Good to know
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ul className="list-disc space-y-1.5 px-4 pb-3.5 pl-8 leading-4">
              <li>Facebook and Instagram only allow a &ldquo;like&rdquo; on comments through their API — no love reactions.</li>
              <li>Liking Instagram comments is still restricted by Meta; the ❤️ reply covers it.</li>
              <li>Facebook captions the app published can be fixed in place. Instagram captions can&apos;t be edited — copy the fix.</li>
              <li>Add a link in a post&apos;s &ldquo;First comment&rdquo; and it&apos;s posted the moment the post goes live.</li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  )
}
