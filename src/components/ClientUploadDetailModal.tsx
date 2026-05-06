"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  MessageSquare,
  Calendar,
  ArrowUp,
  Download,
  Trash2,
  Film,
  FileText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import logger from "@/lib/logger";

export interface ClientUploadDetailItem {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  created_at: string;
  target_date?: string | null;
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
  upload: ClientUploadDetailItem;
  onClose: () => void;
  getAccessToken: () => string | null;
  authorName: string;
  onDelete?: (upload: ClientUploadDetailItem) => void;
}

export function ClientUploadDetailModal({ upload, onClose, getAccessToken, authorName, onDelete }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isImage = upload.file_type?.startsWith("image/");
  const isVideo = upload.file_type?.startsWith("video/");

  const filteredNotes = upload.notes
    ? upload.notes
        .split("\n")
        .filter(line => !/^\[.*?—.*?—.*?\]:/.test(line))
        .join("\n")
        .trim() || null
    : null;

  const displayDate = upload.target_date ?? upload.created_at;

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchComments = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${upload.id}/comments?post_type=portal_upload`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } catch (err) {
      logger.error("Comments fetch error:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [upload.id, getAccessToken]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

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
      const res = await fetch(`/api/posts/${upload.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          author_name: authorName,
          content: newComment.trim(),
          post_type: "portal_upload",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error ?? "Failed to post");
        return;
      }
      setComments(prev => [...prev, data.comment]);
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
              Portal Upload
            </span>
            {displayDate && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(displayDate).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {upload.file_url && (
              <a
                href={upload.file_url}
                download={upload.file_name || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(upload); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* LEFT — media preview */}
          <div className="lg:w-[45%] flex-shrink-0 bg-gray-50 flex flex-col items-center justify-center lg:border-r border-b lg:border-b-0 border-gray-100 overflow-y-auto p-4">
            {isImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={upload.file_url}
                alt={upload.file_name}
                className="max-w-full max-h-[400px] object-contain rounded-lg shadow-sm"
              />
            ) : isVideo ? (
              <video
                src={upload.file_url}
                controls
                playsInline
                className="max-w-full max-h-[400px] rounded-lg shadow-sm bg-black"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center">
                  <FileText className="w-10 h-10" />
                </div>
                <span className="text-sm font-medium break-all text-center">{upload.file_name}</span>
              </div>
            )}
          </div>

          {/* RIGHT — details + comments */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 space-y-5">

              {/* File name */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 break-words">{upload.file_name}</h2>
              </div>

              {/* Notes / Copy */}
              {filteredNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Notes / Copy
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {filteredNotes}
                  </p>
                </div>
              )}

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
                            <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
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
