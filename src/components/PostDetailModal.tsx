"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ApprovalPipeline, ApprovalStep } from "@/components/ApprovalPipeline";
import { PostCommentThread, PostComment } from "@/components/PostCommentThread";
import { PortalParty } from "@/contexts/PortalContext";
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";
import logger from "@/lib/logger";

interface PostDetailModalProps {
  post: {
    id: string;
    caption: string;
    image_url: string | null;
    scheduled_date: string | null;
    approval_status?: string;
    post_type_tag?: string | null;
    approval_steps?: ApprovalStep[];
  };
  postType: "scheduled" | "calendar_scheduled";
  portalToken: string;
  party: PortalParty | null;
  onClose: () => void;
  onStepActioned: () => void;
}

export function PostDetailModal({
  post,
  postType,
  portalToken,
  party,
  onClose,
  onStepActioned,
}: PostDetailModalProps) {
  const [steps, setSteps] = useState<ApprovalStep[]>(post.approval_steps ?? []);
  const [pipelineStatus, setPipelineStatus] = useState<string>("not_started");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  // Action state
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionComments, setActionComments] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | "changes_requested" | null>(null);

  // Which sections expanded
  const [showComments, setShowComments] = useState(false);

  const fetchPipeline = useCallback(async () => {
    setIsLoadingPipeline(true);
    try {
      const res = await fetch(
        `/api/posts/${post.id}/approval-pipeline?portal_token=${encodeURIComponent(portalToken)}&post_type=${postType}`
      );
      const data = await res.json();
      if (res.ok) {
        setSteps(data.steps ?? []);
        setPipelineStatus(data.pipelineStatus ?? "not_started");
      }
    } catch (err) {
      logger.error("Pipeline fetch error:", err);
    } finally {
      setIsLoadingPipeline(false);
    }
  }, [post.id, portalToken, postType]);

  const fetchComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${post.id}/comments?portal_token=${encodeURIComponent(portalToken)}&post_type=${postType}`
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } catch (err) {
      logger.error("Comments fetch error:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id, portalToken, postType]);

  useEffect(() => {
    fetchPipeline();
    fetchComments();
  }, [fetchPipeline, fetchComments]);

  // Is this party's step the active one?
  const activeStep = steps.find(s => s.status === "pending");
  const isMyTurn = party && activeStep?.party?.id === party.id;

  const handleAction = async (action: "approved" | "rejected" | "changes_requested") => {
    if (!party) return;

    if ((action === "rejected" || action === "changes_requested") && !actionComments.trim()) {
      setShowCommentInput(true);
      setPendingAction(action);
      return;
    }

    setIsActioning(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/portal/approve-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          post_id: post.id,
          post_type: postType,
          action,
          actioned_by: party.name,
          comments: actionComments.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to submit");
        return;
      }

      setActionSuccess(
        action === "approved"
          ? "Approved!"
          : action === "rejected"
          ? "Rejected"
          : "Changes requested"
      );

      setTimeout(() => {
        onStepActioned();
      }, 1200);
    } catch (err) {
      logger.error("Action error:", err);
      setActionError("Failed to submit. Please try again.");
    } finally {
      setIsActioning(false);
      setPendingAction(null);
      setShowCommentInput(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Post Detail</h2>
            {post.post_type_tag && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  post.post_type_tag === "pr_event"
                    ? "border-purple-300 text-purple-700 bg-purple-50"
                    : "border-sky-300 text-sky-700 bg-sky-50"
                }`}
              >
                {post.post_type_tag === "pr_event" ? "PR Event" : "Social"}
              </Badge>
            )}
            {post.scheduled_date && (
              <Badge variant="outline" className="text-xs">
                {new Date(post.scheduled_date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Media */}
          {post.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt="Post media"
              className="w-full max-h-72 object-contain rounded-lg border border-border bg-muted"
            />
          ) : (
            <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Caption */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Caption</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{post.caption}</p>
          </div>

          {/* Approval pipeline */}
          {isLoadingPipeline ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pipeline...
            </div>
          ) : (
            <ApprovalPipeline steps={steps} activePartyId={party?.id} />
          )}

          {/* Action buttons — shown only when it's this party's turn */}
          {isMyTurn && !actionSuccess && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm font-medium">It's your turn to review</p>

              {showCommentInput && (
                <div>
                  <Textarea
                    placeholder={
                      pendingAction === "changes_requested"
                        ? "Describe the changes needed..."
                        : "Optional: reason for rejection..."
                    }
                    value={actionComments}
                    onChange={e => setActionComments(e.target.value)}
                    className="text-sm resize-none min-h-[80px]"
                    autoFocus
                  />
                </div>
              )}

              {actionError && (
                <p className="text-xs text-destructive">{actionError}</p>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  onClick={() => handleAction("approved")}
                  disabled={isActioning}
                >
                  {isActioning && pendingAction !== "rejected" && pendingAction !== "changes_requested" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-50 gap-1.5"
                  onClick={() => {
                    setPendingAction("changes_requested");
                    setShowCommentInput(true);
                    if (showCommentInput && actionComments.trim()) {
                      handleAction("changes_requested");
                    }
                  }}
                  disabled={isActioning}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Request Changes
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400 text-red-700 hover:bg-red-50 gap-1.5"
                  onClick={() => {
                    setPendingAction("rejected");
                    setShowCommentInput(true);
                    if (showCommentInput && actionComments.trim()) {
                      handleAction("rejected");
                    }
                  }}
                  disabled={isActioning}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>

                {showCommentInput && pendingAction && actionComments.trim() && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(pendingAction)}
                    disabled={isActioning}
                  >
                    {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              {actionSuccess}
            </div>
          )}

          {/* Comments section */}
          <div>
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {comments.length}
                </Badge>
              )}
              <span className="ml-auto">
                {showComments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {showComments && (
              <div className="mt-4">
                {isLoadingComments ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading comments...
                  </div>
                ) : (
                  <PostCommentThread
                    postId={post.id}
                    postType={postType}
                    comments={comments}
                    portalToken={portalToken}
                    authorName={party?.name ?? "Portal User"}
                    onCommentAdded={comment => setComments(prev => [...prev, comment])}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
