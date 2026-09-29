'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, X, Calendar, Lightbulb, Trophy, Star, Snowflake, Sun, Pencil, Loader2, BookmarkPlus, Wand2 } from 'lucide-react';
import type { AutopilotCandidate } from '@/types/autopilot';
import { PostSocialPreview } from '@/components/PostSocialPreview';
import PostFeedbackPanel from '@/components/PostFeedbackPanel';
import { authedFetchJson } from '@/lib/authedFetch';

interface Props {
  planId: string;
  clientId: string;
  candidates: AutopilotCandidate[];
  onComplete: (keptCount: number, keptCandidates: AutopilotCandidate[]) => void;
  /** Arrow-key shortcuts listen on the window — turn them off while the review is hidden. */
  keyboardEnabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSuggestedDate(date: string, time: string): string {
  const d = new Date(date + 'T00:00:00');
  const dayName = d.toLocaleDateString('en', { weekday: 'long' });
  const dateStr = d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
  const parts = time.split(':');
  const h = parseInt(parts[0] ?? '12', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${dayName}, ${dateStr} · ${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const PLATFORM_STYLES: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  tiktok: 'bg-gray-900 text-white',
  linkedin: 'bg-blue-800 text-white',
};

function EventTag({ candidate }: { candidate: AutopilotCandidate }) {
  if (!candidate.event_reference && !candidate.season_tag) return null;

  if (candidate.event_reference) {
    const ref = candidate.event_reference.toLowerCase();
    if (ref.includes('sport') || ref.includes('rugby') || ref.includes('cricket') || ref.includes('football')) {
      return (
        <span className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-1 rounded-full shadow">
          <Trophy className="h-3 w-3 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{candidate.event_reference}</span>
        </span>
      );
    }
    if (
      ref.includes('holiday') ||
      ref.includes('christmas') ||
      ref.includes('easter') ||
      ref.includes(' day')
    ) {
      return (
        <span className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full shadow">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{candidate.event_reference}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-orange-600 text-white text-xs px-2 py-1 rounded-full shadow">
        <Star className="h-3 w-3 flex-shrink-0" />
        <span className="truncate max-w-[120px]">{candidate.event_reference}</span>
      </span>
    );
  }

  if (candidate.season_tag) {
    const season = candidate.season_tag.toLowerCase();
    if (season === 'winter' || season === 'autumn') {
      return (
        <span className="flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow">
          <Snowflake className="h-3 w-3" /> {candidate.season_tag}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-amber-500 text-white text-xs px-2 py-1 rounded-full shadow">
        <Sun className="h-3 w-3" /> {candidate.season_tag}
      </span>
    );
  }

  return null;
}

// Character limits the ad copy is written against (see runBrief.ts)
const AD_LIMITS: Record<string, { headline: number; primary: number; description: number }> = {
  meta: { headline: 40, primary: 125, description: 30 },
  google: { headline: 30, primary: 90, description: 90 },
};

function normalizeHashtags(tags: string[] | null | undefined): string[] {
  return (tags ?? []).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`));
}

/** The caption exactly as it would be published: copy, then hashtags. */
function publishedCaption(candidate: AutopilotCandidate): string {
  const tags = normalizeHashtags(candidate.hashtags);
  return tags.length > 0 ? `${candidate.caption}\n\n${tags.join(' ')}` : candidate.caption;
}

function SpecField({
  label,
  text,
  limit,
  className = 'text-sm text-gray-800',
}: {
  label: string;
  text: string;
  limit?: number;
  className?: string;
}) {
  const over = limit != null && text.length > limit;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <span className={`text-[11px] tabular-nums ${over ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {text.length}
          {limit != null && ` / ${limit}`}
        </span>
      </div>
      <p className={`${className} leading-relaxed whitespace-pre-wrap break-words`}>{text}</p>
    </div>
  );
}

function Reasoning({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="text-xs text-gray-500 flex items-start gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
      <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
      <span>{text}</span>
    </p>
  );
}

function AdCopySpec({ candidate }: { candidate: AutopilotCandidate }) {
  const limits = AD_LIMITS[candidate.ad_platform ?? 'meta'] ?? AD_LIMITS.meta;
  return (
    <div className="space-y-4">
      <SpecField label="Headline" text={candidate.ad_headline ?? ''} limit={limits.headline} className="text-base font-semibold text-gray-900" />
      <SpecField label="Primary text" text={candidate.ad_primary_text ?? ''} limit={limits.primary} />
      {candidate.ad_description && (
        <SpecField label="Description" text={candidate.ad_description} limit={limits.description} className="text-sm text-gray-600" />
      )}
      <Reasoning text={candidate.ai_reasoning} />
    </div>
  );
}

function OrganicSpec({ candidate }: { candidate: AutopilotCandidate }) {
  const tags = normalizeHashtags(candidate.hashtags);
  return (
    <div className="space-y-4">
      <SpecField label="Caption" text={candidate.caption} limit={2200} className="text-[15px] text-gray-900" />

      {tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hashtags</p>
          <p className="text-sm text-blue-600 font-medium break-words">{tags.join(' ')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          {formatSuggestedDate(candidate.suggested_date, candidate.suggested_time)}
        </span>
        {candidate.platforms && candidate.platforms.length > 0 && (
          <span className="flex gap-1 flex-wrap">
            {candidate.platforms.map(p => (
              <span
                key={p}
                className={`px-2 py-0.5 rounded-full font-medium capitalize ${
                  PLATFORM_STYLES[p.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {p}
              </span>
            ))}
          </span>
        )}
      </div>

      <Reasoning text={candidate.ai_reasoning} />
    </div>
  );
}

/** Hand-edit the copy in place. Saves via the candidate PATCH (which keeps the AI's original). */
function CopyEditor({
  candidate,
  onSaved,
  onCancel,
}: {
  candidate: AutopilotCandidate;
  onSaved: (updated: AutopilotCandidate) => void;
  onCancel: () => void;
}) {
  const isAd = candidate.post_type === 'paid_ad';
  const [caption, setCaption] = useState(candidate.caption);
  const [hashtags, setHashtags] = useState(normalizeHashtags(candidate.hashtags).join(' '));
  const [headline, setHeadline] = useState(candidate.ad_headline ?? '');
  const [primary, setPrimary] = useState(candidate.ad_primary_text ?? '');
  const [description, setDescription] = useState(candidate.ad_description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const body: Record<string, unknown> = isAd
      ? {
          ad_headline: headline.trim(),
          ad_primary_text: primary.trim(),
          ...(description.trim() ? { ad_description: description.trim() } : {}),
        }
      : {
          caption: caption.trim(),
          hashtags: hashtags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean),
        };
    if (isAd ? !headline.trim() || !primary.trim() : !caption.trim()) {
      setError(isAd ? 'Headline and primary text are required.' : 'Caption can’t be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await authedFetchJson<{ candidate: AutopilotCandidate }>(`/api/autopilot/candidates/${candidate.id}`, {
        method: 'PATCH',
        body,
      });
      onSaved(data.candidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-300';

  return (
    <div className="space-y-3">
      {isAd ? (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Headline</span>
            <input value={headline} onChange={e => setHeadline(e.target.value)} className={inputClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Primary text</span>
            <textarea value={primary} onChange={e => setPrimary(e.target.value)} rows={4} className={`${inputClass} resize-y`} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</span>
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
          </label>
        </>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Caption <span className="font-normal normal-case tabular-nums">{caption.length} / 2200</span>
            </span>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={8} className={`${inputClass} resize-y text-[15px] leading-relaxed`} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hashtags</span>
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#one #two" className={inputClass} />
          </label>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

/** Full-spec card: the uncropped photo and every word of the copy. */
function CandidateSpecCard({
  candidate,
  onUpdated,
}: {
  candidate: AutopilotCandidate;
  onUpdated?: (updated: AutopilotCandidate) => void;
}) {
  const isAd = candidate.post_type === 'paid_ad';
  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const changed = Boolean(candidate.original_caption && candidate.original_caption !== candidate.caption);

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col select-none border border-gray-100">
      <div className="relative bg-gray-50 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.media_url}
          alt="Post candidate"
          className="w-full h-auto max-h-[70vh] object-contain"
          draggable={false}
        />
        {!isAd && (
          <div className="absolute top-2 right-2">
            <EventTag candidate={candidate} />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className={`text-xs px-2 py-1 rounded-full capitalize backdrop-blur-sm ${
              isAd ? 'bg-amber-500/90 text-white font-semibold' : 'bg-black/50 text-white'
            }`}
          >
            {isAd ? `Paid ad · ${candidate.ad_platform === 'google' ? 'Google' : 'Meta'}` : candidate.post_type}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {onUpdated && !editing && (
          <div className="flex items-center justify-between gap-2 -mt-1">
            {changed ? (
              <button
                type="button"
                onClick={() => setShowOriginal(v => !v)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Edited · {showOriginal ? 'hide' : 'show'} original
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit copy
            </button>
          </div>
        )}

        {showOriginal && changed && !editing && (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 px-3 py-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">AI’s original</p>
            <p className="text-sm text-gray-500 whitespace-pre-wrap break-words">{candidate.original_caption}</p>
          </div>
        )}

        {editing && onUpdated ? (
          <CopyEditor
            candidate={candidate}
            onCancel={() => setEditing(false)}
            onSaved={updated => {
              onUpdated(updated);
              setEditing(false);
            }}
          />
        ) : isAd ? (
          <AdCopySpec candidate={candidate} />
        ) : (
          <OrganicSpec candidate={candidate} />
        )}
      </div>
    </div>
  );
}

/** How the post will look on its platform(s), using the shared social previews. */
function CandidatePreview({
  candidate,
  businessName,
  logoUrl,
  platform,
  onPlatformChange,
}: {
  candidate: AutopilotCandidate;
  businessName: string;
  logoUrl: string | null;
  platform: string | undefined;
  onPlatformChange: (p: string) => void;
}) {
  const isAd = candidate.post_type === 'paid_ad';

  if (isAd && candidate.ad_platform === 'google') {
    return (
      <p className="text-sm text-gray-400 text-center py-10 px-4">
        No social preview for Google Ads. The full copy is on the left.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <PostSocialPreview
        key={candidate.id}
        imageUrl={candidate.media_url}
        caption={isAd ? candidate.ad_primary_text ?? '' : publishedCaption(candidate)}
        businessName={businessName}
        logoUrl={logoUrl}
        // Meta ads run in the Facebook and Instagram feeds
        targetPlatforms={isAd ? ['facebook', 'instagram'] : candidate.platforms}
        platform={platform}
        onPlatformChange={onPlatformChange}
      />
      {isAd && (
        <p className="text-[11px] text-gray-400 text-center">
          Feed layout only. Meta adds the headline and CTA button under the image.
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SwipeReview({ planId, clientId, candidates, onComplete, keyboardEnabled = true }: Props) {

  const pending = useMemo(() => candidates.filter(c => c.decision === 'pending'), [candidates]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [localDecisions, setLocalDecisions] = useState<Record<string, 'kept' | 'skipped'>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  // Platform picked in the preview stays open as you move between posts
  const [previewPlatform, setPreviewPlatform] = useState<string | undefined>(undefined);
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  // Edits and rewrites made during review, by candidate id
  const [overrides, setOverrides] = useState<Record<string, AutopilotCandidate>>({});
  // Playbook rules added during this review, offered for the posts still to come
  const [sessionRules, setSessionRules] = useState<
    Array<{ rule: string; sourceId: string; applying?: boolean; appliedCount?: number; error?: string }>
  >([]);

  const resolve = useCallback((c: AutopilotCandidate) => overrides[c.id] ?? c, [overrides]);
  const applyUpdates = useCallback((updated: AutopilotCandidate[]) => {
    setOverrides(prev => {
      const next = { ...prev };
      for (const c of updated) next[c.id] = { ...(prev[c.id] ?? {}), ...c };
      return next;
    });
  }, []);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const isProcessing = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasCompleted = useRef(false);

  const isDone = currentIndex >= pending.length;

  // Client name + logo for the previews
  useEffect(() => {
    authedFetchJson<{ client?: { name?: string; logo_url?: string | null } }>(`/api/clients/${clientId}`)
      .then(data => {
        if (data.client) setBrand({ name: data.client.name ?? '', logoUrl: data.client.logo_url ?? null });
      })
      .catch(() => {});
  }, [clientId]);

  // Handle "already all decided" case on mount
  useEffect(() => {
    if (pending.length === 0 && !hasCompleted.current) {
      hasCompleted.current = true;
      const alreadyKept = candidates.filter(c => c.decision === 'kept');
      onComplete(alreadyKept.length, alreadyKept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDecision = useCallback(
    (decision: 'kept' | 'skipped') => {
      if (isAnimating || isProcessing.current || isDone) return;
      isProcessing.current = true;

      const candidate = pending[currentIndex];
      if (!candidate) return;

      setDirection(decision === 'kept' ? 'right' : 'left');
      setIsAnimating(true);

      setTimeout(() => {
        const newDecisions = { ...localDecisions, [candidate.id]: decision };
        setLocalDecisions(newDecisions);

        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        setIsAnimating(false);
        setDirection(null);
        isProcessing.current = false;
        // Cards vary in height now — start the next one from its top
        const top = rootRef.current?.getBoundingClientRect().top ?? 0;
        if (top < 0) window.scrollBy({ top: top - 16, behavior: 'smooth' });

        // Check if this was the last card
        if (newIndex >= pending.length && !hasCompleted.current) {
          hasCompleted.current = true;
          const prevKept = candidates.filter(c => c.decision === 'kept');
          const sessionKept = pending.filter(c => newDecisions[c.id] === 'kept');
          const allKept = [
            ...prevKept,
            ...sessionKept.map(c => ({ ...resolve(c), decision: 'kept' as const })),
          ];
          onComplete(allKept.length, allKept);
        }
      }, 370);

      // Fire-and-forget PATCH
      authedFetchJson(`/api/autopilot/candidates/${candidate.id}`, {
        method: 'PATCH',
        body: { decision },
      }).catch(() => {});
    },
    [isAnimating, isDone, currentIndex, pending, localDecisions, candidates, onComplete, resolve]
  );

  async function applyRuleToRemaining(rule: string, sourceId: string) {
    const targetIds = pending.slice(currentIndex).map(c => c.id).filter(id => id !== sourceId);
    if (targetIds.length === 0) return;
    setSessionRules(prev => prev.map(r => (r.rule === rule ? { ...r, applying: true, error: undefined } : r)));
    try {
      const data = await authedFetchJson<{ candidates?: AutopilotCandidate[] }>(`/api/autopilot/plans/${planId}/apply-rule`, {
        method: 'POST',
        body: { rule, candidateIds: targetIds },
        timeoutMs: 150_000,
      });
      const updated = data.candidates ?? [];
      applyUpdates(updated);
      setSessionRules(prev => prev.map(r => (r.rule === rule ? { ...r, applying: false, appliedCount: updated.length } : r)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update the remaining posts';
      setSessionRules(prev => prev.map(r => (r.rule === rule ? { ...r, applying: false, error: message } : r)));
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardEnabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') handleDecision('kept');
      // Enter on a focused button (e.g. a preview platform tab) should press that button
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) handleDecision('kept');
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        handleDecision('skipped');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDecision, keyboardEnabled]);

  const keptCount =
    candidates.filter(c => c.decision === 'kept').length +
    Object.values(localDecisions).filter(d => d === 'kept').length;
  const skippedCount = Object.values(localDecisions).filter(d => d === 'skipped').length;
  const progressPct = Math.round(
    ((currentIndex + candidates.filter(c => c.decision !== 'pending').length) /
      Math.max(candidates.length, 1)) *
      100
  );

  if (isDone || pending.length === 0) {
    // onComplete already fired via effect or timeout — render nothing while parent transitions
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Wrapping up…
      </div>
    );
  }

  const current = resolve(pending[currentIndex]!);
  const remainingAfterSource = (sourceId: string) =>
    pending.slice(currentIndex).filter(c => c.id !== sourceId).length;
  const stackDepth = Math.min(2, pending.length - currentIndex - 1);

  const actionButtons = (
    <div className="flex justify-center gap-6">
      <button
        onClick={() => handleDecision('skipped')}
        disabled={isAnimating}
        className="flex items-center gap-2 px-8 py-3 rounded-full border-2 border-red-200 bg-white text-red-500 font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
        style={{ minHeight: '48px' }}
      >
        <X className="h-5 w-5" />
        Skip
      </button>
      <button
        onClick={() => handleDecision('kept')}
        disabled={isAnimating}
        className="flex items-center gap-2 px-8 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-40 transition-colors shadow-md"
        style={{ minHeight: '48px' }}
      >
        <Check className="h-5 w-5" />
        Keep
      </button>
    </div>
  );

  return (
    // Sized by its container, not the viewport, so it fits both the full page
    // and the narrower Content Suite column
    <div ref={rootRef} className="@container flex flex-col gap-4 w-full">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {currentIndex + 1} of {pending.length}
          </span>
          <span>
            {keptCount} kept · {skippedCount} skipped
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, #3b82f6, #22c55e)',
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] items-start">
        {/* Full-spec card — animated */}
        <div className="relative" style={{ paddingBottom: stackDepth * 10 }}>
          {/* Edges of the cards still to come */}
          {Array.from({ length: stackDepth }, (_, i) => stackDepth - i).map(offset => (
            <div
              key={offset}
              aria-hidden
              className="absolute inset-x-0 top-0 rounded-2xl bg-white border border-gray-100 shadow-md"
              style={{
                bottom: stackDepth * 10 - offset * 10,
                transform: `scale(${1 - offset * 0.03})`,
                transformOrigin: 'bottom center',
                zIndex: 10 - offset,
              }}
            />
          ))}

          <div
            className="relative"
            style={{
              zIndex: 30,
              touchAction: 'pan-y',
              transform: isAnimating
                ? direction === 'right'
                  ? 'translateX(150%) rotate(15deg)'
                  : 'translateX(-150%) rotate(-15deg)'
                : 'translateX(0) rotate(0deg)',
              opacity: isAnimating ? 0 : 1,
              transition: isAnimating ? 'transform 0.35s ease-out, opacity 0.2s ease-out' : 'none',
            }}
            onTouchStart={e => {
              touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={e => {
              if (!touchStart.current) return;
              const dx = e.changedTouches[0].clientX - touchStart.current.x;
              const dy = e.changedTouches[0].clientY - touchStart.current.y;
              touchStart.current = null;
              // Horizontal swipes decide; vertical ones just scroll the card
              if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                handleDecision(dx > 0 ? 'kept' : 'skipped');
              }
            }}
          >
            <CandidateSpecCard key={current.id} candidate={current} onUpdated={c => applyUpdates([c])} />

            {/* Decision flash overlay */}
            {isAnimating && direction === 'right' && (
              <div className="absolute inset-0 rounded-2xl bg-green-500/15 flex items-center justify-center pointer-events-none">
                <div className="bg-green-500 text-white rounded-full p-5 shadow-lg">
                  <Check className="h-10 w-10" />
                </div>
              </div>
            )}
            {isAnimating && direction === 'left' && (
              <div className="absolute inset-0 rounded-2xl bg-red-500/15 flex items-center justify-center pointer-events-none">
                <div className="bg-red-500 text-white rounded-full p-5 shadow-lg">
                  <X className="h-10 w-10" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Social preview + actions — stays in view while the card scrolls */}
        <div className="@4xl:sticky @4xl:top-4 space-y-4">
          <div
            className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 transition-opacity duration-200"
            style={{ opacity: isAnimating ? 0.4 : 1 }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Preview</p>
            <CandidatePreview
              candidate={current}
              businessName={brand.name}
              logoUrl={brand.logoUrl}
              platform={previewPlatform}
              onPlatformChange={setPreviewPlatform}
            />
          </div>
          <PostFeedbackPanel
            key={current.id}
            candidate={current}
            clientName={brand.name}
            onUpdated={c => applyUpdates([c])}
            onRulesSaved={rules =>
              setSessionRules(prev => [
                ...prev,
                ...rules.filter(r => !prev.some(p => p.rule === r)).map(rule => ({ rule, sourceId: current.id })),
              ])
            }
            onSkip={() => handleDecision('skipped')}
          />

          {sessionRules.map(r => {
            const remaining = remainingAfterSource(r.sourceId);
            return (
              <div key={r.rule} className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-900 space-y-2">
                <p className="flex gap-1.5">
                  <BookmarkPlus className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-indigo-500" />
                  <span>
                    <span className="font-medium">Added to the caption playbook: </span>
                    {r.rule}
                  </span>
                </p>
                {r.appliedCount != null ? (
                  <p className="text-indigo-700">Applied to {r.appliedCount} post{r.appliedCount === 1 ? '' : 's'} in this review.</p>
                ) : (
                  remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => applyRuleToRemaining(r.rule, r.sourceId)}
                      disabled={r.applying}
                      className="flex items-center gap-1 font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                    >
                      {r.applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      {r.applying
                        ? 'Rewriting…'
                        : `Apply to the ${remaining} post${remaining === 1 ? '' : 's'} still to review (${remaining} credit${remaining === 1 ? '' : 's'})`}
                    </button>
                  )
                )}
                {r.error && <p className="text-red-600">{r.error}</p>}
              </div>
            );
          })}

          <div className="hidden @4xl:block space-y-2">
            {actionButtons}
            <p className="text-center text-xs text-gray-300">← arrow to skip · → arrow to keep</p>
          </div>
        </div>
      </div>

      {/* Mobile: actions pinned to the bottom so they're reachable below a tall card */}
      <div className="@4xl:hidden sticky bottom-3 z-40 py-2">{actionButtons}</div>
    </div>
  );
}
