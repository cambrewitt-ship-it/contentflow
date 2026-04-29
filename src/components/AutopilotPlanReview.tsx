'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  X,
  Pencil,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PhotoSwapDialog from '@/components/PhotoSwapDialog';

// ── Types ────────────────────────────────────────────────────────────────────

interface AutopilotPlan {
  id: string;
  plan_week_start: string;
  plan_week_end: string;
  ai_plan_summary: string | null;
  status: string;
  posts_planned: number;
  posts_approved: number;
}

interface PostWithMedia {
  id: string;
  caption: string | null;
  image_url: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  ai_reasoning: string | null;
  autopilot_status: string | null;
  media_gallery_id: string | null;
  platforms_scheduled: string[] | null;
  media_gallery_item: {
    id: string;
    media_url: string;
    ai_description: string | null;
    ai_tags: string[];
    ai_mood: string | null;
  } | null;
  [key: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  edited_and_approved: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  edited_and_approved: 'Edited ✓',
  draft: 'Draft',
};

const POST_TYPE_COLORS: Record<string, string> = {
  promotional: 'bg-orange-100 text-orange-700',
  engagement: 'bg-purple-100 text-purple-700',
  seasonal: 'bg-teal-100 text-teal-700',
  educational: 'bg-blue-100 text-blue-700',
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  linkedin: 'bg-indigo-100 text-indigo-700',
  tiktok: 'bg-slate-100 text-slate-700',
  threads: 'bg-gray-100 text-gray-700',
};

function formatDateHeader(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return d
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'UTC' };
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  clientId,
  planId,
  onStatusChange,
  onPostUpdate,
}: {
  post: PostWithMedia;
  clientId: string;
  planId: string;
  onStatusChange: (postId: string, status: string) => void;
  onPostUpdate: (postId: string, updates: Partial<PostWithMedia>) => void;
}) {
  const { getAccessToken } = useAuth();
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption || '');
  const [savingCaption, setSavingCaption] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editedTime, setEditedTime] = useState(
    post.scheduled_time?.substring(0, 5) || '12:00'
  );
  const [showReasoning, setShowReasoning] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // Keep local caption in sync when post updates from parent
  useEffect(() => {
    setEditedCaption(post.caption || '');
  }, [post.caption]);

  const patchPost = useCallback(
    async (updates: Record<string, unknown>) => {
      const token = getAccessToken();
      const res = await fetch('/api/calendar/scheduled', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: post.id, updates }),
      });
      return res.json();
    },
    [post.id, getAccessToken]
  );

  const handleApprove = async () => {
    setApprovingId('approve');
    try {
      const token = getAccessToken();
      await fetch(`/api/autopilot/plans/${planId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'approve', postIds: [post.id] }),
      });
      onStatusChange(post.id, 'approved');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    setApprovingId('reject');
    try {
      const token = getAccessToken();
      await fetch(`/api/autopilot/plans/${planId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reject', postIds: [post.id] }),
      });
      onStatusChange(post.id, 'rejected');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSaveCaption = async () => {
    setSavingCaption(true);
    try {
      await patchPost({
        caption: editedCaption,
        autopilot_status: 'edited_and_approved',
      });
      setIsEditingCaption(false);
      onPostUpdate(post.id, {
        caption: editedCaption,
        autopilot_status: 'edited_and_approved',
      });
    } finally {
      setSavingCaption(false);
    }
  };

  const handleSaveTime = async () => {
    await patchPost({ scheduled_time: `${editedTime}:00` });
    setIsEditingTime(false);
    onPostUpdate(post.id, { scheduled_time: `${editedTime}:00` });
  };

  const handleSwapPhoto = async (newMediaGalleryId: string) => {
    setSwapping(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/plans/${planId}/swap-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id, newMediaGalleryId }),
      });
      const data = await res.json();
      if (data.success && data.post) {
        onPostUpdate(post.id, {
          caption: data.post.caption,
          image_url: data.post.image_url,
          media_gallery_id: data.post.media_gallery_id,
          autopilot_status: data.post.autopilot_status,
        });
        setEditedCaption(data.post.caption || '');
        setSwapOpen(false);
      }
    } finally {
      setSwapping(false);
    }
  };

  const platforms = (post.platforms_scheduled as string[] | null) || ['instagram', 'facebook'];
  const postType = (post as Record<string, unknown>).post_type as string | undefined;
  const status = post.autopilot_status || 'draft';
  const isApproved = status === 'approved' || status === 'edited_and_approved';

  return (
    <>
      <div
        className={`border rounded-xl overflow-hidden bg-white transition-all ${
          isApproved ? 'border-green-200 shadow-sm shadow-green-50' : 'border-gray-200'
        }`}
      >
        {/* Card header */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 tracking-wide">
              {formatDateHeader(post.scheduled_date)}
            </span>
            {post.scheduled_time && (
              <span className="text-xs text-gray-500">· {formatTime(post.scheduled_time)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {platforms.map(p => (
              <span
                key={p}
                className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize ${
                  PLATFORM_COLORS[p] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {p}
              </span>
            ))}
            {postType && (
              <span
                className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize ${
                  POST_TYPE_COLORS[postType] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {postType}
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold rounded ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}
            >
              {STATUS_LABELS[status] || status}
            </span>
          </div>
        </div>

        {/* Card body */}
        <div className="flex gap-4 p-4">
          {/* Image */}
          {post.image_url && (
            <div className="flex-shrink-0 w-40 sm:w-52">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt="Post photo"
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: 280 }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Caption */}
            {isEditingCaption ? (
              <div className="space-y-2">
                <textarea
                  value={editedCaption}
                  onChange={e => setEditedCaption(e.target.value)}
                  className="w-full text-sm text-gray-800 p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={6}
                  disabled={savingCaption}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSaveCaption}
                    disabled={savingCaption}
                  >
                    {savingCaption ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Save & Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsEditingCaption(false);
                      setEditedCaption(post.caption || '');
                    }}
                    disabled={savingCaption}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {post.caption || <span className="italic text-gray-400">No caption</span>}
              </p>
            )}

            {/* Time edit */}
            {isEditingTime && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={editedTime}
                  onChange={e => setEditedTime(e.target.value)}
                  className="h-7 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveTime}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setIsEditingTime(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* AI Reasoning */}
            {post.ai_reasoning && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowReasoning(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  AI Reasoning
                  {showReasoning ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {showReasoning && (
                  <p className="mt-1 text-xs text-gray-400 italic leading-relaxed border-l-2 border-gray-100 pl-2">
                    {post.ai_reasoning}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={!!approvingId || isApproved}
              >
                {approvingId === 'approve' ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                {isApproved ? 'Approved' : 'Approve'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => setIsEditingCaption(v => !v)}
                disabled={!!approvingId}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => setSwapOpen(true)}
                disabled={!!approvingId || swapping}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Swap Photo
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-gray-600 border-gray-200 hover:bg-gray-50"
                onClick={() => setIsEditingTime(v => !v)}
                disabled={!!approvingId}
              >
                <Clock className="h-3 w-3 mr-1" />
                Change Time
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleReject}
                disabled={!!approvingId || status === 'rejected'}
              >
                {approvingId === 'reject' ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <X className="h-3 w-3 mr-1" />
                )}
                Reject
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PhotoSwapDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        clientId={clientId}
        currentMediaGalleryId={post.media_gallery_id}
        onPhotoSelected={handleSwapPhoto}
        isLoading={swapping}
      />
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AutopilotPlanReviewProps {
  planId: string;
  clientId: string;
  onPlanUpdated?: () => void;
}

export default function AutopilotPlanReview({
  planId,
  clientId,
  onPlanUpdated,
}: AutopilotPlanReviewProps) {
  const { getAccessToken } = useAuth();
  const [plan, setPlan] = useState<AutopilotPlan | null>(null);
  const [posts, setPosts] = useState<PostWithMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    published: number;
    failed: number;
  } | null>(null);

  const fetchPlan = useCallback(async () => {
    const token = getAccessToken();
    try {
      const res = await fetch(`/api/autopilot/plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
        setPosts(data.posts ?? []);
      } else {
        setError(data.error || 'Failed to load plan');
      }
    } catch {
      setError('Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, [planId, getAccessToken]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleStatusChange = (postId: string, newStatus: string) => {
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, autopilot_status: newStatus } : p))
    );
    onPlanUpdated?.();
  };

  const handlePostUpdate = (postId: string, updates: Partial<PostWithMedia>) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, ...updates } : p)));
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/plans/${planId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'approve_all' }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p =>
            p.autopilot_status === 'pending_approval' || p.autopilot_status === 'draft'
              ? { ...p, autopilot_status: 'approved' }
              : p
          )
        );
        if (data.plan) setPlan(data.plan);
        onPlanUpdated?.();
      }
    } finally {
      setApprovingAll(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishResult(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/plans/${planId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPublishResult({ published: data.published, failed: data.failed });
        if (data.plan) setPlan(data.plan);
        onPlanUpdated?.();
      } else {
        setError(data.error || 'Publish failed');
      }
    } finally {
      setPublishing(false);
    }
  };

  const approvedCount = posts.filter(
    p => p.autopilot_status === 'approved' || p.autopilot_status === 'edited_and_approved'
  ).length;
  const pendingCount = posts.filter(
    p => p.autopilot_status === 'pending_approval' || p.autopilot_status === 'draft'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Week of {formatWeekRange(plan.plan_week_start, plan.plan_week_end)}
            </h3>
            {plan.ai_plan_summary && (
              <p className="mt-1 text-sm text-gray-500 italic">{plan.ai_plan_summary}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>{plan.posts_planned} post{plan.posts_planned !== 1 ? 's' : ''} planned</span>
              <span>·</span>
              <span className="text-green-600">{approvedCount} approved</span>
              {pendingCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-yellow-600">{pendingCount} pending</span>
                </>
              )}
            </div>
          </div>

          {/* Approve all */}
          {pendingCount > 0 && (
            <Button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approvingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve All ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Publish result banner */}
      {publishResult && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          Published {publishResult.published} post{publishResult.published !== 1 ? 's' : ''}
          {publishResult.failed > 0 && ` · ${publishResult.failed} failed`}
        </div>
      )}

      {/* Post cards */}
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            clientId={clientId}
            planId={planId}
            onStatusChange={handleStatusChange}
            onPostUpdate={handlePostUpdate}
          />
        ))}
      </div>

      {/* Publish footer */}
      {approvedCount > 0 && !publishResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {approvedCount} post{approvedCount !== 1 ? 's' : ''} approved and ready to publish to social accounts.
          </p>
          <Button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {publishing
              ? 'Publishing…'
              : `Publish ${approvedCount} Approved Post${approvedCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
