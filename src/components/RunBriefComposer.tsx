'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Settings } from 'lucide-react';
import { useSporadicGlow } from '@/hooks/useSporadicGlow';
import { TARGET_PLATFORM_IDS, TARGET_PLATFORM_LABELS } from '@/lib/targetPlatforms';
import {
  AD_OBJECTIVES,
  AD_OBJECTIVE_LABELS,
  CAPTION_LENGTHS,
  GOAL_LABELS,
  ORGANIC_GOALS,
  POST_COUNTS,
  RUN_TONES,
  TONE_LABELS,
  organicEnabled,
  adsEnabled,
} from '@/lib/autopilot-agent/runBrief';
import type { RunBrief } from '@/lib/autopilot-agent/runBrief';

const FORMAT_OPTIONS: { value: RunBrief['format']; label: string }[] = [
  { value: 'organic', label: 'Organic posts' },
  { value: 'paid', label: 'Paid ads' },
  { value: 'both', label: 'Both' },
];

const PLACEHOLDERS: Record<RunBrief['format'], string> = {
  organic: 'Anything to focus on? e.g. push the new winter menu, and mention we’re closed Monday…',
  paid: 'What are we advertising? e.g. 20% off gift vouchers until Sunday, aimed at locals…',
  both: 'Anything to focus on? e.g. launch week for the new range — build buzz organically, sell it in the ads…',
};

const LENGTH_LABELS: Record<RunBrief['captionLength'], string> = {
  mixed: 'Mixed',
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
};

interface RunBriefComposerProps {
  value: RunBrief;
  onChange: (brief: RunBrief) => void;
  onSubmit: () => void;
  heading?: string;
  error?: string | null;
  /** Shown instead of running when set (e.g. not enough credits). */
  blockedReason?: string | null;
  footer?: React.ReactNode;
  autoFocus?: boolean;
}

export default function RunBriefComposer({
  value: brief,
  onChange,
  onSubmit,
  heading = 'What should this run focus on?',
  error,
  blockedReason,
  footer,
  autoFocus,
}: RunBriefComposerProps) {
  const [showSettings, setShowSettings] = useState(true);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof RunBrief>(key: K, v: RunBrief[K]) => onChange({ ...brief, [key]: v });
  const toggleIn = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item];

  const organic = organicEnabled(brief);
  const ads = adsEnabled(brief);

  // Sporadic glow, paused while the user is typing into the box so it doesn't distract
  const glow = useSporadicGlow(focused && brief.prompt.length > 0);

  // Grow the textarea with its content, up to a cap
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [brief.prompt]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    if (blockedReason) return;
    onSubmit();
  }

  const countLabel = brief.format === 'paid' ? 'ad variants' : 'posts';
  const summary = [
    `${brief.postCount} ${countLabel}`,
    organic && (brief.window === 'next_two_weeks' ? 'Next 2 weeks' : 'Next week'),
    brief.tone !== 'brand' && TONE_LABELS[brief.tone],
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">{heading}</h2>
        <Segmented
          options={FORMAT_OPTIONS}
          value={brief.format}
          onChange={v => set('format', v)}
          ariaLabel="Content type"
        />
      </div>

      {/* ── Prompt box ── */}
      <div
        className="prompt-glow rounded-[28px] shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        data-glow={glow}
      >
        <div
          className={`rounded-[28px] bg-white border px-5 pt-5 pb-4 transition-colors ${
            focused ? 'border-indigo-200' : 'border-gray-200'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={brief.prompt}
            onChange={e => set('prompt', e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={1000}
            rows={3}
            placeholder={PLACEHOLDERS[brief.format]}
            aria-label="Instructions for this run (optional)"
            className="w-full resize-none bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none min-h-[72px]"
          />

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowSettings(s => !s)}
                aria-expanded={showSettings}
                aria-label={showSettings ? 'Hide run settings' : 'Show run settings'}
                title="Run settings"
                className={`h-10 w-10 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                  showSettings
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Settings className={`h-5 w-5 transition-transform duration-300 ${showSettings ? 'rotate-90' : ''}`} />
              </button>
              <span className="text-xs text-gray-400 truncate">{summary}</span>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={Boolean(blockedReason)}
              title={blockedReason ?? 'Run agent (Enter)'}
              className={`h-11 shrink-0 rounded-full flex items-center gap-2 pl-5 pr-4 text-sm font-semibold text-white transition-all ${
                blockedReason
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-950 hover:shadow-[0_6px_20px_rgba(30,58,138,0.4)] hover:brightness-110'
              }`}
            >
              Run Agent
              <Play className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Primary toggles ── */}
      <div className="space-y-3">
        {organic && (
          <Field label={brief.format === 'both' ? 'Organic writing style' : 'Writing style'} hint="none = client's content mix">
            {ORGANIC_GOALS.map(g => (
              <Chip key={g} active={brief.goals.includes(g)} onClick={() => set('goals', toggleIn(brief.goals, g))}>
                {GOAL_LABELS[g]}
              </Chip>
            ))}
          </Field>
        )}
        {ads && (
          <Field label="Ad objective">
            {AD_OBJECTIVES.map(o => (
              <Chip key={o} active={brief.adObjective === o} onClick={() => set('adObjective', o)}>
                {AD_OBJECTIVE_LABELS[o]}
              </Chip>
            ))}
            <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />
            <Chip active={brief.adPlatform === 'meta'} onClick={() => set('adPlatform', 'meta')}>Meta</Chip>
            <Chip active={brief.adPlatform === 'google'} onClick={() => set('adPlatform', 'google')}>Google</Chip>
          </Field>
        )}
      </div>

      {/* ── More settings (the settings wheel) ── */}
      {showSettings && (
        <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 space-y-3">
          {organic && (
            <Field label="Platforms" hint="none = client's defaults">
              {TARGET_PLATFORM_IDS.map(p => (
                <Chip key={p} active={brief.platforms.includes(p)} onClick={() => set('platforms', toggleIn(brief.platforms, p))}>
                  {TARGET_PLATFORM_LABELS[p]}
                </Chip>
              ))}
            </Field>
          )}
          <Field label="Tone">
            {RUN_TONES.map(t => (
              <Chip key={t} active={brief.tone === t} onClick={() => set('tone', t)}>
                {TONE_LABELS[t]}
              </Chip>
            ))}
          </Field>
          {organic && (
            <Field label="Caption length">
              {CAPTION_LENGTHS.map(l => (
                <Chip key={l} active={brief.captionLength === l} onClick={() => set('captionLength', l)}>
                  {LENGTH_LABELS[l]}
                </Chip>
              ))}
            </Field>
          )}
          <Field label={brief.format === 'paid' ? 'Ad variants' : 'Posts to generate'}>
            {POST_COUNTS.map(n => (
              <Chip key={n} active={brief.postCount === n} onClick={() => set('postCount', n)}>
                {n}
              </Chip>
            ))}
          </Field>
          {organic && (
            <Field label="Posting window">
              <Chip active={brief.window === 'next_week'} onClick={() => set('window', 'next_week')}>Next week</Chip>
              <Chip active={brief.window === 'next_two_weeks'} onClick={() => set('window', 'next_two_weeks')}>Next 2 weeks</Chip>
            </Field>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <Toggle label="Call to action" checked={brief.includeCta} onChange={v => set('includeCta', v)} />
            <Toggle label="Emojis" checked={brief.useEmojis} onChange={v => set('useEmojis', v)} />
            {organic && <Toggle label="Hashtags" checked={brief.useHashtags} onChange={v => set('useHashtags', v)} />}
            <Toggle label="Prefer unused photos" checked={brief.preferFreshMedia} onChange={v => set('preferFreshMedia', v)} />
          </div>
        </div>
      )}

      {footer}

      {(error || blockedReason) && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error || blockedReason}
        </div>
      )}
    </div>
  );
}

// ── Small controls ────────────────────────────────────────────────────────────

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-full bg-gray-100 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <span className="text-xs font-medium text-gray-500 sm:w-36 shrink-0">
        {label}
        {hint && <span className="block text-[10px] font-normal text-gray-400">{hint}</span>}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      {label}
    </label>
  );
}
