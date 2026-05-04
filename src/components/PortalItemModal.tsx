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
  ArrowUp,
  Tag,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SocialPreviewCard } from "@/components/SocialPreviewCard";
import { PortalTagDropdown } from "@/components/PortalTagDropdown";
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
  tags?: Array<{ id: string; name: string; color: string }>;
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
  review_notes: string | null;
  created_at: string;
  target_date?: string | null;
  status?: string;
  tags?: Array<{ id: string; name: string; color: string }>;
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
  actioned_at?: string | null;
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
  onTagsChange?: (postId: string, tags: Array<{ id: string; name: string; color: string }>) => void;
  onDeleteUpload?: (uploadId: string) => void;
  brandName?: string;
  brandLogoUrl?: string;
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

function mapUploadStatus(status?: string): string {
  if (!status || status === "pending" || status === "unassigned") return "pending";
  if (status === "processing") return "pending";
  if (status === "completed" || status === "in_use" || status === "published") return "approved";
  if (status === "failed") return "rejected";
  return "pending";
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

export function PortalItemModal({ item, portalToken, party, onClose, onActioned, onTagsChange, onDeleteUpload, brandName, brandLogoUrl }: Props) {
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
  const [isLoadingComments, setIsLoadingComments] = useState(true);

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

  // Upload review notes (shown as update notifications)
  const [localReviewNotes] = useState<string | null>(
    isUpload ? (item.data as ModalUpload).review_notes : null
  );

  // Editable notes (uploads only) — compute initial value directly from item.data
  const initialNotes = isUpload
    ? (() => {
        const raw = (item.data as ModalUpload).notes;
        if (!raw) return "";
        return raw
          .split('\n')
          .filter(line => !/^\[.*?—.*?—.*?\]:/.test(line))
          .join('\n')
          .trim();
      })()
    : "";
  const [editedNotes, setEditedNotes] = useState<string>(initialNotes);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveError, setNotesSaveError] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesChanged = isUpload && editedNotes !== initialNotes;

  // Tags (posts and uploads)
  const [postTags, setPostTags] = useState<Array<{ id: string; name: string; color: string }>>(
    isPost ? (item.data as ModalPost).tags ?? [] : (item.data as ModalUpload).tags ?? []
  );
  const [isTagOpen, setIsTagOpen] = useState(false);
  const tagButtonRef = useRef<HTMLButtonElement>(null);

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

  const itemId = isPost ? (item.data as ModalPost).id : (item.data as ModalUpload).id;
  const commentPostType = isPost ? "calendar_scheduled" : "portal_upload";

  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${itemId}/comments?portal_token=${encodeURIComponent(
          portalToken
        )}&post_type=${commentPostType}`
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } catch (err) {
      logger.error("Comments fetch error:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [itemId, portalToken, commentPostType]);

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

  // ── Direct approval (portal token, no pipeline required) ────────────────

  const handleDirectApproval = async (status: "approved" | "rejected") => {
    if (!isPost) return;
    setIsActioning(true);
    setActionError(null);
    try {
      const res = await fetch("/api/portal/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portalToken,
          post_id: (item.data as ModalPost).id,
          post_type: "planner_scheduled",
          approval_status: status,
          client_comments: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to submit");
        return;
      }
      setActionDone(status === "approved" ? "Approved!" : "Rejected");
      setTimeout(() => {
        onActioned();
      }, 1500);
    } catch (err) {
      logger.error("Direct approval error:", err);
      setActionError("Failed to submit. Please try again.");
    } finally {
      setIsActioning(false);
    }
  };

  // ── Upload approval ─────────────────────────────────────────────────────

  const handleUploadApproval = async (action: "approved" | "rejected") => {
    if (!isUpload) return;
    setIsActioning(true);
    setActionError(null);
    try {
      const newStatus = action === "approved" ? "completed" : "failed";
      const res = await fetch("/api/portal/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portalToken,
          uploadId: (item.data as ModalUpload).id,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to submit");
        return;
      }
      setActionDone(action === "approved" ? "Approved!" : "Rejected");
      setTimeout(() => {
        onActioned();
      }, 1500);
    } catch (err) {
      logger.error("Upload approval error:", err);
      setActionError("Failed to submit. Please try again.");
    } finally {
      setIsActioning(false);
    }
  };

  // ── Tag toggle ───────────────────────────────────────────────────────────

  const handleTagToggle = async (tagId: string, tag: { id: string; name: string; color: string }, isSelected: boolean) => {
    const postId = isPost ? (item.data as ModalPost).id : (item.data as ModalUpload).id;
    if (isSelected) {
      const next = postTags.filter(t => t.id !== tagId);
      setPostTags(next);
      const res = await fetch(
        `/api/portal/post-tags?portal_token=${encodeURIComponent(portalToken)}&post_id=${postId}&tag_id=${tagId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setPostTags(prev => [...prev, tag]);
      } else {
        onTagsChange?.(postId, next);
      }
    } else {
      const next = [...postTags, tag];
      setPostTags(next);
      const res = await fetch("/api/portal/post-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_token: portalToken, post_id: postId, tag_id: tagId }),
      });
      if (!res.ok) {
        setPostTags(prev => prev.filter(t => t.id !== tagId));
      } else {
        onTagsChange?.(postId, next);
      }
    }
  };

  // ── Save upload notes ────────────────────────────────────────────────────

  const handleSaveNotes = async () => {
    if (!isUpload) return;
    setIsSavingNotes(true);
    setNotesSaveError(null);
    setNotesSaved(false);
    try {
      const res = await fetch("/api/portal/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portalToken,
          uploadId: (item.data as ModalUpload).id,
          notes: editedNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNotesSaveError(data.error ?? "Failed to save");
        return;
      }
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      setNotesSaveError("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // ── Post comment ─────────────────────────────────────────────────────────

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/posts/${itemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          author_name: party?.name ?? "Portal User",
          content: newComment.trim(),
          post_type: commentPostType,
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

  const rawCopyText = isPost
    ? (item.data as ModalPost).caption
    : (item.data as ModalUpload).notes;

  const copyText = rawCopyText
    ? rawCopyText
        .split('\n')
        .filter(line => !/^\[.*?—.*?—.*?\]:/.test(line))
        .join('\n')
        .trim() || null
    : rawCopyText;

  const dateStr = isPost
    ? (item.data as ModalPost).scheduled_date
    : (item.data as ModalUpload).target_date ?? (item.data as ModalUpload).created_at;

  const approvalStatus = isPost
    ? (item.data as ModalPost).approval_status
    : mapUploadStatus((item.data as ModalUpload).status);

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
          </div>
          <div className="flex items-center gap-1.5">
            {isUpload && (
              <>
                {(item.data as ModalUpload).file_url && (
                  <a
                    href={(item.data as ModalUpload).file_url}
                    download={(item.data as ModalUpload).file_name || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
                {onDeleteUpload && (
                  <button
                    type="button"
                    onClick={() => { onDeleteUpload((item.data as ModalUpload).id); onClose(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                    accountName={brandName || "Your Account"}
                    accountAvatarUrl={brandLogoUrl}
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

              {/* Tags */}
              <div className="relative">
                <div className="flex flex-wrap items-center gap-1.5">
                  {postTags.map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  <button
                    ref={tagButtonRef}
                    type="button"
                    onClick={() => setIsTagOpen(prev => !prev)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Tag className="w-3 h-3" />
                    Tags
                  </button>
                </div>
                {isTagOpen && (
                  <PortalTagDropdown
                    isOpen={isTagOpen}
                    onClose={() => setIsTagOpen(false)}
                    portalToken={portalToken}
                    postId={isPost ? (item.data as ModalPost).id : (item.data as ModalUpload).id}
                    selectedTagIds={postTags.map(t => t.id)}
                    onTagToggle={handleTagToggle}
                    position={
                      tagButtonRef.current
                        ? (() => {
                            const r = tagButtonRef.current!.getBoundingClientRect();
                            return { top: r.bottom, left: r.left };
                          })()
                        : undefined
                    }
                  />
                )}
              </div>

              {/* Copy / Caption */}
              {isPost ? (
                copyText && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Caption
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                      {copyText}
                    </p>
                  </div>
                )
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Notes / Copy
                    </p>
                    {notesSaved && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                  <Textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="Add notes or copy for this upload..."
                    className="text-sm min-h-[100px] resize-none"
                    disabled={isSavingNotes}
                  />
                  {notesSaveError && (
                    <p className="text-xs text-red-600 mt-1">{notesSaveError}</p>
                  )}
                  {notesChanged && (
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      {isSavingNotes ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                      ) : (
                        "Save notes"
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Review feedback notifications (uploads only) */}
              {isUpload && localReviewNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Review Feedback
                  </p>
                  <div className="space-y-2">
                    {localReviewNotes
                      .split(/\n\n/)
                      .filter(Boolean)
                      .map((entry, i) => {
                        const isApproved = entry.startsWith("approved:");
                        const displayText = isApproved
                          ? `Approved — ${entry.slice("approved:".length)}`
                          : entry;
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                              isApproved
                                ? "bg-green-50 border border-green-200 text-green-800"
                                : "bg-amber-50 border border-amber-200 text-amber-800"
                            }`}
                          >
                            {isApproved ? (
                              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                            )}
                            <span className="whitespace-pre-wrap">{displayText}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── STATUS (posts: pipeline steps; uploads: simple badge) ── */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </p>
                  <StatusBadge status={approvalStatus} />
                  {isPost && (() => {
                    const lastActioned = steps
                      .filter(s => s.actioned_at)
                      .sort((a, b) => new Date(b.actioned_at!).getTime() - new Date(a.actioned_at!).getTime())[0];
                    return lastActioned?.actioned_at ? (
                      <span className="text-[10px] text-gray-400">
                        {new Date(lastActioned.actioned_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : null;
                  })()}
                </div>
                {isPost && (
                  isLoadingPipeline ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : steps.length > 0 ? (
                    <PipelineSteps steps={steps} myPartyId={party?.id} />
                  ) : null
                )}
              </div>

              {/* ── COMMENTS ── */}
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
                  <div className="space-y-1.5">
                    <div className="relative">
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
                        className="resize-none text-sm pr-12 min-h-[96px] pb-12"
                        disabled={isPostingComment}
                      />
                      {/* Send button — top right */}
                      <button
                        onClick={handlePostComment}
                        disabled={isPostingComment || !newComment.trim()}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {isPostingComment ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {/* Approve / Reject buttons — bottom right */}
                      {!actionDone && (
                        <div className="absolute bottom-2 right-2 flex gap-1.5">
                          <button
                            onClick={() => isPost ? handleDirectApproval("approved") : handleUploadApproval("approved")}
                            disabled={isActioning}
                            className="h-8 rounded-full bg-green-600 text-white flex items-center justify-center gap-1.5 px-3 hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => isPost ? handleDirectApproval("rejected") : handleUploadApproval("rejected")}
                            disabled={isActioning}
                            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                      {actionDone && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {actionDone}
                        </div>
                      )}
                    </div>
                    {(commentError || actionError) && (
                      <p className="text-xs text-red-600">{commentError || actionError}</p>
                    )}
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
