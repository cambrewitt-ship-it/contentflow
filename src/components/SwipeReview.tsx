'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, X, Calendar, Lightbulb, Trophy, Star, Snowflake, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  planId: string;
  clientId: string;
  candidates: AutopilotCandidate[];
  onComplete: (keptCount: number, keptCandidates: AutopilotCandidate[]) => void;
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

function CandidateCard({ candidate }: { candidate: AutopilotCandidate }) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden h-full flex flex-col select-none border border-gray-100">
      {/* Image */}
      <div className="relative flex-shrink-0" style={{ height: '260px' }}>
        <img
          src={candidate.media_url}
          alt="Post candidate"
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute top-2 right-2">
          <EventTag candidate={candidate} />
        </div>
        {candidate.post_type && (
          <div className="absolute top-2 left-2">
            <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full capitalize">
              {candidate.post_type}
            </span>
          </div>
        )}
        {/* Gradient overlay on image bottom */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-2 px-4 pt-2 pb-4 overflow-hidden">
        {/* Caption */}
        <div
          className="flex-1 text-sm text-gray-800 leading-relaxed overflow-y-auto"
          style={{ maxHeight: '100px' }}
        >
          {candidate.caption}
        </div>

        {/* Hashtags */}
        {candidate.hashtags && candidate.hashtags.length > 0 && (
          <p className="text-xs text-blue-500 font-medium flex-shrink-0 truncate">
            {candidate.hashtags.join(' ')}
          </p>
        )}

        <div className="border-t border-gray-100 pt-2 flex-shrink-0 space-y-1">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            {formatSuggestedDate(candidate.suggested_date, candidate.suggested_time)}
          </p>

          {candidate.ai_reasoning && (
            <p className="text-xs text-gray-400 italic flex items-start gap-1">
              <Lightbulb className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{candidate.ai_reasoning}</span>
            </p>
          )}

          {candidate.platforms && candidate.platforms.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {candidate.platforms.map(p => (
                <span
                  key={p}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    PLATFORM_STYLES[p.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SwipeReview({ planId, clientId, candidates, onComplete }: Props) {
  const { getAccessToken } = useAuth();

  const pending = useMemo(() => candidates.filter(c => c.decision === 'pending'), [candidates]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [localDecisions, setLocalDecisions] = useState<Record<string, 'kept' | 'skipped'>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  const touchStartX = useRef<number | null>(null);
  const isProcessing = useRef(false);
  const hasCompleted = useRef(false);

  const isDone = currentIndex >= pending.length;

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

        // Check if this was the last card
        if (newIndex >= pending.length && !hasCompleted.current) {
          hasCompleted.current = true;
          const prevKept = candidates.filter(c => c.decision === 'kept');
          const sessionKept = pending.filter(c => newDecisions[c.id] === 'kept');
          const allKept = [
            ...prevKept,
            ...sessionKept.map(c => ({ ...c, decision: 'kept' as const })),
          ];
          onComplete(allKept.length, allKept);
        }
      }, 370);

      // Fire-and-forget PATCH
      const token = getAccessToken();
      if (token) {
        fetch(`/api/autopilot/candidates/${candidate.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }).catch(() => {});
      }
    },
    [isAnimating, isDone, currentIndex, pending, localDecisions, candidates, getAccessToken, onComplete]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleDecision('kept');
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        handleDecision('skipped');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDecision]);

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

  const current = pending[currentIndex]!;
  const next1 = pending[currentIndex + 1];
  const next2 = pending[currentIndex + 2];

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto w-full px-4 sm:px-0">
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

      {/* Card stack */}
      <div className="relative" style={{ height: '560px' }}>
        {/* Back cards peeking */}
        {[
          { card: next2, offset: 2 },
          { card: next1, offset: 1 },
        ].map(({ card, offset }) => {
          if (!card) return null;
          return (
            <div
              key={card.id}
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `scale(${1 - offset * 0.04}) translateY(${offset * 12}px)`,
                zIndex: 10 - offset,
              }}
            >
              <CandidateCard candidate={card} />
            </div>
          );
        })}

        {/* Current card — animated */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: 30,
            transform: isAnimating
              ? direction === 'right'
                ? 'translateX(150%) rotate(15deg)'
                : 'translateX(-150%) rotate(-15deg)'
              : 'translateX(0) rotate(0deg)',
            opacity: isAnimating ? 0 : 1,
            transition: isAnimating
              ? 'transform 0.35s ease-out, opacity 0.2s ease-out'
              : 'none',
          }}
          onTouchStart={e => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchMove={e => e.preventDefault()}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) > 80) handleDecision(delta > 0 ? 'kept' : 'skipped');
          }}
        >
          <CandidateCard candidate={current} />

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

      {/* Action buttons */}
      <div className="flex justify-center gap-6 pt-1">
        <button
          onClick={() => handleDecision('skipped')}
          disabled={isAnimating}
          className="flex items-center gap-2 px-8 py-3 rounded-full border-2 border-red-200 text-red-500 font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
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

      <p className="text-center text-xs text-gray-300 hidden sm:block">
        ← arrow to skip · → arrow to keep
      </p>
    </div>
  );
}
