"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  Loader2,
  ListOrdered,
  Film,
  FileText,
  Check,
  AlertTriangle,
  Minus,
  Columns,
  Calendar,
  Kanban,
  GalleryHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

interface QueueItem {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
  target_date: string | null;
  status?: string;
}

function queueStatusBadge(status: string | undefined) {
  if (!status || ["unassigned", "pending"].includes(status)) {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Briefing</span>;
  }
  if (status === "processing") {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">In Review</span>;
  }
  if (["completed", "in_use", "published"].includes(status)) {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>;
  }
  if (status === "failed") {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>;
  }
  return null;
}

interface StatusSummary {
  approved: number;
  rejected: number;
  needsAttention: number;
  pending: number;
}

type PortalViewMode = "column" | "month" | "kanban" | "strip";

interface Props {
  token: string;
  onCalendarSuccess?: () => void;
  onQueueItemClick?: (item: QueueItem) => void;
  statusSummary?: StatusSummary;
  viewMode?: PortalViewMode;
  onViewModeChange?: (mode: PortalViewMode) => void;
  refreshTrigger?: number;
  externalQueueItems?: QueueItem[];
  isExternalQueueLoading?: boolean;
  hideQueueStrip?: boolean;
}

export function PortalContentInbox({ token, onCalendarSuccess, onQueueItemClick, statusSummary, viewMode, onViewModeChange, refreshTrigger, externalQueueItems, isExternalQueueLoading, hideQueueStrip }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const [isAddingQueue, setIsAddingQueue] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!token || externalQueueItems !== undefined) return;
    setIsLoadingQueue(true);
    try {
      const res = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = await res.json();
      const all: QueueItem[] = data.uploads || [];
      setQueueItems(all.filter((u) => !u.target_date));
    } finally {
      setIsLoadingQueue(false);
    }
  }, [token, externalQueueItems]);

  useEffect(() => { fetchQueue(); }, [fetchQueue, refreshTrigger]);

  const displayQueueItems = externalQueueItems ?? queueItems;
  const displayIsLoadingQueue = externalQueueItems !== undefined ? (isExternalQueueLoading ?? false) : isLoadingQueue;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const mapped: UploadedFile[] = Array.from(newFiles).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      id: `${f.name}-${Date.now()}-${Math.random()}`,
    }));
    setFiles((prev) => [...prev, ...mapped]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const toRemove = prev.find((f) => f.id === id);
      if (toRemove) URL.revokeObjectURL(toRemove.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const resetForm = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setCaption("");
    setTargetDate("");
    setErrorMsg(null);
  };

  const uploadFiles = async (targetDateValue: string | null): Promise<QueueItem[]> => {
    const notes = caption.trim() || null;
    const created: QueueItem[] = [];
    for (const uploadedFile of files) {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("file", uploadedFile.file);
      formData.append("fileName", uploadedFile.file.name);
      formData.append("fileType", uploadedFile.file.type);
      formData.append("fileSize", String(uploadedFile.file.size));
      if (notes) formData.append("notes", notes);
      if (targetDateValue) formData.append("targetDate", targetDateValue);
      const res = await fetch("/api/portal/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to upload ${uploadedFile.file.name}`);
      }
      const data = await res.json();
      if (data.upload) created.push(data.upload);
    }
    return created;
  };

const handleAddToQueue = async () => {
    if (files.length === 0) { setErrorMsg("Please upload at least one file."); return; }
    setIsAddingQueue(true);
    setErrorMsg(null);
    try {
      const created = await uploadFiles(null);
      resetForm();
      setSuccessMsg("Added to queue!");
      setTimeout(() => setSuccessMsg(null), 4000);
      if (externalQueueItems !== undefined) {
        onCalendarSuccess?.();
      } else if (created.length > 0) {
        // Immediately show the new items without a round-trip re-fetch
        setQueueItems((prev) => [...created.filter((u) => !u.target_date), ...prev]);
      } else {
        fetchQueue();
      }
      setTimeout(() => {
        queueScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 300);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsAddingQueue(false);
    }
  };

  const handleDeleteQueueItem = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch("/api/portal/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uploadId: id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      if (externalQueueItems !== undefined) {
        onCalendarSuccess?.(); // trigger parent refresh
      } else {
        setQueueItems((prev) => prev.filter((q) => q.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const isLoading = isAddingQueue;
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-3">
      {/* ── FORM CARD ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Content Creation</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload media and copy, then add to the calendar or drop it in the queue
          </p>
        </div>

        {/* 3-column grid: upload | copy | approval */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

          {/* ── COL 1: Upload + Actions ── */}
          <div className="p-5 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Upload Media
            </p>

            {/* Upload zone — full-bleed blue button when empty (Content Suite style) */}
            <div
              className={`relative rounded-xl transition-all cursor-pointer overflow-hidden ${
                files.length === 0
                  ? dragOver
                    ? "ring-2 ring-primary"
                    : ""
                  : dragOver
                  ? "ring-2 ring-primary/50"
                  : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              {files.length === 0 ? (
                /* Content-Suite style blue upload button */
                <div className="flex flex-col items-center justify-center gap-3 min-h-[180px] rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#1d4ed8] hover:from-[#1e3a8a] hover:to-[#1e40af] transition-all shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-4xl font-light leading-none select-none">+</span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">Click or drag to upload</p>
                  <p className="text-white/60 text-xs">Images, videos, PDFs</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 p-1">
                  {files.map((f) => (
                    <div key={f.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-200">
                      {f.file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                      ) : f.file.type.startsWith("video/") ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <Film className="w-5 h-5 text-gray-400" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <FileText className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {/* Add-more tile */}
                  <div
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-primary/40 hover:text-primary/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <span className="text-xl font-light">+</span>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAddToQueue}
                disabled={isLoading || !hasFiles}
                className="w-full h-10 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold gap-2 shadow-sm"
              >
                {isAddingQueue ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                ) : (
                  <><ListOrdered className="w-4 h-4" /> Add to Queue</>
                )}
              </Button>
            </div>

            {/* Feedback */}
            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {successMsg}
              </p>
            )}
          </div>

          {/* ── COL 2: Copy ── */}
          <div className="p-5 flex flex-col gap-4">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                Copy
              </label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Type your caption or copy here..."
                className="flex-1 min-h-[180px] resize-none text-sm border-2 border-blue-100 focus:border-blue-300 rounded-lg"
              />
            </div>

            {/* Target date */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Target Date{" "}
                <span className="font-normal normal-case text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* ── COL 3: Approval Status Summary + actions ── */}
          <div className="p-5 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                Approval Summary
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-800">Approved</span>
                  </div>
                  <div className="text-xl font-bold text-green-900">{statusSummary?.approved ?? 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Minus className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">Pending</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900">{statusSummary?.pending ?? 0}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-medium text-orange-800">Attention</span>
                  </div>
                  <div className="text-xl font-bold text-orange-900">{statusSummary?.needsAttention ?? 0}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <X className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-800">Rejected</span>
                  </div>
                  <div className="text-xl font-bold text-red-900">{statusSummary?.rejected ?? 0}</div>
                </div>
              </div>
            </div>

            {/* View toggle — underneath the approval summary */}
            {onViewModeChange && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                  View
                </label>
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => onViewModeChange("column")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "column" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    Column
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange("month")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange("kanban")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Kanban className="w-3.5 h-3.5" />
                    Kanban
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange("strip")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "strip" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <GalleryHorizontal className="w-3.5 h-3.5" />
                    Strip
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QUEUE STRIP ── */}
      {!hideQueueStrip && (displayQueueItems.length > 0 || displayIsLoadingQueue) && (
        <div ref={queueScrollRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Queue</span>
              {displayQueueItems.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                  {displayQueueItems.length}
                </span>
              )}
            </div>
            {displayIsLoadingQueue && displayQueueItems.length > 0 && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" />
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {displayIsLoadingQueue && displayQueueItems.length === 0 ? (
              // Skeleton cards while loading
              <>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-shrink-0 w-52 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex flex-col animate-pulse">
                    <div className="h-28 bg-gray-200" />
                    <div className="p-2.5 flex flex-col gap-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/3 mt-1" />
                    </div>
                  </div>
                ))}
              </>
            ) : null}
            {displayQueueItems.map((item) => {
              const isImage = item.file_type?.startsWith("image/");
              const isVideo = item.file_type?.startsWith("video/");
              const notePreview = item.notes?.substring(0, 60);

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/portal-upload", JSON.stringify(item));
                  }}
                  onClick={() => onQueueItemClick?.(item)}
                  className="flex-shrink-0 w-52 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex flex-col relative group cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <div className="h-28 bg-gray-200 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.file_url} alt={item.file_name} className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Film className="w-7 h-7" />
                        <span className="text-xs">Video</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <FileText className="w-7 h-7" />
                        <span className="text-xs">{item.file_type?.split("/")[1]?.toUpperCase() ?? "File"}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-gray-700 truncate flex-1" title={item.file_name}>
                        {item.file_name}
                      </p>
                      {queueStatusBadge(item.status)}
                    </div>
                    {notePreview && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-snug">{notePreview}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-auto">
                      {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteQueueItem(item.id); }}
                    disabled={deletingId === item.id}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
