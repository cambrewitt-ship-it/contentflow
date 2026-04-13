"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Film,
  FileText,
  Calendar,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SocialPreviewCard } from "@/components/SocialPreviewCard";
import { PortalParty } from "@/contexts/PortalContext";
import logger from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalPost {
  id: string;
  caption: string;
  image_url?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  approval_status?: string;
  approval_steps?: ApprovalStep[];
  platforms_scheduled?: string[];
}

type PreviewPlatform = "facebook" | "instagram" | "twitter" | "linkedin" | "tiktok" | "youtube" | "threads";

const PREVIEW_PLATFORMS: { id: PreviewPlatform; label: string; color: string }[] = [
  { id: "instagram", label: "Instagram", color: "from-purple-500 to-pink-500" },
  { id: "facebook",  label: "Facebook",  color: "bg-blue-600" },
  { id: "twitter",   label: "Twitter/X", color: "bg-sky-400" },
];

function pickDefaultPlatform(platforms?: string[]): PreviewPlatform {
  if (!platforms?.length) return "instagram";
  const p = platforms[0].toLowerCase();
  if (p === "facebook") return "facebook";
  if (p === "twitter" || p === "x") return "twitter";
  if (p === "linkedin") return "linkedin";
  if (p === "tiktok") return "tiktok";
  return "instagram";
}

export interface ModalUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  created_at: string;
  target_date?: string | null;
}

export type ModalItem =
  | { type: "post"; data: ModalPost }
  | { type: "upload"; data: ModalUpload };

interface ApprovalStep {
  id: string;
  step_order: number;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  party: { id: string; name: string; color: string | null } | null;
  actioned_by?: string | null;
  comments?: string | null;
}

interface Comment {
  id: string;
  author_name: string;
  author_type: "agency" | "portal_party";
  content: string;
  created_at: string;
  party: { id: string; name: string; role: string; color: string | null } | null;
}

interface Props {
  item: ModalItem;
  portalToken: string;
  party: PortalParty | null;
  onClose: () => void;
  onActioned: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }
  if (status === "needs_attention" || status === "changes_requested") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle className="w-3 h-3" /> Needs Changes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}

function PipelineSteps({
  steps,
  myPartyId,
}: {
  steps: ApprovalStep[];
  myPartyId?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <span
          key={step.id}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
            step.status === "approved"
              ? "bg-green-50 border-green-200 text-green-700"
              : step.status === "rejected"
              ? "bg-red-50 border-red-200 text-red-700"
              : step.status === "changes_requested"
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : step.party?.id === myPartyId
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-gray-50 border-gray-200 text-gray-500"
          }`}
        >
          {step.status === "approved"
            ? "✓"
            : step.status === "rejected"
            ? "✗"
            : step.status === "changes_requested"
            ? "↩"
            : "·"}{" "}
          {step.party?.name ?? `Step ${step.step_order}`}
          {step.party?.id === myPartyId && step.status === "pending" && (
            <span className="ml-0.5 font-semibold text-indigo-600">← you</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PortalItemModal({ item, portalToken, party, onClose, onActioned }: Props) {
  const isPost = item.type === "post";
  const isUpload = item.type === "upload";

  // Social preview platform selector
  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>(() =>
    isPost ? pickDefaultPlatform((item.data as ModalPost).platforms_scheduled) : "instagram"
  );

  // Post-specific state
  const [steps, setSteps] = useState<ApprovalStep[]>(
    isPost ? (item.data as ModalPost).approval_steps ?? [] : []
  );
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(isPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(isPost);

  // Action state
  const [isActioning, setIsActioning] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "approved" | "rejected" | "changes_requested" | null
  >(null);
  const [actionComment, setActionComment] = useState("");

  // Comment composer
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Upload feedback state (for queue items)
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<string | null>(null);

  // Scroll comments into view on load
  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchPipeline = useCallback(async () => {
    if (!isPost) return;
    const postId = (item.data as ModalPost).id;
    setIsLoadingPipeline(true);
    try {
      const res = await fetch(
        `/api/posts/${postId}/approval-pipeline?portal_token=${encodeURIComponent(
          portalToken
        )}&post_type=calendar_scheduled`
      );
      const data = await res.json();
      if (res.ok) setSteps(data.steps ?? []);
    } catch (err) {
      logger.error("Pipeline fetch error:", err);
    } finally {
      setIsLoadingPipeline(false);
    }
  }, [isPost, item.data, portalToken]);

  const fetchComments = useCallback(async () => {
    if (!isPost) return;
    const postId = (item.data as ModalPost).id;
    setIsLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${postId}/comments?portal_token=${encodeURIComponent(
          portalToken
        )}&post_type=calendar_scheduled`
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } catch (err) {
      logger.error("Comments fetch error:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [isPost, item.data, portalToken]);

  useEffect(() => {
    fetchPipeline();
    fetchComments();
  }, [fetchPipeline, fetchComments]);

  useEffect(() => {
    if (!isLoadingComments && comments.length > 0) scrollToBottom();
  }, [isLoadingComments, comments.length]);

  // ── Approval actions (posts) ─────────────────────────────────────────────

  const activeStep = steps.find((s) => s.status === "pending");
  const isMyTurn = !!(party && activeStep?.party?.id === party.id);

  const handlePostAction = async (
    action: "approved" | "rejected" | "changes_requested"
  ) => {
    if (!party || !isPost) return;
    if (
      (action === "rejected" || action === "changes_requested") &&
      !actionComment.trim()
    ) {
      setPendingAction(action);
      return;
    }
    setIsActioning(true);
    setActionError(null);
    try {
      const res = await fetch("/api/portal/approve-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          post_id: (item.data as ModalPost).id,
          post_type: "calendar_scheduled",
          action,
          actioned_by: party.name,
          comments: actionComment.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to submit");
        return;
      }
      setActionDone(
        action === "approved"
          ? "Approved!"
          : action === "rejected"
          ? "Rejected"
          : "Changes requested"
      );
      setTimeout(() => {
        onActioned();
      }, 1500);
    } catch (err) {
      logger.error("Action error:", err);
      setActionError("Failed to submit. Please try again.");
    } finally {
      setIsActioning(false);
      setPendingAction(null);
    }
  };

  // ── Upload feedback ──────────────────────────────────────────────────────

  const handleUploadFeedback = async (approved: boolean) => {
    if (!isUpload) return;
    const upload = item.data as ModalUpload;
    setIsSubmittingFeedback(true);
    try {
      const timestamp = new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const partyLabel = party?.name ?? "Reviewer";
      const line = approved
        ? `[${partyLabel} — Approved ✓ — ${timestamp}]`
        : `[${partyLabel} — Changes Requested — ${timestamp}]: ${uploadFeedback.trim()}`;

      const existingNotes = upload.notes ?? "";
      const newNotes = existingNotes ? `${existingNotes}\n\n${line}` : line;

      // approved  → 'completed'  (Kanban: Approved column)
      // changes   → 'processing' (Kanban: In Review column)
      const newStatus = approved ? "completed" : "processing";

      const res = await fetch("/api/portal/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portalToken,
          uploadId: upload.id,
          notes: newNotes,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setFeedbackDone(approved ? "Approved!" : "Changes requested");
      setUploadFeedback("");
      setTimeout(() => {
        onActioned();
      }, 1500);
    } catch (err) {
      logger.error("Upload feedback error:", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // ── Post comment ─────────────────────────────────────────────────────────

  const handlePostComment = async () => {
    if (!newComment.trim() || !isPost) return;
    const postId = (item.data as ModalPost).id;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          author_name: party?.name ?? "Portal User",
          content: newComment.trim(),
          post_type: "calendar_scheduled",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error ?? "Failed to post");
        return;
      }
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
      setTimeout(scrollToBottom, 100);
    } catch {
      setCommentError("Failed to post comment");
    } finally {
      setIsPostingComment(false);
    }
  };

  // ── Close on escape ──────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Derived values ───────────────────────────────────────────────────────

  const imageUrl = isPost
    ? (item.data as ModalPost).image_url
    : (item.data as ModalUpload).file_url;

  const isImageFile = isPost
    ? !!imageUrl
    : (item.data as ModalUpload).file_type?.startsWith("image/");

  const isVideoFile = isUpload && (item.data as ModalUpload).file_type?.startsWith("video/");

  const title = isPost ? "Post" : (item.data as ModalUpload).file_name;

  const copyText = isPost
    ? (item.data as ModalPost).caption
    : (item.data as ModalUpload).notes;

  const dateStr = isPost
    ? (item.data as ModalPost).scheduled_date
    : (item.data as ModalUpload).target_date ?? (item.data as ModalUpload).created_at;

  const approvalStatus = isPost ? (item.data as ModalPost).approval_status : undefined;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {isPost ? "Calendar Post" : "Queue Item"}
            </span>
            {dateStr && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(dateStr).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            <StatusBadge status={approvalStatus} />
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* LEFT — social preview (posts) or raw media (uploads) */}
          <div className="lg:w-[45%] flex-shrink-0 bg-gray-50 flex flex-col lg:border-r border-b lg:border-b-0 border-gray-100 overflow-y-auto">

            {/* Show social preview for posts AND image uploads; fallback for video/file */}
            {(isPost || isImageFile) ? (
              <>
                {/* Platform switcher */}
                <div className="flex items-center gap-1 px-4 pt-4 pb-2 flex-shrink-0">
                  {PREVIEW_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedPlatform === p.id
                          ? "bg-white shadow-sm text-gray-900 ring-1 ring-gray-200"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Social preview */}
                <div className="flex-1 px-3 pb-4">
                  <SocialPreviewCard
                    platform={selectedPlatform}
                    accountName="Your Account"
                    caption={
                      isPost
                        ? (item.data as ModalPost).caption || ""
                        : (item.data as ModalUpload).notes || ""
                    }
                    imageUrl={imageUrl ?? undefined}
                    scheduledDate={
                      isPost
                        ? (item.data as ModalPost).scheduled_date ?? undefined
                        : undefined
                    }
                    scheduledTime={
                      isPost
                        ? (item.data as ModalPost).scheduled_time ?? undefined
                        : undefined
                    }
                  />
                </div>
              </>
            ) : isVideoFile ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center">
                    <Film className="w-10 h-10" />
                  </div>
                  <span className="text-sm font-medium">Video file</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center">
                    <FileText className="w-10 h-10" />
                  </div>
                  <span className="text-sm font-medium">No preview</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — details + actions + comments */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 space-y-5">

              {/* Title */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 break-words">{title}</h2>
              </div>

              {/* Copy / Caption */}
              {copyText && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    {isPost ? "Caption" : "Notes / Copy"}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {copyText}
                  </p>
                </div>
              )}

              {/* ── APPROVAL SECTION (posts) ── */}
              {isPost && (
                <div className="space-y-4">
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Approval
                    </p>

                    {isLoadingPipeline ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    ) : steps.length > 0 ? (
                      <PipelineSteps steps={steps} myPartyId={party?.id} />
                    ) : null}

                    {/* Action buttons */}
                    {isMyTurn && !actionDone && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">
                          It&apos;s your turn to review
                        </p>

                        {/* Comment input (required for reject/changes) */}
                        {pendingAction && (
                          <Textarea
                            placeholder={
                              pendingAction === "changes_requested"
                                ? "Describe the changes needed..."
                                : "Reason for rejection..."
                            }
                            value={actionComment}
                            onChange={(e) => setActionComment(e.target.value)}
                            className="text-sm resize-none min-h-[80px] border-amber-200 focus:border-amber-400"
                            autoFocus
                          />
                        )}

                        {actionError && (
                          <p className="text-xs text-red-600">{actionError}</p>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5 h-9"
                            onClick={() => handlePostAction("approved")}
                            disabled={isActioning}
                          >
                            {isActioning && !pendingAction ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5 h-9"
                            onClick={() => {
                              if (pendingAction === "changes_requested" && actionComment.trim()) {
                                handlePostAction("changes_requested");
                              } else {
                                setPendingAction("changes_requested");
                              }
                            }}
                            disabled={isActioning}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {pendingAction === "changes_requested" && actionComment.trim()
                              ? "Confirm"
                              : "Request Changes"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5 h-9 px-3"
                            onClick={() => {
                              if (pendingAction === "rejected" && actionComment.trim()) {
                                handlePostAction("rejected");
                              } else {
                                setPendingAction("rejected");
                              }
                            }}
                            disabled={isActioning}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {actionDone && (
                      <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        {actionDone}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── APPROVAL SECTION (uploads) ── */}
              {isUpload && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Review
                  </p>

                  {feedbackDone ? (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      {feedbackDone}
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={uploadFeedback}
                        onChange={(e) => setUploadFeedback(e.target.value)}
                        placeholder="Add feedback or notes (required if requesting changes)..."
                        className="text-sm resize-none min-h-[80px]"
                        disabled={isSubmittingFeedback}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5 h-9"
                          onClick={() => handleUploadFeedback(true)}
                          disabled={isSubmittingFeedback}
                        >
                          {isSubmittingFeedback ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5 h-9"
                          onClick={() => handleUploadFeedback(false)}
                          disabled={isSubmittingFeedback || !uploadFeedback.trim()}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Request Changes
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── COMMENTS (posts only) ── */}
              {isPost && (
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Comments
                      {comments.length > 0 && (
                        <span className="ml-1.5 bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-[10px]">
                          {comments.length}
                        </span>
                      )}
                    </p>
                  </div>

                  {isLoadingComments ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading comments...
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {comments.length === 0 && (
                        <p className="text-sm text-gray-400">No comments yet — be the first!</p>
                      )}
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          <div
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{
                              backgroundColor:
                                c.author_type === "agency"
                                  ? "#1e293b"
                                  : (c.party?.color ?? "#6366f1"),
                            }}
                          >
                            {c.author_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-800">
                                {c.author_name}
                              </span>
                              {c.party && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                  style={{ backgroundColor: c.party.color ?? "#6366f1" }}
                                >
                                  {c.party.name}
                                </span>
                              )}
                              {c.author_type === "agency" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white font-medium">
                                  Agency
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">
                                {new Date(c.created_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={commentsEndRef} />
                    </div>
                  )}

                  {/* Comment composer */}
                  <div className="flex gap-2 items-end">
                    {party && (
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                        style={{ backgroundColor: party.color ?? "#6366f1" }}
                      >
                        {party.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handlePostComment();
                          }
                        }}
                        placeholder="Add a comment... (⌘↵ to send)"
                        className="resize-none text-sm min-h-[72px]"
                        disabled={isPostingComment}
                      />
                      {commentError && (
                        <p className="text-xs text-red-600">{commentError}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handlePostComment}
                      disabled={isPostingComment || !newComment.trim()}
                      className="flex-shrink-0 h-9 px-3 gap-1.5"
                    >
                      {isPostingComment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
