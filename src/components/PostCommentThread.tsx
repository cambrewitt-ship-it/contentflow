"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { usePortal } from "@/contexts/PortalContext";
import {
  CommentThreadList,
  MentionTextarea,
  ReplyingTo,
  useCommentComposer,
  useMentionables,
  type ThreadComment,
} from "@/components/comments";

export type PostComment = ThreadComment;

interface PostCommentThreadProps {
  postId: string;
  postType: "scheduled" | "calendar_scheduled";
  comments: PostComment[];
  portalToken: string;
  onCommentAdded: (comment: PostComment) => void;
}

export function PostCommentThread({
  postId,
  postType,
  comments,
  portalToken,
  onCommentAdded,
}: PostCommentThreadProps) {
  const { setMember } = usePortal();
  const mentionables = useMentionables({ portalToken });
  const composer = useCommentComposer(mentionables);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!composer.draft.text.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          ...composer.payload(),
          post_type: postType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Signed out on this device (e.g. session expired) — back to the sign-in screen
        if (data.code === "not_signed_in") setMember(null);
        setError(data.error ?? "Failed to post comment");
        return;
      }

      onCommentAdded(data.comment);
      composer.reset();
    } catch {
      setError("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Comments
      </p>

      {/* Comment list */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <CommentThreadList comments={comments} onReply={composer.startReply} />
      </div>

      {/* Composer */}
      <div className="space-y-2">
        {composer.replyTo && (
          <ReplyingTo name={composer.replyTo.authorName} onCancel={composer.cancelReply} />
        )}
        <div className="relative">
          <MentionTextarea
            ref={composer.composerRef}
            draft={composer.draft}
            mentionables={mentionables}
            placeholder="Add a comment... type @ to tag someone"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="min-h-[80px] resize-none text-sm"
            disabled={isSubmitting}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !composer.draft.text.trim()}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
