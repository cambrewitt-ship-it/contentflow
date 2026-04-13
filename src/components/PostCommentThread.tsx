"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

export interface PostComment {
  id: string;
  author_name: string;
  author_type: "agency" | "portal_party";
  content: string;
  created_at: string;
  party: {
    id: string;
    name: string;
    role: string;
    color: string | null;
  } | null;
}

interface PostCommentThreadProps {
  postId: string;
  postType: "scheduled" | "calendar_scheduled";
  comments: PostComment[];
  portalToken: string;
  authorName: string;
  onCommentAdded: (comment: PostComment) => void;
}

export function PostCommentThread({
  postId,
  postType,
  comments,
  portalToken,
  authorName,
  onCommentAdded,
}: PostCommentThreadProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_token: portalToken,
          author_name: authorName,
          content: content.trim(),
          post_type: postType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to post comment");
        return;
      }

      onCommentAdded(data.comment);
      setContent("");
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
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{c.author_name}</span>
                {c.party && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: c.party.color ?? "#6366f1" }}
                  >
                    {c.party.name}
                  </span>
                )}
                {c.author_type === "agency" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white">
                    Agency
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                {c.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="min-h-[80px] resize-none text-sm"
          disabled={isSubmitting}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
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
