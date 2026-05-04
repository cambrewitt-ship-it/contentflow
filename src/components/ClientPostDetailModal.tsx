"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Calendar,
  ArrowUp,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SocialPreviewCard } from "@/components/SocialPreviewCard";
import logger from "@/lib/logger";

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

export interface ClientPostDetailItem {
  id: string;
  caption: string;
  image_url?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  approval_status?: string;
  platforms_scheduled?: string[];
  tags?: Array<{ id: string; name: string; color: string }>;
}

interface Props {
  post: ClientPostDetailItem;
  onClose: () => void;
  getAccessToken: () => string | null;
  authorName: string;
  accountName?: string;
  accountAvatarUrl?: string;
}

type PreviewPlatform = "facebook" | "instagram" | "twitter";

const PREVIEW_PLATFORMS: { id: PreviewPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "Twitter/X" },
];

function pickDefaultPlatform(platforms?: string[]): PreviewPlatform {
  if (!platforms?.length) return "instagram";
  const p = platforms[0].toLowerCase();
  if (p === "facebook") return "facebook";
  if (p === "twitter" || p === "x") return "twitter";
  return "instagram";
}

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

function PipelineSteps({ steps }: { steps: ApprovalStep[] }) {
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
        </span>
      ))}
    </div>
  );
}

export function ClientPostDetailModal({ post, onClose, getAccessToken, authorName, accountName, accountAvatarUrl }: Props) {
  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>(() =>
    pickDefaultPlatform(post.platforms_scheduled)
  );

  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchPipeline = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsLoadingPipeline(true);
    try {
      const res = await fetch(
        `/api/posts/${post.id}/approval-pipeline?post_type=calendar_scheduled`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setSteps(data.steps ?? []);
    } catch (err) {
      logger.error("Pipeline fetch error:", err);
    } finally {
      setIsLoadingPipeline(false);
    }
  }, [post.id, getAccessToken]);

  const fetchComments = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${post.id}/comments?post_type=calendar_scheduled`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } catch (err) {
      logger.error("Comments fetch error:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id, getAccessToken]);

  useEffect(() => {
    fetchPipeline();
    fetchComments();
  }, [fetchPipeline, fetchComments]);

  useEffect(() => {
    if (!isLoadingComments && comments.length > 0) scrollToBottom();
  }, [isLoadingComments, comments.length]);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    const token = getAccessToken();
    if (!token) return;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          author_name: authorName,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Calendar Post
            </span>
            {post.scheduled_date && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(post.scheduled_date + "T12:00:00").toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* LEFT — social preview */}
          <div className="lg:w-[45%] flex-shrink-0 bg-gray-50 flex flex-col lg:border-r border-b lg:border-b-0 border-gray-100 overflow-y-auto">
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
            <div className="flex-1 px-3 pb-4">
              <SocialPreviewCard
                platform={selectedPlatform}
                accountName={accountName || "Your Account"}
                accountAvatarUrl={accountAvatarUrl}
                caption={post.caption || ""}
                imageUrl={post.image_url ?? undefined}
                scheduledDate={post.scheduled_date ?? undefined}
                scheduledTime={post.scheduled_time ?? undefined}
              />
            </div>
          </div>

          {/* RIGHT — details + status + comments */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 space-y-5">

              {/* Tags */}
              {(post.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(post.tags ?? []).map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Caption */}
              {post.caption && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Caption
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {post.caption}
                  </p>
                </div>
              )}

              {/* Status + Pipeline */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Approval Status
                  </p>
                  <StatusBadge status={post.approval_status} />
                </div>
                {isLoadingPipeline ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : steps.length > 0 ? (
                  <PipelineSteps steps={steps} />
                ) : null}
              </div>

              {/* Comments */}
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
                      <p className="text-sm text-gray-400">No comments yet.</p>
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
                      className="resize-none text-sm pr-12 min-h-[80px]"
                      disabled={isPostingComment}
                    />
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
                  </div>
                  {commentError && (
                    <p className="text-xs text-red-600">{commentError}</p>
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
