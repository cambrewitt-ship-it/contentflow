'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Plus,
  Search,
  Telescope,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authedFetchJson } from '@/lib/authedFetch';
import CompetitorResearchReport from '@/components/CompetitorResearchReport';
import { Avatar, PlatformIcon, formatCount } from '@/components/CompetitorResearchShared';
import type {
  AccountSuggestion,
  CompetitorAccount,
  ResearchPlatform,
  ResearchProfile,
  ResearchReport,
} from '@/lib/competitor-research/types';

interface ReportSummary {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: string | null;
  accounts_analyzed: number;
  posts_analyzed: number;
  error: string | null;
  queued_until: string | null;
  created_at: string;
  completed_at: string | null;
}

interface FullReport extends ReportSummary {
  report: ResearchReport | null;
  warnings: string[] | null;
  raw_data_purged_at: string | null;
}

interface Overview {
  profile: ResearchProfile;
  profileSaved: boolean;
  accounts: CompetitorAccount[];
  reports: ReportSummary[];
  config: { instagram: boolean; tiktok: boolean; trends: boolean };
  limits: { maxAccounts: number; researchCredits: number; discoveryCredits: number; retentionDays: number };
}

const PLATFORM_LABEL: Record<ResearchPlatform, string> = { instagram: 'Instagram', tiktok: 'TikTok' };

const LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Dutch', 'Swedish', 'Danish', 'Norwegian',
  'Finnish', 'Polish', 'Turkish', 'Arabic', 'Hebrew', 'Hindi', 'Indonesian', 'Malay', 'Filipino', 'Thai',
  'Vietnamese', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Māori',
];

// ── Research profile ─────────────────────────────────────────────────────────

function ProfileSection({
  clientId,
  initial,
  saved,
  onSaved,
}: {
  clientId: string;
  initial: ResearchProfile;
  saved: boolean;
  onSaved: (p: ResearchProfile) => void;
}) {
  const [open, setOpen] = useState(!saved);
  const [profile, setProfile] = useState(initial);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k || profile.keywords.includes(k) || profile.keywords.length >= 15) return;
    setProfile(p => ({ ...p, keywords: [...p.keywords, k] }));
    setKeywordInput('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetchJson<{ profile: ResearchProfile }>(
        `/api/clients/${clientId}/competitor-research/profile`,
        { method: 'PUT', body: profile }
      );
      onSaved(data.profile);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300';

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Your niche</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {saved
              ? [initial.category, initial.location, initial.language !== 'English' && initial.language].filter(Boolean).join(' · ') || 'Set your category'
              : 'Confirm your business category so the agent knows who to compare you with'}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {!saved && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2">
              Pre-filled from your brand profile — check it and save.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Business category *</span>
              <input
                className={`${field} mt-1`}
                value={profile.category}
                maxLength={120}
                placeholder="e.g. Specialty coffee café"
                onChange={e => setProfile(p => ({ ...p, category: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Location / market</span>
              <input
                className={`${field} mt-1`}
                value={profile.location}
                maxLength={120}
                placeholder="e.g. Wellington, New Zealand"
                onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">What the business does</span>
            <textarea
              className={`${field} mt-1 min-h-[70px]`}
              value={profile.description}
              maxLength={1000}
              onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Target audience</span>
            <input
              className={`${field} mt-1`}
              value={profile.target_audience}
              maxLength={500}
              placeholder="e.g. Young professionals and remote workers"
              onChange={e => setProfile(p => ({ ...p, target_audience: e.target.value }))}
            />
          </label>
          <label className="block sm:w-1/2">
            <span className="text-xs font-medium text-gray-700">Language for insights and captions</span>
            <input
              className={`${field} mt-1`}
              value={profile.language}
              maxLength={40}
              list="research-languages"
              placeholder="e.g. English"
              onChange={e => setProfile(p => ({ ...p, language: e.target.value }))}
            />
            <datalist id="research-languages">
              {LANGUAGES.map(l => <option key={l} value={l} />)}
            </datalist>
          </label>
          <div>
            <span className="text-xs font-medium text-gray-700">Niche keywords</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {profile.keywords.map(k => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                  {k}
                  <button
                    type="button"
                    aria-label={`Remove ${k}`}
                    onClick={() => setProfile(p => ({ ...p, keywords: p.keywords.filter(x => x !== k) }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                className={field}
                value={keywordInput}
                maxLength={60}
                placeholder="e.g. latte art, brunch, plant-based"
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addKeyword} className="h-9">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving || !profile.category.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save niche
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Tracked accounts + discovery ─────────────────────────────────────────────

function AccountsSection({
  clientId,
  accounts,
  config,
  limits,
  onChange,
}: {
  clientId: string;
  accounts: CompetitorAccount[];
  config: Overview['config'];
  limits: Overview['limits'];
  onChange: (accounts: CompetitorAccount[]) => void;
}) {
  const [platform, setPlatform] = useState<ResearchPlatform>('instagram');
  const [handle, setHandle] = useState('');
  const [relationship, setRelationship] = useState<'competitor' | 'inspiration'>('competitor');
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[] | null>(null);

  const platformAccounts = accounts.filter(a => a.platform === platform);
  const platformReady = config[platform];
  const atLimit = accounts.length >= limits.maxAccounts;

  const add = async (h: string, rel: 'competitor' | 'inspiration', source: 'manual' | 'discovered') => {
    setAdding(h);
    setError(null);
    try {
      const data = await authedFetchJson<{ account: CompetitorAccount }>(
        `/api/clients/${clientId}/competitor-research/accounts`,
        { method: 'POST', body: { platform, handle: h, relationship: rel, source } }
      );
      onChange([...accounts, data.account]);
      if (source === 'manual') setHandle('');
      setSuggestions(s => s?.filter(x => x.handle !== data.account.handle) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAdding(null);
    }
  };

  const remove = async (account: CompetitorAccount) => {
    onChange(accounts.filter(a => a.id !== account.id));
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/accounts/${account.id}`, { method: 'DELETE' });
    } catch (err) {
      onChange(accounts);
      setError(err instanceof Error ? err.message : 'Failed to remove account');
    }
  };

  const discover = async () => {
    setDiscovering(true);
    setError(null);
    setSuggestions(null);
    try {
      const data = await authedFetchJson<{ suggestions: AccountSuggestion[] }>(
        `/api/clients/${clientId}/competitor-research/discover`,
        { method: 'POST', body: { platform, query: query.trim() || undefined }, timeoutMs: 150_000 }
      );
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Accounts to research</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Competitors and other accounts in your niche · {accounts.length}/{limits.maxAccounts} tracked
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          {(['instagram', 'tiktok'] as ResearchPlatform[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlatform(p);
                setSuggestions(null);
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                platform === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {PLATFORM_LABEL[p]}
              <span className="text-gray-400">{accounts.filter(a => a.platform === p).length}</span>
            </button>
          ))}
        </div>
      </div>

      {!platformReady && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          {platform === 'instagram'
            ? "Instagram research isn't connected yet. You can add accounts now; they'll be included once it's set up."
            : "TikTok research isn't connected yet. You can add accounts now; they'll be included once it's set up."}
        </p>
      )}

      {/* Tracked list */}
      {platformAccounts.length > 0 ? (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {platformAccounts.map(a => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar src={a.profile_picture_url} handle={a.handle} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={a.platform === 'tiktok' ? `https://www.tiktok.com/@${a.handle}` : `https://www.instagram.com/${a.handle}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:underline truncate"
                  >
                    @{a.handle}
                  </a>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 ${
                      a.relationship === 'competitor' ? 'bg-rose-50 text-rose-700' : 'bg-violet-50 text-violet-700'
                    }`}
                  >
                    {a.relationship === 'competitor' ? 'Competitor' : 'Inspiration'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {[a.display_name, a.followers_count !== null && `${formatCount(a.followers_count)} followers`]
                    .filter(Boolean)
                    .join(' · ') || 'Details load on the next research run'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(a)}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                aria-label={`Stop tracking @${a.handle}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
          No {PLATFORM_LABEL[platform]} accounts yet — add a handle or search your niche below.
        </p>
      )}

      {/* Add by handle */}
      <form
        className="flex gap-2 flex-wrap"
        onSubmit={e => {
          e.preventDefault();
          if (handle.trim()) add(handle.trim(), relationship, 'manual');
        }}
      >
        <input
          className="flex-1 min-w-[180px] rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder={platform === 'instagram' ? '@handle or instagram.com/handle' : '@handle or tiktok.com/@handle'}
          value={handle}
          onChange={e => setHandle(e.target.value)}
          disabled={atLimit}
        />
        <select
          className="rounded-md border border-gray-200 px-2 py-2 text-sm bg-white"
          value={relationship}
          onChange={e => setRelationship(e.target.value as 'competitor' | 'inspiration')}
        >
          <option value="competitor">Competitor</option>
          <option value="inspiration">Inspiration</option>
        </select>
        <Button type="submit" size="sm" className="h-9" disabled={!handle.trim() || atLimit || adding !== null}>
          {adding !== null && adding === handle.trim() ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </form>

      {/* Discovery */}
      <div className="rounded-lg bg-gray-50 p-3 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <input
            className="flex-1 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Optional: what to look for, e.g. “cafés in Auckland with great Reels”"
            value={query}
            maxLength={200}
            onChange={e => setQuery(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" className="h-9 bg-white w-full sm:w-auto" onClick={discover} disabled={discovering}>
            {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Find accounts in my niche
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          Searches the web using your niche profile · {limits.discoveryCredits} credit
          {platform === 'tiktok' && ' · TikTok handles are unverified until the next research run'}
        </p>

        {discovering && (
          <p className="text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching the web and checking accounts — this takes up to a minute…
          </p>
        )}

        {suggestions && suggestions.length === 0 && (
          <p className="text-xs text-gray-500">No new accounts found. Try adding a more specific search above.</p>
        )}

        {suggestions && suggestions.length > 0 && (
          <ul className="space-y-2">
            {suggestions.map(s => (
              <li key={s.handle} className="flex items-start gap-3 rounded-md bg-white border border-gray-100 px-3 py-2.5">
                <Avatar src={s.profile_picture_url} handle={s.handle} size="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={s.platform === 'tiktok' ? `https://www.tiktok.com/@${s.handle}` : `https://www.instagram.com/${s.handle}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      @{s.handle}
                    </a>
                    {s.name && <span className="text-xs text-gray-500">{s.name}</span>}
                    {s.followers_count !== null && (
                      <span className="text-xs text-gray-400">{formatCount(s.followers_count)} followers</span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">{s.relationship}</span>
                    {!s.verified && s.platform === 'instagram' && (
                      <span className="text-[10px] text-amber-700" title="Instagram is busy, so this account wasn't checked yet">unverified</span>
                    )}
                  </div>
                  {s.reason && <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={adding !== null || atLimit}
                  onClick={() => add(s.handle, s.relationship, 'discovered')}
                >
                  {adding === s.handle ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Track
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function CompetitorResearchPanel({ clientId }: { clientId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [includeTrends, setIncludeTrends] = useState(true);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FullReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await authedFetchJson<Overview>(`/api/clients/${clientId}/competitor-research`);
      setOverview(data);
      setSelectedId(prev => prev ?? data.reports.find(r => r.status !== 'failed')?.id ?? data.reports[0]?.id ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load the selected report; poll while it's running.
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;

    const fetchReport = async (first: boolean) => {
      if (first) setLoadingReport(true);
      try {
        const data = await authedFetchJson<{ report: FullReport }>(
          `/api/clients/${clientId}/competitor-research/reports/${selectedId}`
        );
        if (cancelled) return;
        setSelected(data.report);
        setOverview(o =>
          o
            ? {
                ...o,
                reports: o.reports.map(r => (r.id === data.report.id ? { ...r, ...data.report } : r)),
              }
            : o
        );
        if (data.report.status === 'running' || data.report.status === 'queued') {
          // Polling a queued run past its start time is what starts it
          pollRef.current = setTimeout(() => fetchReport(false), data.report.status === 'queued' ? 30_000 : 4000);
        } else if (!first) {
          // Finished while we watched: account details were refreshed by the run
          load();
        }
      } catch {
        if (!cancelled) pollRef.current = setTimeout(() => fetchReport(false), 8000);
      } finally {
        if (first && !cancelled) setLoadingReport(false);
      }
    };

    fetchReport(true);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [clientId, selectedId, load]);

  const startRun = async () => {
    setStarting(true);
    setRunError(null);
    try {
      const data = await authedFetchJson<{ report: ReportSummary }>(
        `/api/clients/${clientId}/competitor-research/reports`,
        { method: 'POST', body: { includeTrends } }
      );
      setOverview(o => (o ? { ...o, reports: [data.report, ...o.reports] } : o));
      setSelectedId(data.report.id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to start research');
    } finally {
      setStarting(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm('Delete this research report?')) return;
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/reports/${id}`, { method: 'DELETE' });
      const reports = overview?.reports.filter(r => r.id !== id) ?? [];
      setOverview(o => (o ? { ...o, reports: o.reports.filter(r => r.id !== id) } : o));
      setSelectedId(reports[0]?.id ?? null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  if (loadError) {
    return <div className="p-8 text-center text-sm text-red-600">{loadError}</div>;
  }
  if (!overview) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const queued = overview.reports.some(r => r.status === 'queued');
  const running = queued || overview.reports.some(r => r.status === 'running');
  const reachableAccounts = overview.accounts.filter(a => overview.config[a.platform]).length;
  const canRun = !running && (reachableAccounts > 0 || (includeTrends && overview.config.trends));

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Telescope className="h-6 w-6 text-blue-600" />
          Competitor Research
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          See what competitors and accounts in your niche are posting, what&apos;s working right now, and get post ideas to match
        </p>
      </div>

      <ProfileSection
        clientId={clientId}
        initial={overview.profile}
        saved={overview.profileSaved}
        onSaved={profile => setOverview(o => (o ? { ...o, profile, profileSaved: true } : o))}
      />

      <AccountsSection
        clientId={clientId}
        accounts={overview.accounts}
        config={overview.config}
        limits={overview.limits}
        onChange={accounts => setOverview(o => (o ? { ...o, accounts } : o))}
      />

      {/* Run */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-gray-900">Run research</h2>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={includeTrends}
              disabled={!overview.config.trends}
              onChange={e => setIncludeTrends(e.target.checked)}
              className="rounded border-gray-300"
            />
            Also search the web for trending formats, memes and engagement tactics in my niche
          </label>
          <p className="text-[11px] text-gray-400">
            Analyses the last 90 days of posts from {reachableAccounts} account{reachableAccounts === 1 ? '' : 's'} · {overview.limits.researchCredits} credits · takes 1–3 minutes
          </p>
        </div>
        <Button
          onClick={startRun}
          disabled={!canRun || starting}
          className="rounded-full pl-5 pr-4 font-semibold bg-gradient-to-r from-blue-500 to-blue-950 text-white hover:brightness-110"
        >
          {starting || running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
          {queued ? 'Queued…' : running ? 'Researching…' : 'Run research'}
          {!starting && !running && <Play className="h-4 w-4 ml-1.5 fill-current" />}
        </Button>
        {runError && <p className="w-full text-xs text-red-600">{runError}</p>}
      </section>

      {/* Report history + selected report */}
      {overview.reports.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {overview.reports.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  selectedId === r.id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {r.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                {r.status === 'queued' && <Clock className="h-3 w-3 text-amber-600" />}
                {r.status === 'completed' && <Check className="h-3 w-3 text-green-600" />}
                {r.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-500" />}
                {new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{' '}
                {new Date(r.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </button>
            ))}
          </div>

          {loadingReport && !selected && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {selected && selected.status === 'running' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-8 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm font-medium text-gray-900">{selected.progress || 'Researching'}…</p>
              <p className="text-xs text-gray-500">You can leave this page — the report will be here when it&apos;s done.</p>
            </div>
          )}

          {selected && selected.status === 'queued' && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-8 text-center space-y-2">
              <Clock className="h-6 w-6 text-amber-500 mx-auto" />
              <p className="text-sm font-medium text-gray-900">Queued — Instagram is busy right now</p>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                Instagram limits how many lookups we can make each hour, so this research will start automatically
                {selected.queued_until
                  ? ` around ${new Date(selected.queued_until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                  : ' shortly'}
                . You won&apos;t be charged until it runs, and you can leave this page.
              </p>
            </div>
          )}

          {selected && selected.status === 'failed' && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-800">Research failed</p>
                <p className="text-xs text-red-700 mt-1">{selected.error}</p>
                {selected.warnings?.map(w => (
                  <p key={w} className="text-xs text-red-600 mt-1">• {w}</p>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteReport(selected.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {selected && selected.status === 'completed' && selected.report && (
            <CompetitorResearchReport
              clientId={clientId}
              reportId={selected.id}
              report={selected.report}
              warnings={selected.warnings ?? []}
              meta={{ accounts: selected.accounts_analyzed, posts: selected.posts_analyzed, createdAt: selected.created_at }}
              purged={!!selected.raw_data_purged_at}
              retentionDays={overview.limits.retentionDays}
              onDelete={() => deleteReport(selected.id)}
            />
          )}
        </section>
      )}
    </div>
  );
}
