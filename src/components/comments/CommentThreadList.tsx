"use client";

import { Reply } from "lucide-react";
import { splitMentions } from "@/lib/mentions";
import type { ThreadComment } from "./types";

interface Props {
  comments: ThreadComment[];
  emptyText?: string;
  /** Omit to hide the Reply buttons. */
  onReply?: (comment: ThreadComment) => void;
}

function avatarColor(c: ThreadComment): string {
  if (c.author_type === "agency") return "#1e293b";
  return c.member?.color ?? c.party?.color ?? "#6366f1";
}

function CommentBody({ content }: { content: string }) {
  return (
    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
      {splitMentions(content).map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <span key={i} className="rounded bg-indigo-50 px-1 font-medium text-indigo-700">
            @{seg.name}
          </span>
        )
      )}
    </p>
  );
}

function CommentRow({ c, onReply, small }: { c: ThreadComment; onReply?: Props["onReply"]; small?: boolean }) {
  const name = c.member?.name ?? c.author_name;
  return (
    <div className="group flex gap-2.5">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white ${
          small ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs"
        }`}
        style={{ backgroundColor: avatarColor(c) }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-800">{name}</span>
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
        <CommentBody content={c.content} />
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(c)}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-700"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

/** Comments with replies grouped (one level deep) under the comment they answer. */
export function CommentThreadList({ comments, emptyText = "No comments yet.", onReply }: Props) {
  if (comments.length === 0) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
  }

  const ids = new Set(comments.map(c => c.id));
  const replies = new Map<string, ThreadComment[]>();
  const roots: ThreadComment[] = [];
  for (const c of comments) {
    if (c.parent_comment_id && ids.has(c.parent_comment_id)) {
      const list = replies.get(c.parent_comment_id) ?? [];
      list.push(c);
      replies.set(c.parent_comment_id, list);
    } else {
      roots.push(c);
    }
  }

  return (
    <>
      {roots.map(root => (
        <div key={root.id} className="space-y-2">
          <CommentRow c={root} onReply={onReply} />
          {(replies.get(root.id) ?? []).length > 0 && (
            <div className="ml-9 space-y-2 border-l-2 border-gray-100 pl-3">
              {replies.get(root.id)!.map(r => (
                <CommentRow key={r.id} c={r} onReply={onReply} small />
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/** Small bar above the composer: "Replying to Sam ×". */
export function ReplyingTo({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <Reply className="h-3 w-3" />
      Replying to <span className="font-semibold text-gray-700">{name}</span>
      <button type="button" onClick={onCancel} className="ml-1 text-gray-400 hover:text-gray-700" aria-label="Cancel reply">
        ×
      </button>
    </div>
  );
}
