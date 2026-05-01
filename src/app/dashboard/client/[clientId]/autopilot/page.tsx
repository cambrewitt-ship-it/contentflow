'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SwipeReview from '@/components/SwipeReview';
import CalendarConfirm from '@/components/CalendarConfirm';
import {
  Loader2,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Lock,
  PartyPopper,
  Heart,
  X,
  ImageIcon,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import type { AutopilotPlan, AutopilotCandidate } from '@/types/autopilot';
import { formatDateRange } from '@/lib/dateUtils';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  generating: {
    label: 'Generating',
    color: 'bg-blue-100 text-blue-700',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
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

// ── Page component ────────────────────────────────────────────────────────────

type PageView = 'idle' | 'generating' | 'swipe' | 'confirm' | 'published';

export default function AutopilotPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { getAccessToken, user } = useAuth();

  // Subscription gate
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState<{ max: number; used: number } | null>(null);

  // Plan / candidate data
  const [plans, setPlans] = useState<AutopilotPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [activePlan, setActivePlan] = useState<AutopilotPlan | null>(null);
  const [candidates, setCandidates] = useState<AutopilotCandidate[]>([]);
  const [keptCandidates, setKeptCandidates] = useState<AutopilotCandidate[]>([]);

  // Page flow
  const [pageView, setPageView] = useState<PageView>('idle');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // History expand
  const [expandedHistoryPlanId, setExpandedHistoryPlanId] = useState<string | null>(null);
  const [historyPlanCandidates, setHistoryPlanCandidates] = useState<Record<string, AutopilotCandidate[]>>({});
  const [loadingHistoryPlanId, setLoadingHistoryPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

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

  // ── Determine view from plan state ─────────────────────────────────────────

  const applyPlanState = useCallback(
    async (plan: AutopilotPlan, existingCandidates?: AutopilotCandidate[]) => {
      setActivePlan(plan);
      const isV2 = plan.generation_version === 'v2';

      if (plan.status === 'published') {
        setPageView('published');
        return;
      }

      if (!isV2) {
        // v1 plan — fall back to idle so user can generate a new v2 plan
        setPageView('idle');
        return;
      }

      const planCandidates = existingCandidates ?? (await fetchCandidates(plan.id));
      setCandidates(planCandidates);

      if (plan.status === 'approved') {
        // Already confirmed — show confirm view (for publish option)
        const kept = planCandidates.filter(c => c.decision === 'kept');
        setKeptCandidates(kept);
        setPageView('confirm');
        return;
      }

      if (plan.status === 'pending_approval') {
        const hasPending = planCandidates.some(c => c.decision === 'pending');
        if (hasPending) {
          setPageView('swipe');
        } else {
          const kept = planCandidates.filter(c => c.decision === 'kept');
          setKeptCandidates(kept);
          setPageView('confirm');
        }
      }
    },
    [fetchCandidates]
  );

  // ── Fetch all plans ────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/autopilot/plans?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const sorted: AutopilotPlan[] = data.plans ?? [];
        setPlans(sorted);

        // Auto-activate the most recent non-failed plan
        const active = sorted.find(p => p.status !== 'failed');
        if (active) {
          await applyPlanState(active);
        } else {
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
    fetchPlans().finally(() => {
      fetchRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ── Generate plan ──────────────────────────────────────────────────────────

  async function handleGenerate() {
    setShowGenerateModal(false);
    setPageView('generating');
    setGenerateError(null);
    const token = getAccessToken();
    try {
      const res = await fetch('/api/autopilot/generate-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, force: true }),
      });
      const data = await res.json();

      if (!data.success) {
        setGenerateError(data.error || 'Failed to generate plan');
        setPageView('idle');
        setShowGenerateModal(true);
        return;
      }

      // Success — use the candidates returned directly (no extra fetch needed)
      const newPlan: AutopilotPlan = data.plan;
      const newCandidates: AutopilotCandidate[] = data.candidates ?? [];

      setShowGenerateModal(false);
      await fetchPlans(); // refresh history list

      // Go directly to swipe with the freshly generated candidates
      setActivePlan(newPlan);
      setCandidates(newCandidates);
      setPageView('swipe');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Unexpected error');
      setPageView('idle');
      setShowGenerateModal(true);
    }
  }

  // ── Swipe complete ─────────────────────────────────────────────────────────

  function handleSwipeComplete(keptCount: number, kept: AutopilotCandidate[]) {
    setKeptCandidates(kept);
    setPageView('confirm');
  }

  // ── Confirm (publish) complete ─────────────────────────────────────────────

  function handleConfirmComplete() {
    setPageView('published');
    fetchPlans(); // refresh history
  }

  // ── History plans (all except the currently active one) ────────────────────

  const historyPlans = plans.filter(p => p.id !== activePlan?.id);

  async function toggleHistoryPlan(plan: AutopilotPlan) {
    if (expandedHistoryPlanId === plan.id) {
      setExpandedHistoryPlanId(null);
      return;
    }
    if (!historyPlanCandidates[plan.id]) {
      setLoadingHistoryPlanId(plan.id);
      const fetched = await fetchCandidates(plan.id);
      setHistoryPlanCandidates(prev => ({ ...prev, [plan.id]: fetched }));
      setLoadingHistoryPlanId(null);
    }
    setExpandedHistoryPlanId(plan.id);
  }

  async function handleDeletePlan(planId: string) {
    const token = getAccessToken();
    setDeletingPlanId(planId);
    try {
      await fetch(`/api/autopilot/plans/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      setExpandedHistoryPlanId(null);
      setHistoryPlanCandidates(prev => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      await fetchPlans();
    } finally {
      setDeletingPlanId(null);
    }
  }

  // ── Subscription gate ──────────────────────────────────────────────────────

  const AUTOPILOT_TIERS = ['professional', 'agency', 'freelancer'];
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
            <Lock className="h-8 w-8 text-purple-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Autopilot requires Freelancer or above</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Autopilot uses AI to generate and schedule content plans automatically. Upgrade to unlock.
          </p>
          <Link href="/settings/billing">
            <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white mt-2">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Autopilot
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-generated content — swipe to keep, then publish
          </p>
        </div>

        {pageView !== 'generating' && (
          <Button
            onClick={() => {
              setShowGenerateModal(true);
              setGenerateError(null);
            }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Generate Plan
          </Button>
        )}
      </div>

      {/* ── Generate modal ── */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 rounded-full p-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Generate Content Plan</h2>
                <p className="text-xs text-gray-500">12 candidates · swipe to pick your favourites</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Autopilot will analyse your media gallery, brand voice, and style preferences to generate
              12 post candidates for you to swipe through.
            </p>

            {creditInfo && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">AI credits used</span>
                  <span className="font-medium text-gray-800">~13 credits</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Remaining this month</span>
                  <span className={`text-xs font-medium ${creditInfo.max - creditInfo.used < 13 ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.max(0, creditInfo.max - creditInfo.used)} / {creditInfo.max}
                  </span>
                </div>
              </div>
            )}

{generateError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {generateError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleGenerate()}
                disabled={creditInfo != null && creditInfo.max - creditInfo.used < 13}
                className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                title={creditInfo != null && creditInfo.max - creditInfo.used < 13 ? 'Insufficient AI credits' : undefined}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate
              </Button>
            </div>
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
          {pageView === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-purple-400" />
                </div>
                <Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-purple-300" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-700">Generating 12 content candidates…</p>
                <p className="text-sm text-gray-400 mt-1">This takes 30–60 seconds</p>
              </div>
              <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          )}

          {/* ── IDLE / NO PLANS ── */}
          {pageView === 'idle' && !showGenerateModal && (
            <div className="text-center py-16 space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-purple-300" />
              </div>
              <h3 className="text-base font-medium text-gray-700">No plans yet</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Click "Generate Plan" and AI will create 12 post candidates for you to swipe through.
              </p>
              <Button
                onClick={() => {
                  setShowGenerateModal(true);
                  setGenerateError(null);
                }}
                className="mt-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate Plan
              </Button>
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
              />
            </div>
          )}

          {/* ── CONFIRM ── */}
          {pageView === 'confirm' && activePlan && (
            <CalendarConfirm
              planId={activePlan.id}
              clientId={clientId}
              keptCandidates={keptCandidates}
              planWeekStart={activePlan.plan_week_start}
              onConfirm={handleConfirmComplete}
              onBack={() => setPageView('swipe')}
            />
          )}

          {/* ── PUBLISHED ── */}
          {pageView === 'published' && (
            <div className="text-center py-12 space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Your posts are scheduled! 🎉</h3>
              <p className="text-sm text-gray-500">
                Head to your calendar to see them, or generate a new plan for next week.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href={`/dashboard/client/${clientId}/calendar`}>
                  <Button variant="outline">
                    <CalendarDays className="h-4 w-4 mr-1.5" />
                    View Calendar
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setShowGenerateModal(true);
                    setGenerateError(null);
                    setExistingPlanConflict(null);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Generate Next Week
                </Button>
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {historyPlans.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Previous Plans
              </h2>

              {/* Thumbnail row */}
              <div className="flex flex-wrap gap-3">
                {historyPlans.map(plan => {
                  const isExpanded = expandedHistoryPlanId === plan.id;
                  const isLoading = loadingHistoryPlanId === plan.id;
                  const planCandidates = historyPlanCandidates[plan.id] ?? [];
                  const kept = planCandidates.filter(c => c.decision === 'kept');
                  const skipped = planCandidates.filter(c => c.decision === 'skipped');
                  // Up to 3 images for the stack (back → front)
                  const stackUrls = planCandidates.slice(0, 3).map(c => c.media_url);

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => toggleHistoryPlan(plan)}
                      className={`relative flex-shrink-0 w-24 h-24 rounded-xl focus:outline-none group transition-transform hover:-translate-y-0.5 ${isExpanded ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
                      title={formatDateRange(plan.plan_week_start, plan.plan_week_end)}
                    >
                      {/* Photo stack — back to front */}
                      {isLoading ? (
                        <div className="absolute inset-0 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                        </div>
                      ) : stackUrls.length === 0 ? (
                        <>
                          <div className="absolute inset-0 rounded-xl bg-gray-200 rotate-6 shadow-sm" />
                          <div className="absolute inset-0 rounded-xl bg-gray-100 rotate-3 shadow-sm" />
                          <div className="absolute inset-0 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        </>
                      ) : (
                        <>
                          {stackUrls[2] && (
                            <img
                              src={stackUrls[2]}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover rounded-xl rotate-6 shadow-sm"
                            />
                          )}
                          {stackUrls[1] && (
                            <img
                              src={stackUrls[1]}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover rounded-xl rotate-3 shadow-sm"
                            />
                          )}
                          <img
                            src={stackUrls[0]}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover rounded-xl shadow-md"
                          />
                        </>
                      )}

                      {/* Date label on hover */}
                      <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-white text-[9px] leading-tight font-medium truncate">
                          {formatDateRange(plan.plan_week_start, plan.plan_week_end)}
                        </p>
                      </div>

                      {/* Status dot */}
                      <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-1 ring-white ${
                        plan.status === 'published' ? 'bg-green-500' :
                        plan.status === 'approved' || plan.status === 'partially_approved' ? 'bg-blue-500' :
                        plan.status === 'pending_approval' ? 'bg-amber-400' :
                        plan.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* Expanded detail panel — shown below the row */}
              {expandedHistoryPlanId && (() => {
                const plan = historyPlans.find(p => p.id === expandedHistoryPlanId);
                if (!plan) return null;
                const isLoading = loadingHistoryPlanId === expandedHistoryPlanId;
                const planCandidates = historyPlanCandidates[expandedHistoryPlanId] ?? [];
                const kept = planCandidates.filter(c => c.decision === 'kept');
                const skipped = planCandidates.filter(c => c.decision === 'skipped');

                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDateRange(plan.plan_week_start, plan.plan_week_end)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {plan.candidates_generated != null
                            ? `${plan.candidates_liked ?? 0} kept · ${plan.candidates_skipped ?? 0} skipped`
                            : `${plan.posts_planned} posts`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={plan.status} />
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.id)}
                          disabled={deletingPlanId === plan.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete plan"
                        >
                          {deletingPlanId === plan.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <>
                        {kept.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                              <Heart className="h-3.5 w-3.5" />
                              Kept ({kept.length})
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {kept.map(c => (
                                <div key={c.id} className="group relative rounded-lg overflow-hidden aspect-square bg-gray-100">
                                  <img src={c.media_url} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end p-1 opacity-0 group-hover:opacity-100">
                                    <p className="text-white text-[9px] leading-tight line-clamp-3">{c.caption}</p>
                                  </div>
                                  <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                    <Heart className="h-2 w-2 text-white fill-white" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {skipped.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                              <X className="h-3.5 w-3.5" />
                              Skipped ({skipped.length})
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {skipped.map(c => (
                                <div key={c.id} className="group relative rounded-lg overflow-hidden aspect-square bg-gray-100">
                                  <img src={c.media_url} alt="" className="w-full h-full object-cover grayscale opacity-50" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end p-1 opacity-0 group-hover:opacity-100">
                                    <p className="text-white text-[9px] leading-tight line-clamp-3">{c.caption}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {kept.length === 0 && skipped.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-4">No decisions recorded yet.</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
