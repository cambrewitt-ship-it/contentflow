'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SwipeReview from '@/components/SwipeReview';
import AdCopyPanel from '@/components/AdCopyPanel';
import GeneratedPostsReview from '@/components/GeneratedPostsReview';
import AutopilotDrafts from '@/components/AutopilotDrafts';
import AgentProgress, { recordAgentRunDuration } from '@/components/AgentProgress';
import RunBriefComposer from '@/components/RunBriefComposer';
import CaptionPlaybook from '@/components/CaptionPlaybook';
import { DEFAULT_RUN_BRIEF, runBriefSchema } from '@/lib/autopilot-agent/runBrief';
import type { RunBrief } from '@/lib/autopilot-agent/runBrief';
import {
  Loader2,
  Bot,
  Play,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  CalendarDays,
  FileText,
  Lock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import type { AutopilotPlan, AutopilotCandidate } from '@/types/autopilot';
import { formatDateRange } from '@/lib/dateUtils';
import { estimateWorstCaseCredits } from '@/lib/autopilot-agent/constants';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  generating: {
    label: 'Generating',
    color: 'bg-blue-100 text-blue-700',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  draft: {
    label: 'Saved to Drafts',
    color: 'bg-gray-100 text-gray-700',
    icon: <FileText className="h-3 w-3" />,
  },
  pending_approval: {
    label: 'Awaiting Review',
    color: 'bg-amber-100 text-amber-700',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  partially_approved: {
    label: 'Partially Approved',
    color: 'bg-orange-100 text-orange-700',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  published: {
    label: 'Published',
    color: 'bg-purple-100 text-purple-700',
    icon: <Zap className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-700', icon: null };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Panel component ───────────────────────────────────────────────────────────

type PageView = 'idle' | 'generating' | 'swipe' | 'review';

interface ContentAgentPanelProps {
  clientId: string;
  /** Fit a narrower column (the Content Suite's left card) instead of a full page. */
  compact?: boolean;
  /** False while the panel is mounted but hidden — keeps swipe keyboard shortcuts from firing. */
  active?: boolean;
  /**
   * Open a draft in the Content Suite editor. The Content Suite passes this to
   * load it in place; elsewhere the panel navigates there with ?draftId=.
   */
  onEditDraft?: (draft: AutopilotCandidate) => void;
}

// Plans the page can still act on. Anything else (saved to drafts, already sent
// to the calendar, failed) is finished business and leaves the page idle.
const ACTIONABLE_STATUSES = ['generating', 'pending_approval'];

// Run settings are remembered per client (the written prompt and picked photos
// are not — they're usually specific to one run).
const briefStorageKey = (clientId: string) => `contentAgentBrief:${clientId}`;

function loadSavedBrief(clientId: string): RunBrief {
  try {
    const raw = localStorage.getItem(briefStorageKey(clientId));
    if (!raw) return DEFAULT_RUN_BRIEF;
    const parsed = runBriefSchema.safeParse({ ...JSON.parse(raw), prompt: '', mediaIds: [] });
    return parsed.success ? parsed.data : DEFAULT_RUN_BRIEF;
  } catch {
    return DEFAULT_RUN_BRIEF;
  }
}

// Worst-case credit cost shown before a run — must match the server's
// pre-flight check in /api/autopilot/generate-plan.
const RUN_CREDIT_ESTIMATE = estimateWorstCaseCredits();

export default function ContentAgentPanel({
  clientId,
  compact = false,
  active = true,
  onEditDraft,
}: ContentAgentPanelProps) {
  const { getAccessToken, user } = useAuth();
  const router = useRouter();

  // Subscription gate
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState<{ max: number; used: number } | null>(null);

  // Plan / candidate data
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [activePlan, setActivePlan] = useState<AutopilotPlan | null>(null);
  const [candidates, setCandidates] = useState<AutopilotCandidate[]>([]);
  const [keptCandidates, setKeptCandidates] = useState<AutopilotCandidate[]>([]);

  // Drafts (the section below — posts kept and parked rather than calendared)
  const [drafts, setDrafts] = useState<AutopilotCandidate[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);

  // Page flow
  const [pageView, setPageView] = useState<PageView>('idle');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [savingTo, setSavingTo] = useState<'drafts' | 'calendar' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generateStartedAt, setGenerateStartedAt] = useState(0);
  const [brief, setBrief] = useState<RunBrief>(DEFAULT_RUN_BRIEF);

  useEffect(() => {
    setBrief(loadSavedBrief(clientId));
  }, [clientId]);

  const updateBrief = useCallback(
    (next: RunBrief) => {
      setBrief(next);
      try {
        localStorage.setItem(briefStorageKey(clientId), JSON.stringify({ ...next, prompt: undefined, mediaIds: undefined }));
      } catch {
        // storage unavailable — settings just won't be remembered
      }
    },
    [clientId]
  );

  const fetchRef = useRef(false);

  // ── Subscription tier ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from('subscriptions')
      .select('subscription_tier, max_ai_credits_per_month, ai_credits_used_this_month')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setSubscriptionTier(data?.subscription_tier ?? 'freemium');
        if (data?.max_ai_credits_per_month != null) {
          setCreditInfo({
            max: data.max_ai_credits_per_month as number,
            used: (data.ai_credits_used_this_month as number) ?? 0,
          });
        }
      })
      .catch(() => setSubscriptionTier('freemium'))
      .finally(() => setTierLoading(false));
  }, [user]);

  // ── Fetch candidates for a plan ────────────────────────────────────────────

  const fetchCandidates = useCallback(
    async (planId: string): Promise<AutopilotCandidate[]> => {
      const token = getAccessToken();
      if (!token) return [];
      try {
        const res = await fetch(`/api/autopilot/candidates?planId=${planId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return data.success ? (data.candidates as AutopilotCandidate[]) : [];
      } catch {
        return [];
      }
    },
    [getAccessToken]
  );

  // ── Drafts ─────────────────────────────────────────────────────────────────

  const fetchDrafts = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/autopilot/drafts?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setDrafts(data.drafts as AutopilotCandidate[]);
    } catch {
      // silent — the section just stays empty
    } finally {
      setLoadingDrafts(false);
    }
  }, [clientId, getAccessToken]);

  const handleDraftRemoved = useCallback((candidateId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== candidateId));
  }, []);

  const handleDraftUpdated = useCallback((draft: AutopilotCandidate) => {
    setDrafts(prev => prev.map(d => (d.id === draft.id ? draft : d)));
  }, []);

  const handleEditDraft = useCallback(
    (draft: AutopilotCandidate) => {
      if (onEditDraft) onEditDraft(draft);
      else router.push(`/dashboard/client/${clientId}/content-suite?draftId=${draft.id}`);
    },
    [onEditDraft, router, clientId]
  );

  // A draft may have been added to the calendar from the Content Suite editor
  // while this panel was hidden — refresh the list whenever it's shown again.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) fetchDrafts();
    wasActive.current = active;
  }, [active, fetchDrafts]);

  // ── Determine view from plan state ─────────────────────────────────────────

  const applyPlanState = useCallback(
    async (plan: AutopilotPlan, existingCandidates?: AutopilotCandidate[]) => {
      setActivePlan(plan);

      if (plan.generation_version !== 'v2') {
        // v1 plan — fall back to idle so the user can generate a new v2 plan
        setPageView('idle');
        return;
      }

      const planCandidates = existingCandidates ?? (await fetchCandidates(plan.id));
      setCandidates(planCandidates);

      if (planCandidates.some(c => c.decision === 'pending')) {
        setPageView('swipe');
        return;
      }

      // Everything swiped but no destination chosen yet — ask where they go.
      const kept = planCandidates.filter(c => c.decision === 'kept');
      if (kept.length === 0) {
        setPageView('idle');
        return;
      }
      setKeptCandidates(kept);
      setPageView('review');
    },
    [fetchCandidates]
  );

  // ── Fetch plans ────────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/autopilot/plans?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const plans: AutopilotPlan[] = data.plans ?? [];
        // Re-open only a plan that still needs a decision.
        const active = plans.find(p => ACTIONABLE_STATUSES.includes(p.status));
        if (active) {
          await applyPlanState(active);
        } else {
          setActivePlan(null);
          setPageView('idle');
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingPlans(false);
    }
  }, [clientId, getAccessToken, applyPlanState]);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    Promise.all([fetchPlans(), fetchDrafts()]).finally(() => {
      fetchRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ── Generate plan ──────────────────────────────────────────────────────────

  async function handleGenerate() {
    setShowGenerateModal(false);
    const startedAt = Date.now();
    setGenerateStartedAt(startedAt);
    setPageView('generating');
    setGenerateError(null);
    const token = getAccessToken();
    try {
      const res = await fetch('/api/autopilot/generate-plan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, force: true, brief }),
      });
      const data = await res.json();

      // Failures land back on the idle composer, brief intact, with the error
      if (!data.success) {
        setGenerateError(data.error || 'Failed to generate plan');
        setPageView('idle');
        return;
      }

      recordAgentRunDuration(Date.now() - startedAt);

      // Success — use the candidates returned directly (no extra fetch needed)
      const newPlan: AutopilotPlan = data.plan;
      const newCandidates: AutopilotCandidate[] = data.candidates ?? [];

      setBrief(prev => ({ ...prev, prompt: '' }));

      // Go directly to swipe with the freshly generated candidates
      setActivePlan(newPlan);
      setCandidates(newCandidates);
      setPageView('swipe');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Unexpected error');
      setPageView('idle');
    }
  }

  // ── Swipe complete ─────────────────────────────────────────────────────────
  // Nothing is saved automatically: the user picks the destination for the kept
  // posts — this page's Drafts section, or the calendar's unscheduled bar.

  function handleSwipeComplete(keptCount: number, kept: AutopilotCandidate[]) {
    setKeptCandidates(kept);
    setSaveError(null);
    setPageView(kept.length > 0 ? 'review' : 'idle');
  }

  // ── Destination: drafts ────────────────────────────────────────────────────

  async function handleSaveToDrafts() {
    if (!activePlan) {
      setSaveError('No active plan found');
      return;
    }
    setSavingTo('drafts');
    setSaveError(null);
    const token = getAccessToken();
    try {
      const res = await fetch('/api/autopilot/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save drafts');

      setActivePlan(null);
      setKeptCandidates([]);
      setCandidates([]);
      setPageView('idle');
      await fetchDrafts();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingTo(null);
    }
  }

  // ── Destination: calendar (unscheduled bar) ────────────────────────────────

  async function handleAddToCalendar() {
    if (!activePlan) {
      setSaveError('No active plan found');
      return;
    }
    setSavingTo('calendar');
    setSaveError(null);
    const token = getAccessToken();
    try {
      const res = await fetch(`/api/autopilot/plans/${activePlan.id}/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: 'unscheduled' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to add posts to the calendar');
      router.push(`/dashboard/client/${clientId}/calendar`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
      setSavingTo(null);
    }
  }

  // Ad-copy-only plans have nothing to place, so they just close out.
  async function handleAdCopyOnlyDone() {
    setActivePlan(null);
    setKeptCandidates([]);
    setPageView('idle');
    await fetchPlans();
  }

  // ── Subscription gate ──────────────────────────────────────────────────────

  const AUTOPILOT_TIERS = ['starter', 'professional', 'agency', 'freelancer'];
  const isGated =
    !tierLoading && subscriptionTier !== null && !AUTOPILOT_TIERS.includes(subscriptionTier);

  if (tierLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isGated) {
    return (
      <div className={compact ? 'p-2' : 'max-w-2xl mx-auto p-6'}>
        <div className={`text-center space-y-4 ${compact ? 'py-10' : 'py-16'}`}>
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Content Agent requires In-House or above</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            The Content Agent uses AI to generate content plans for you. Upgrade to unlock.
          </p>
          <Link href="/settings/billing">
            <Button className="bg-gradient-to-r from-blue-500 to-blue-950 hover:brightness-110 text-white mt-2">
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const creditsLow = creditInfo != null && creditInfo.max - creditInfo.used < RUN_CREDIT_ESTIMATE;

  const composer = (inModal: boolean) => (
    <RunBriefComposer
      clientId={clientId}
      value={brief}
      onChange={updateBrief}
      onSubmit={handleGenerate}
      error={generateError}
      blockedReason={creditsLow ? 'Not enough AI credits left this month to run the agent.' : null}
      autoFocus={inModal}
      footer={
        <p className="text-xs text-gray-400">
          The agent reads your media gallery, brand voice and style history, then drafts{' '}
          {brief.postCount} {brief.format === 'paid' ? 'ad variants' : 'posts'} to swipe through.
          {creditInfo && (
            <>
              {' '}Uses up to ~{RUN_CREDIT_ESTIMATE} credits ·{' '}
              <span className={creditsLow ? 'text-red-600' : 'text-gray-500'}>
                {Math.max(0, creditInfo.max - creditInfo.used)} / {creditInfo.max} left this month
              </span>
            </>
          )}
        </p>
      }
    />
  );

  const showRunButton = !loadingPlans && pageView !== 'generating' && pageView !== 'idle';

  return (
    <div className={compact ? 'space-y-6' : 'max-w-5xl mx-auto p-4 sm:p-6 space-y-6'}>
      {/* ── Header ── (compact: the host card already names the panel) */}
      <div className={`flex items-center justify-between flex-wrap gap-3 ${compact && !showRunButton ? 'hidden' : ''}`}>
        {compact ? (
          <p className="text-sm text-gray-500">
            Swipe to keep, then save to drafts or add to your calendar
          </p>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-600" />
              Content Agent
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI-generated content — swipe to keep, then save to drafts or add to your calendar
            </p>
          </div>
        )}

        {showRunButton && (
          <Button
            onClick={() => {
              setShowGenerateModal(true);
              setGenerateError(null);
            }}
            className="rounded-full pl-5 pr-4 font-semibold bg-gradient-to-r from-blue-500 to-blue-950 text-white hover:shadow-[0_6px_20px_rgba(30,58,138,0.4)] hover:brightness-110 transition-all"
          >
            Run Agent
            <Play className="h-4 w-4 ml-1.5 fill-current" />
          </Button>
        )}
      </div>

      {/* ── Run modal (from swipe/review — idle shows the composer inline) ── */}
      {showGenerateModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowGenerateModal(false)}
        >
          <div
            className="relative bg-[#fbfaf8] rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGenerateModal(false)}
              aria-label="Close"
              className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
            {composer(true)}
          </div>
        </div>
      )}

      {/* ── Loading plans on mount ── */}
      {loadingPlans && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loadingPlans && (
        <>
          {/* ── GENERATING ── */}
          {pageView === 'generating' && <AgentProgress startedAt={generateStartedAt} />}

          {/* ── IDLE: the run composer ── */}
          {pageView === 'idle' && !showGenerateModal && (
            <div className={compact ? 'space-y-4' : 'max-w-3xl mx-auto py-6 sm:py-10 space-y-4'}>
              {composer(false)}
              <CaptionPlaybook clientId={clientId} />
            </div>
          )}

          {/* ── SWIPE ── */}
          {pageView === 'swipe' && candidates.length > 0 && (
            <div className="space-y-3">
              {activePlan && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {formatDateRange(activePlan.plan_week_start, activePlan.plan_week_end)}
                  </span>
                  <StatusBadge status={activePlan.status} />
                </div>
              )}
              <SwipeReview
                planId={activePlan?.id ?? ''}
                clientId={clientId}
                candidates={candidates}
                onComplete={handleSwipeComplete}
                keyboardEnabled={active}
              />
            </div>
          )}

          {/* ── REVIEW: pick a destination for the kept posts ── */}
          {pageView === 'review' && activePlan && (() => {
            const organicKept = keptCandidates.filter(c => c.post_type !== 'paid_ad');
            const adKept = keptCandidates.filter(c => c.post_type === 'paid_ad');

            return (
              <div className="space-y-6">
                {organicKept.length > 0 ? (
                  <GeneratedPostsReview
                    candidates={organicKept}
                    saving={savingTo}
                    error={saveError}
                    onSaveToDrafts={handleSaveToDrafts}
                    onAddToCalendar={handleAddToCalendar}
                    onBack={() => setPageView('swipe')}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setPageView('swipe')}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      ← Back to review
                    </button>
                    <Button onClick={handleAdCopyOnlyDone}>Done</Button>
                  </div>
                )}
                <AdCopyPanel candidates={adKept} />
              </div>
            );
          })()}

          {/* ── DRAFTS ── */}
          {pageView !== 'swipe' && pageView !== 'review' && (
            <AutopilotDrafts
              clientId={clientId}
              drafts={drafts}
              loading={loadingDrafts}
              onDraftRemoved={handleDraftRemoved}
              onDraftUpdated={handleDraftUpdated}
              onEditDraft={handleEditDraft}
            />
          )}
        </>
      )}
    </div>
  );
}
