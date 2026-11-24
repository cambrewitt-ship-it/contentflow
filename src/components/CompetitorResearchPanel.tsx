'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  Info,
  Lightbulb,
  ListChecks,
  Loader2,
  Play,
  Plus,
  Search,
  Telescope,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authedFetchJson } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';
import CompetitorResearchReport from '@/components/CompetitorResearchReport';
import {
  Avatar,
  PlatformIcon,
  Pill,
  RELATIONSHIP,
  formatCount,
  profileUrl,
} from '@/components/CompetitorResearchShared';
import type {
  AccountSuggestion,
  CompetitorAccount,
  ResearchPlatform,
  ResearchProfile,
  ResearchReport,
} from '@/lib/competitor-research/types';

// Competitor Research for one client: the niche the agent researches, the
// accounts it tracks, and the reports it writes.

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

const SELECT_CLASS =
  'h-9 w-full appearance-none rounded-lg border border-input bg-white pl-3 pr-8 text-[13px] text-gray-900 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15';

const reportDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-start justify-between gap-3 py-2.5', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <span>
        <span className="block text-[13px] font-medium text-gray-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-4 text-gray-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
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
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-[13px] font-medium text-gray-900">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// ── Your niche ───────────────────────────────────────────────────────────────

function NicheCard({
  clientId,
  saved,
  isSaved,
  trendsAvailable,
  onSaved,
}: {
  clientId: string;
  saved: ResearchProfile;
  isSaved: boolean;
  trendsAvailable: boolean;
  onSaved: (p: ResearchProfile) => void;
}) {
  const [profile, setProfile] = useState(saved);
  const [keyword, setKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !isSaved || JSON.stringify(profile) !== JSON.stringify(saved);

  const set = <K extends keyof ResearchProfile>(k: K, v: ResearchProfile[K]) => setProfile(p => ({ ...p, [k]: v }));

  const addKeyword = () => {
    const k = keyword.trim();
    if (!k || profile.keywords.includes(k) || profile.keywords.length >= 15) return;
    set('keywords', [...profile.keywords, k]);
    setKeyword('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetchJson<{ profile: ResearchProfile }>(`/api/clients/${clientId}/competitor-research/profile`, {
        method: 'PUT',
        body: profile,
      });
      setProfile(data.profile);
      onSaved(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-[15px] font-semibold text-gray-900">Your niche</h3>
        {isSaved ? (
          <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved
          </Pill>
        ) : (
          <Pill className="bg-amber-50 text-amber-800 ring-amber-100">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Check and save
          </Pill>
        )}
      </header>

      <div className="space-y-3.5 px-4 py-3.5">
        {!isSaved && (
          <p className="rounded-lg bg-blue-50/70 px-2.5 py-1.5 text-xs text-blue-800 ring-1 ring-blue-100">
            Pre-filled from the brand profile. The agent uses this to find accounts and trends.
          </p>
        )}
        <Field label="Business category">
          <Input
            value={profile.category}
            maxLength={120}
            placeholder="e.g. Specialty coffee café"
            onChange={e => set('category', e.target.value)}
            className="h-9 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Location / market">
          <Input
            value={profile.location}
            maxLength={120}
            placeholder="e.g. Wellington, New Zealand"
            onChange={e => set('location', e.target.value)}
            className="h-9 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="What the business does">
          <Textarea
            value={profile.description}
            maxLength={1000}
            onChange={e => set('description', e.target.value)}
            className="min-h-[72px] rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Target audience">
          <Input
            value={profile.target_audience}
            maxLength={500}
            placeholder="e.g. Young professionals"
            onChange={e => set('target_audience', e.target.value)}
            className="h-9 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Language">
          <Input
            value={profile.language}
            maxLength={40}
            list="research-languages"
            placeholder="English"
            onChange={e => set('language', e.target.value)}
            className="h-9 rounded-lg text-[13px]"
          />
          <datalist id="research-languages">
            {LANGUAGES.map(l => <option key={l} value={l} />)}
          </datalist>
          <span className="mt-1 block text-xs text-gray-500">Insights and captions are written in this language.</span>
        </Field>
        <div>
          <span className="text-[13px] font-medium text-gray-900">Niche keywords</span>
          {profile.keywords.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.keywords.map(k => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs text-gray-700 ring-1 ring-gray-200">
                  {k}
                  <button
                    type="button"
                    aria-label={`Remove ${k}`}
                    onClick={() => set('keywords', profile.keywords.filter(x => x !== k))}
                    className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex gap-2">
            <Input
              value={keyword}
              maxLength={60}
              placeholder="e.g. latte art, brunch"
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              className="h-9 rounded-lg text-[13px]"
            />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0 rounded-lg" onClick={addKeyword} aria-label="Add keyword">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-1">
          <Toggle
            checked={profile.include_trends && trendsAvailable}
            disabled={!trendsAvailable}
            onChange={v => set('include_trends', v)}
            label="Search the web for trends"
            hint="Trending formats, memes and engagement tactics in this niche, on every run"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
        <span className="text-[11px] text-gray-500">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <Button size="sm" className="rounded-lg" onClick={save} disabled={!dirty || saving || !profile.category.trim()}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save niche
        </Button>
      </div>
    </section>
  );
}

// ── Find accounts (dialog) ───────────────────────────────────────────────────

function DiscoverDialog({
  clientId,
  platform,
  open,
  onOpenChange,
  niche,
  credits,
  canAdd,
  adding,
  onAdd,
}: {
  clientId: string;
  platform: ResearchPlatform;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  niche: string;
  credits: number;
  canAdd: boolean;
  adding: string | null;
  onAdd: (s: AccountSuggestion) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[] | null>(null);

  useEffect(() => {
    if (!open) {
      setSuggestions(null);
      setError(null);
    }
  }, [open, platform]);

  const search = async () => {
    setSearching(true);
    setError(null);
    setSuggestions(null);
    try {
      const data = await authedFetchJson<{ suggestions: AccountSuggestion[] }>(`/api/clients/${clientId}/competitor-research/discover`, {
        method: 'POST',
        body: { platform, query: query.trim() || undefined },
        timeoutMs: 150_000,
      });
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The search didn’t finish');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[17px]">
            <PlatformIcon platform={platform} className="h-4 w-4 text-gray-500" />
            Find {PLATFORM_LABEL[platform]} accounts in your niche
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Searches the web for competitors and accounts worth learning from{niche ? `, based on: ${niche}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={e => {
            e.preventDefault();
            search();
          }}
        >
          <Input
            value={query}
            maxLength={200}
            placeholder="Optional: e.g. “cafés in Auckland with great Reels”"
            onChange={e => setQuery(e.target.value)}
            className="h-10 rounded-xl text-[13px]"
          />
          <Button type="submit" variant="ai" disabled={searching} className="h-10 whitespace-nowrap rounded-xl px-4">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </form>
        <p className="-mt-2 text-[11px] text-gray-500">
          {credits} credit per search{platform === 'tiktok' ? ' · TikTok handles are checked on the next research run' : ''}
        </p>

        {searching && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-3.5 py-2.5">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
            <p className="thinking-shimmer text-[13px] font-medium">Searching the web and checking accounts — up to a minute…</p>
          </div>
        )}
        {error && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>}

        {suggestions && suggestions.length === 0 && (
          <p className="rounded-xl bg-gray-50 px-3.5 py-6 text-center text-[13px] text-gray-500 ring-1 ring-gray-200/70">
            No new accounts found. Try describing what you’re looking for.
          </p>
        )}

        {suggestions && suggestions.length > 0 && (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200/80">
            {suggestions.map(s => (
              <li key={s.handle} className="flex items-start gap-3 px-3.5 py-3">
                <Avatar src={s.profile_picture_url} handle={s.handle} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={profileUrl(s.platform, s.handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-semibold text-gray-900 hover:text-blue-700"
                    >
                      @{s.handle}
                    </a>
                    <Pill className={RELATIONSHIP[s.relationship].pill}>{RELATIONSHIP[s.relationship].label}</Pill>
                    {!s.verified && s.platform === 'instagram' && (
                      <Pill className="bg-gray-100 text-gray-600 ring-gray-200">Unverified</Pill>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {[s.name, s.followers_count !== null && `${formatCount(s.followers_count)} followers`].filter(Boolean).join(' · ')}
                  </p>
                  {s.reason && <p className="mt-1 text-[13px] leading-5 text-gray-600">{s.reason}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 rounded-lg text-[13px]"
                  disabled={adding !== null || !canAdd}
                  onClick={async () => {
                    if (await onAdd(s)) setSuggestions(list => list?.filter(x => x.handle !== s.handle) ?? null);
                  }}
                >
                  {adding === s.handle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Track
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Accounts ─────────────────────────────────────────────────────────────────

function AccountsCard({
  clientId,
  accounts,
  config,
  limits,
  niche,
  onChange,
}: {
  clientId: string;
  accounts: CompetitorAccount[];
  config: Overview['config'];
  limits: Overview['limits'];
  niche: string;
  onChange: (accounts: CompetitorAccount[]) => void;
}) {
  const [platform, setPlatform] = useState<ResearchPlatform>('instagram');
  const [handle, setHandle] = useState('');
  const [relationship, setRelationship] = useState<'competitor' | 'inspiration'>('competitor');
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const list = accounts.filter(a => a.platform === platform);
  const atLimit = accounts.length >= limits.maxAccounts;

  const add = async (h: string, rel: 'competitor' | 'inspiration', source: 'manual' | 'discovered'): Promise<boolean> => {
    setAdding(h);
    setError(null);
    try {
      const data = await authedFetchJson<{ account: CompetitorAccount }>(`/api/clients/${clientId}/competitor-research/accounts`, {
        method: 'POST',
        body: { platform, handle: h, relationship: rel, source },
      });
      onChange([...accounts, data.account]);
      if (source === 'manual') setHandle('');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t add that account');
      return false;
    } finally {
      setAdding(null);
    }
  };

  const remove = async (account: CompetitorAccount) => {
    const before = accounts;
    onChange(accounts.filter(a => a.id !== account.id));
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/accounts/${account.id}`, { method: 'DELETE' });
    } catch (err) {
      onChange(before);
      setError(err instanceof Error ? err.message : 'Couldn’t remove that account');
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-[15px] font-semibold text-gray-900">Accounts to research</h3>
        <span className="text-[11px] tabular-nums text-gray-500">
          {accounts.length}/{limits.maxAccounts}
        </span>
      </header>

      <div className="space-y-3 px-4 py-3.5">
        <div className="grid grid-cols-2 rounded-xl border border-gray-200/80 bg-gray-50/70 p-1" role="tablist">
          {(['instagram', 'tiktok'] as ResearchPlatform[]).map(p => (
            <button
              key={p}
              role="tab"
              aria-selected={platform === p}
              onClick={() => {
                setPlatform(p);
                setError(null);
              }}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                platform === p ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {PLATFORM_LABEL[p]}
              <span className="tabular-nums text-gray-400">{accounts.filter(a => a.platform === p).length}</span>
            </button>
          ))}
        </div>

        {!config[platform] && (
          <p className="flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
            {PLATFORM_LABEL[platform]} research isn’t connected yet. Accounts you add are included once it’s set up.
          </p>
        )}

        {list.length > 0 ? (
          <ul className="-mx-1 divide-y divide-gray-100">
            {list.map(a => (
              <li key={a.id} className="group flex items-center gap-2.5 px-1 py-2">
                <Avatar src={a.profile_picture_url} handle={a.handle} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={profileUrl(a.platform, a.handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[13px] font-medium text-gray-900 hover:text-blue-700"
                    >
                      @{a.handle}
                    </a>
                    <Pill className={cn('flex-shrink-0 px-1.5 py-px text-[10px]', RELATIONSHIP[a.relationship].pill)}>
                      {RELATIONSHIP[a.relationship].label}
                    </Pill>
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {a.followers_count !== null
                      ? `${formatCount(a.followers_count)} followers${a.display_name ? ` · ${a.display_name}` : ''}`
                      : a.display_name || 'Details load on the next run'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(a)}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Stop tracking @${a.handle}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
            No {PLATFORM_LABEL[platform]} accounts yet.
          </p>
        )}

        <form
          className="space-y-2"
          onSubmit={e => {
            e.preventDefault();
            if (handle.trim()) add(handle.trim(), relationship, 'manual');
          }}
        >
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={handle}
              onChange={e => setHandle(e.target.value)}
              disabled={atLimit}
              placeholder={platform === 'instagram' ? 'handle or instagram.com/…' : 'handle or tiktok.com/@…'}
              className="h-9 rounded-lg pl-8 text-[13px]"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={relationship}
                onChange={e => setRelationship(e.target.value as 'competitor' | 'inspiration')}
                className={SELECT_CLASS}
                aria-label="Account type"
              >
                <option value="competitor">Competitor</option>
                <option value="inspiration">Inspiration</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Button type="submit" size="sm" className="h-9 rounded-lg" disabled={!handle.trim() || atLimit || adding !== null}>
              {adding !== null && adding === handle.trim() ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </form>

        <Button variant="outline" className="h-9 w-full rounded-lg text-[13px]" onClick={() => setDiscoverOpen(true)} disabled={atLimit}>
          <Search className="h-4 w-4" />
          Find accounts in my niche
        </Button>

        {atLimit && <p className="text-xs text-gray-500">You’re tracking the maximum — remove one to add another.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <DiscoverDialog
        clientId={clientId}
        platform={platform}
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        niche={niche}
        credits={limits.discoveryCredits}
        canAdd={!atLimit}
        adding={adding}
        onAdd={s => add(s.handle, s.relationship, 'discovered')}
      />
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorResearchPanel({ clientId }: { clientId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      setLoadError(err instanceof Error ? err.message : 'Couldn’t load competitor research');
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load the selected report; poll while it's running or queued.
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
        const data = await authedFetchJson<{ report: FullReport }>(`/api/clients/${clientId}/competitor-research/reports/${selectedId}`);
        if (cancelled) return;
        setSelected(data.report);
        setOverview(o => (o ? { ...o, reports: o.reports.map(r => (r.id === data.report.id ? { ...r, ...data.report } : r)) } : o));
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
    if (!overview) return;
    setStarting(true);
    setRunError(null);
    try {
      const data = await authedFetchJson<{ report: ReportSummary }>(`/api/clients/${clientId}/competitor-research/reports`, {
        method: 'POST',
        body: { includeTrends: overview.profile.include_trends && overview.config.trends },
      });
      setOverview(o => (o ? { ...o, reports: [data.report, ...o.reports] } : o));
      setSelectedId(data.report.id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Couldn’t start the research');
    } finally {
      setStarting(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm('Delete this research report?')) return;
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/reports/${id}`, { method: 'DELETE' });
      const rest = overview?.reports.filter(r => r.id !== id) ?? [];
      setOverview(o => (o ? { ...o, reports: o.reports.filter(r => r.id !== id) } : o));
      setSelectedId(rest[0]?.id ?? null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Couldn’t delete the report');
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{loadError}</p>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const { config, limits, accounts, reports, profile } = overview;
  const queued = reports.some(r => r.status === 'queued');
  const busy = queued || reports.some(r => r.status === 'running');
  const reachable = accounts.filter(a => config[a.platform]).length;
  const trendsOn = profile.include_trends && config.trends;
  const canRun = !busy && (reachable > 0 || trendsOn);
  const nicheSummary = [profile.category, profile.location].filter(Boolean).join(', ');

  const setupNote = !config.instagram
    ? 'Instagram research isn’t connected yet — see COMPETITOR_RESEARCH_SETUP.md. Trend search still works.'
    : !config.tiktok && accounts.some(a => a.platform === 'tiktok')
      ? 'TikTok research isn’t connected yet, so TikTok accounts are skipped for now.'
      : null;

  const done = selected?.status === 'completed' && selected.report ? selected : null;
  const stats = done?.report
    ? [
        { label: 'Accounts analysed', value: done.accounts_analyzed, icon: Users, tone: 'text-blue-600 bg-blue-50 ring-blue-100' },
        { label: 'Posts analysed', value: done.posts_analyzed, icon: ListChecks, tone: 'text-blue-600 bg-blue-50 ring-blue-100' },
        {
          label: 'Best post vs usual',
          value: done.report.posts.length ? `${Math.max(...done.report.posts.map(p => p.relative_score))}×` : '—',
          icon: Flame,
          tone: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
        },
        { label: 'Trends spotted', value: done.report.trending_formats.length, icon: TrendingUp, tone: 'text-sky-600 bg-sky-50 ring-sky-100' },
        { label: 'Post ideas', value: done.report.post_ideas.length, icon: Lightbulb, tone: 'text-orange-600 bg-orange-50 ring-orange-100' },
      ]
    : [];

  const history = reports.length > 0 && (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          className={cn(SELECT_CLASS, 'w-auto min-w-[190px] rounded-xl')}
          aria-label="Report"
        >
          {reports.map(r => (
            <option key={r.id} value={r.id}>
              {reportDate(r.created_at)}
              {r.status === 'running' ? ' · running' : r.status === 'queued' ? ' · queued' : r.status === 'failed' ? ' · failed' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
      {selected && selected.status !== 'running' && selected.status !== 'queued' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => deleteReport(selected.id)}
          aria-label="Delete this report"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const steps = [
    { label: 'Confirm your niche', hint: 'Category, location and language', done: overview.profileSaved },
    { label: 'Add accounts to research', hint: 'Competitors and accounts you admire', done: accounts.length > 0 },
    { label: 'Run research', hint: `${limits.researchCredits} credits · takes 1–3 minutes`, done: false },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6 md:py-7">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <Telescope className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">Competitor Research</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-gray-500">
              Studies what competitors and accounts in this niche post on Instagram and TikTok — the visuals, captions and
              tactics that are working right now — and turns it into post ideas in this client&apos;s voice.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Button variant="ai" onClick={startRun} disabled={!canRun || starting} className="h-10 rounded-xl px-4">
            {starting || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {queued ? 'Queued…' : busy ? 'Researching…' : 'Run research'}
          </Button>
          <span className="text-[11px] text-gray-500">
            {reachable} account{reachable === 1 ? '' : 's'}
            {trendsOn ? ' + web trends' : ''} · {limits.researchCredits} credits
          </span>
        </div>
      </header>

      {setupNote && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {setupNote}
        </p>
      )}
      {runError && <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-[13px] text-red-700">{runError}</p>}

      {selected?.status === 'running' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white/80 px-3.5 py-2.5 shadow-xs backdrop-blur-sm">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
          <p className="thinking-shimmer text-[13px] font-medium">
            {selected.progress || 'Researching'}… you can leave this page — the report will be here when it&apos;s done.
          </p>
        </div>
      )}
      {selected?.status === 'queued' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-[13px] text-amber-900">
            <span className="font-medium">Queued — Instagram is busy right now.</span> Instagram limits lookups each hour, so this
            research starts automatically
            {selected.queued_until
              ? ` around ${new Date(selected.queued_until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
              : ' shortly'}
            . You won&apos;t be charged until it runs.
          </p>
        </div>
      )}

      {/* ── Last report summary ────────────────────────────────────────── */}
      {stats.length > 0 && (
        <section aria-label="Report summary" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/90 px-3.5 py-3 shadow-card backdrop-blur-sm',
                i === stats.length - 1 && 'col-span-2 sm:col-span-1'
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
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── Results ──────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">
          {reports.length === 0 ? (
            <section className="rounded-2xl border border-gray-200/80 bg-white/90 px-5 py-8 shadow-card backdrop-blur-sm sm:px-8">
              <div className="flex flex-col items-center text-center">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Telescope className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-gray-900">No research yet</p>
                <p className="mt-1 max-w-sm text-[13px] text-gray-500">
                  Three steps to your first report. Everything you need is in the panel{' '}
                  <span className="hidden lg:inline">on the right</span>
                  <span className="lg:hidden">above</span>.
                </p>
              </div>
              <ol className="mx-auto mt-5 max-w-sm space-y-2">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
                    {s.done ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                    ) : (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                        {i + 1}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className={cn('block text-[13px] font-medium', s.done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900')}>
                        {s.label}
                      </span>
                      <span className="block text-xs text-gray-500">{s.hint}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : done?.report ? (
            <CompetitorResearchReport
              clientId={clientId}
              reportId={done.id}
              report={done.report}
              warnings={done.warnings ?? []}
              meta={{ accounts: done.accounts_analyzed, posts: done.posts_analyzed, createdAt: done.created_at }}
              purged={!!done.raw_data_purged_at}
              retentionDays={limits.retentionDays}
              toolbar={history}
            />
          ) : (
            <>
              <div className="flex justify-end">{history}</div>
              {selected?.status === 'failed' ? (
                <section className="rounded-2xl border border-red-200/80 bg-white p-4 shadow-card">
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                    Research didn’t finish
                  </h3>
                  <p className="mt-2 text-[13px] text-gray-700">{selected.error}</p>
                  {selected.warnings && selected.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500">
                      {selected.warnings.map(w => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-gray-500">You weren&apos;t charged for this run.</p>
                </section>
              ) : (
                (loadingReport || selected?.status === 'running' || selected?.status === 'queued') && (
                  <div className="space-y-3" aria-busy="true">
                    <div className="h-28 animate-pulse rounded-2xl border border-gray-200/70 bg-white/80" />
                    <div className="grid gap-3 md:grid-cols-2">
                      {[0, 1].map(i => (
                        <div key={i} className="space-y-2 rounded-2xl border border-gray-200/70 bg-white/80 p-4">
                          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                          <div className="h-20 animate-pulse rounded-xl bg-gray-50" />
                        </div>
                      ))}
                    </div>
                    <p className="sr-only">Loading…</p>
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* ── Setup ────────────────────────────────────────────────────── */}
        <aside className={cn('space-y-4 lg:sticky lg:top-4', reports.length === 0 && 'order-first lg:order-none')}>
          <AccountsCard
            clientId={clientId}
            accounts={accounts}
            config={config}
            limits={limits}
            niche={nicheSummary}
            onChange={list => setOverview(o => (o ? { ...o, accounts: list } : o))}
          />
          <NicheCard
            clientId={clientId}
            saved={profile}
            isSaved={overview.profileSaved}
            trendsAvailable={config.trends}
            onSaved={p => setOverview(o => (o ? { ...o, profile: p, profileSaved: true } : o))}
          />
          <details className="group rounded-2xl border border-blue-100/80 bg-blue-50/50 text-xs text-gray-600 backdrop-blur-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-gray-800 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-600" /> Good to know
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ul className="list-disc space-y-1.5 px-4 pb-3.5 pl-8 leading-4">
              <li>Instagram only allows looking up Business and Creator accounts — personal accounts can&apos;t be researched.</li>
              <li>Each run looks at the last 90 days of posts. Accounts are refreshed at most once a day.</li>
              <li>Competitor images come from Instagram and TikTok links that expire after a few days.</li>
              <li>Competitors&apos; captions and images are removed from reports after {limits.retentionDays} days; the insights stay.</li>
              <li>Post ideas go to the calendar as drafts without a photo — add your own before scheduling.</li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}
