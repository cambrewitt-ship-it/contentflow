"use client";

import { useCallback, useRef, useState } from "react";
import type { Mentionable } from "@/lib/mentions";
import { useMentionDraft, type MentionTextareaHandle } from "./MentionTextarea";
import type { ReplyTarget, ThreadComment } from "./types";

/** Draft text, @mentions and reply target for a comment composer. */
export function useCommentComposer(mentionables: Mentionable[]) {
  const draft = useMentionDraft();
  const composerRef = useRef<MentionTextareaHandle>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  const startReply = useCallback(
    (c: ThreadComment) => {
      setReplyTo({ commentId: c.id, authorName: c.member?.name ?? c.author_name });
      const target = c.member_id
        ? mentionables.find(m => m.kind === "member" && m.id === c.member_id)
        : c.user_id
          ? mentionables.find(m => m.kind === "user" && m.id === c.user_id)
          : undefined;
      if (target) composerRef.current?.prefillMention(target);
      else composerRef.current?.focus();
    },
    [mentionables]
  );

  const reset = useCallback(() => {
    draft.reset();
    setReplyTo(null);
  }, [draft]);

  return {
    draft,
    composerRef,
    replyTo,
    cancelReply: () => setReplyTo(null),
    startReply,
    reset,
    /** Body fields to send with the comment POST. */
    payload: () => ({ content: draft.encoded, parent_comment_id: replyTo?.commentId ?? null }),
  };
}
