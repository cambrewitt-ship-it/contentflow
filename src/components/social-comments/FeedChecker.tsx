'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Copy, ExternalLink, Info, Link2, Loader2, Play, ShieldCheck, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authedFetchJson } from '@/lib/authedFetch'
import type { CommentRow, FeedAgentRunSummary, FeedAgentSettings, FeedCheck, FeedIssue } from '@/lib/comments/types'
import { CommentCard } from './CommentCard'

// The Feed Checker for one client: what it checks and does automatically, its
// findings with one-click fixes, and the comment actions it took (undoable).

const SEVERITY: Record<FeedIssue['severity'], string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
}
const ISSUE_LABEL: Record<string, string> = {
  spelling: 'Spelling',
  grammar: 'Grammar',
  tone_of_voice: 'Tone of voice',
  missing_link: 'Missing link',
  link_reminder: 'Link not set',
  other: 'Check this',
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
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
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {check.postThumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={check.postThumbnail} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {check.source === 'scheduled' ? `Upcoming post · ${when}` : `Published on ${check.platform === 'instagram' ? 'Instagram' : 'Facebook'} · ${when}`}
            </span>
            {check.tovScore !== null && <span>Tone of voice {check.tovScore}/10</span>}
            {check.status !== 'open' && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 capitalize">{check.status}</span>}
            {check.postUrl && (
              <a href={check.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {check.source === 'scheduled' && (
              <Link href={`/dashboard/client/${clientId}/calendar`} className="text-blue-600 hover:underline">
                Open calendar
              </Link>
            )}
          </p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-gray-800">{check.postText}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {check.issues.map((issue, n) => (
          <li key={n} className={`rounded-lg border px-3 py-2 text-sm ${SEVERITY[issue.severity]}`}>
            <span className="font-semibold">{ISSUE_LABEL[issue.type] ?? issue.type}:</span> {issue.detail}
            {issue.excerpt && (
              <span className="mt-0.5 block text-xs">
                <span className="line-through opacity-80">{issue.excerpt}</span>
                {issue.suggestion && <span className="font-medium"> → {issue.suggestion}</span>}
              </span>
            )}
            {!issue.excerpt && issue.suggestion && <span className="mt-0.5 block text-xs">{issue.suggestion}</span>}
          </li>
        ))}
      </ul>

      {check.status === 'open' && (
        <div className="mt-3 space-y-2">
          {(types.has('missing_link') || types.has('link_reminder')) && (
            <div className="flex gap-2">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (the link people are looking for)" className="h-8" />
              <Button
                size="sm"
                className="h-8 whitespace-nowrap"
                disabled={!!busy || !link.trim()}
                onClick={() => act(types.has('missing_link') ? 'add_link_comment' : 'set_first_comment', { link })}
              >
                {busy === 'add_link_comment' || busy === 'set_first_comment' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
                {types.has('missing_link') ? 'Comment it now' : 'Save as first comment'}
              </Button>
            </div>
          )}

          {check.suggestedCaption && (
            <div>
              <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setShowFix((v) => !v)}>
                {showFix ? 'Hide' : 'Show'} corrected caption
              </button>
              {showFix && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-emerald-50 p-2.5 text-sm text-gray-800">{check.suggestedCaption}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {check.suggestedCaption && canApply && (
              <Button size="sm" variant="outline" className="h-8" disabled={!!busy} onClick={() => act('apply_fix')}>
                {busy === 'apply_fix' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                {check.source === 'scheduled' ? 'Use corrected caption' : 'Fix on Facebook'}
              </Button>
            )}
            {check.suggestedCaption && !canApply && (
              <Button size="sm" variant="outline" className="h-8" onClick={copyFix} title="Instagram captions can't be edited through the API">
                {copied ? <Check className="mr-1 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy corrected caption'}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => act('resolve')}>
              <Check className="mr-1 h-4 w-4" /> Fixed
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-gray-500" disabled={!!busy} onClick={() => act('ignore')}>
              Ignore
            </Button>
          </div>
        </div>
      )}
      {check.status !== 'open' && (
        <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={() => act('reopen')} disabled={!!busy}>
          Reopen
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldCheck className="h-6 w-6 text-violet-600" /> Feed Checker
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Goes over this client&apos;s Facebook and Instagram like a careful social media manager: spelling, tone of voice and
            &ldquo;link in comments&rdquo; posts with no link — on upcoming posts before they go out — and keeps the comments tidy.
          </p>
        </div>
        <Button onClick={run} disabled={running || !!setup}>
          {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
          {running ? 'Checking…' : 'Run check now'}
        </Button>
      </div>

      {setup && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {setup}
        </p>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {running && <p className="text-sm text-gray-500">Reading posts and comments and checking them with AI — this can take a minute or two.</p>}

      {lastRun && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-gray-500">
            Last check {new Date(lastRun.ranAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}:
          </span>
          {[
            [`${lastRun.postsChecked} posts checked`, 'bg-gray-100 text-gray-700'],
            [`${lastRun.issuesFound} issues`, lastRun.issuesFound ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'],
            [`${lastRun.autoHidden} comments hidden`, 'bg-gray-100 text-gray-700'],
            [`${lastRun.autoLiked + lastRun.autoHearted} liked`, 'bg-gray-100 text-gray-700'],
            [`${lastRun.needsReply} waiting for a reply`, lastRun.needsReply ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'],
          ].map(([t, cls]) => (
            <span key={t} className={`rounded-full px-2 py-0.5 ${cls}`}>
              {t}
            </span>
          ))}
          {lastRun.needsReply > 0 && (
            <Link href={`/dashboard/client/${clientId}/comments`} className="text-blue-600 hover:underline">
              Reply now →
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {(['open', 'all'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {v === 'open' ? `To fix${view === 'open' && checks.length ? ` (${checks.length})` : ''}` : 'History'}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : checks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              {view === 'open' ? 'Nothing to fix. Posts that were checked look good.' : 'No findings yet.'}
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
            <section className="pt-4">
              <h3 className="mb-2 font-semibold text-gray-900">What it did with comments</h3>
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

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 font-semibold text-gray-900">Settings</h3>
            {!settings ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <div className="divide-y divide-gray-100">
                <Toggle
                  checked={settings.enabled}
                  onChange={(v) => set('enabled', v)}
                  label="Run automatically"
                  hint="Three times a day, plus instantly on new comments"
                />
                <Toggle checked={settings.checkPosts} onChange={(v) => set('checkPosts', v)} label="Check published posts" hint="Spelling, grammar, tone of voice, missing links" />
                <Toggle checked={settings.checkScheduled} onChange={(v) => set('checkScheduled', v)} label="Check upcoming posts" hint="The next 7 days in the calendar, before they go out" />
                <div className="py-2">
                  <p className="text-sm font-medium text-gray-800">Hide comments automatically</p>
                  <select
                    value={settings.autoHide}
                    onChange={(e) => set('autoHide', e.target.value as FeedAgentSettings['autoHide'])}
                    className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                  >
                    <option value="off">Off — only flag them</option>
                    <option value="spam_abuse">Spam and abuse</option>
                    <option value="negative">All negative comments</option>
                  </select>
                  {settings.autoHide === 'negative' && (
                    <p className="mt-1 text-xs text-amber-700">
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
              </div>
            )}
            <Button size="sm" className="mt-3" onClick={save} disabled={!dirty || saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </section>

          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-gray-600">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-800">
              <Info className="h-3.5 w-3.5" /> Good to know
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Facebook and Instagram only allow a &ldquo;like&rdquo; on comments through their API — no love reactions.</li>
              <li>Liking Instagram comments is still restricted by Meta; the ❤️ reply covers it.</li>
              <li>Facebook captions the app published can be fixed in place. Instagram captions can&apos;t be edited — copy the fix.</li>
              <li>Add a link in a post&apos;s &ldquo;First comment&rdquo; and it&apos;s posted the moment the post goes live.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
