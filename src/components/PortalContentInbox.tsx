"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  Loader2,
  ListOrdered,
  FileText,
  Columns,
  Calendar,
  KanbanSquare,
  GalleryHorizontal,
  Plus,
} from "lucide-react";
import { VideoThumbnail } from "@/components/VideoThumbnail";

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
  carousel_group_id?: string | null;
  carousel_order?: number;
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

type PortalViewMode = "board" | "column" | "month";

export const VIEW_OPTIONS: Array<{ id: PortalViewMode; label: string; Icon: typeof Columns }> = [
  { id: "board", label: "Board", Icon: KanbanSquare },
  { id: "column", label: "Column", Icon: Columns },
  { id: "month", label: "Month", Icon: Calendar },
];

interface Props {
  token: string;
  onCalendarSuccess?: () => void;
  onQueueItemClick?: (items: QueueItem[]) => void;
  refreshTrigger?: number;
  externalQueueItems?: QueueItem[];
  isExternalQueueLoading?: boolean;
  hideQueueStrip?: boolean;
  /** Shows "+ Upload Content" in the queue header (and keeps the queue visible when empty). */
  onUploadClick?: () => void;
}

export function PortalContentInbox({ token, onCalendarSuccess, onQueueItemClick, refreshTrigger, externalQueueItems, isExternalQueueLoading, hideQueueStrip, onUploadClick }: Props) {
  const queueScrollRef = useRef<HTMLDivElement>(null);

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

  // Group queue items: items sharing a carousel_group_id appear as one card
  const groupQueueItems = (items: QueueItem[]): QueueItem[][] => {
    const groups: QueueItem[][] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (item.carousel_group_id) {
        if (!seen.has(item.carousel_group_id)) {
          seen.add(item.carousel_group_id);
          const group = items
            .filter(i => i.carousel_group_id === item.carousel_group_id)
            .sort((a, b) => (a.carousel_order ?? 0) - (b.carousel_order ?? 0));
          groups.push(group);
        }
      } else {
        groups.push([item]);
      }
    }
    return groups;
  };

  return (
    <div className="space-y-3">
      {/* ── QUEUE STRIP ── */}
      {!hideQueueStrip && (displayQueueItems.length > 0 || displayIsLoadingQueue || onUploadClick) && (
        <div ref={queueScrollRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Queue</span>
              {displayQueueItems.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                  {groupQueueItems(displayQueueItems).length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {displayIsLoadingQueue && displayQueueItems.length > 0 && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" />
              )}
              {onUploadClick && (
                <button
                  type="button"
                  onClick={onUploadClick}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#1e3a8a] hover:from-[#1e40af] hover:to-[#172554] text-white text-sm font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Upload Content
                </button>
              )}
            </div>
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
            {groupQueueItems(displayQueueItems).map((group) => {
              const item = group[0];
              const isCarousel = group.length > 1;
              const isImage = item.file_type?.startsWith("image/");
              const isVideo = item.file_type?.startsWith("video/");
              const notePreview = item.notes?.substring(0, 60);

              return (
                <div
                  key={isCarousel ? (item.carousel_group_id ?? item.id) : item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    // Pass all items in the group so the calendar can receive the full carousel
                    e.dataTransfer.setData("text/portal-upload", JSON.stringify(isCarousel ? group : item));
                  }}
                  onClick={() => onQueueItemClick?.(group)}
                  className="flex-shrink-0 w-52 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex flex-col relative group cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all"
                >
                  {/* Thumbnail — stacked effect for carousels */}
                  <div className="h-28 bg-gray-200 flex items-center justify-center overflow-hidden relative">
                    {isCarousel && group[1] && (
                      /* Second image peeking behind */
                      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl overflow-hidden opacity-60">
                        {group[1].file_type?.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={group[1].file_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-300" />
                        )}
                      </div>
                    )}
                    <div className={`absolute inset-0 ${isCarousel ? "-translate-x-1 -translate-y-1" : ""} rounded-xl overflow-hidden`}>
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.file_url} alt={item.file_name} className="w-full h-full object-cover" />
                      ) : isVideo ? (
                        <VideoThumbnail src={item.file_url} className="w-full h-full" objectFit="cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 bg-gray-100">
                          <FileText className="w-7 h-7" />
                          <span className="text-xs">{item.file_type?.split("/")[1]?.toUpperCase() ?? "File"}</span>
                        </div>
                      )}
                    </div>
                    {isCarousel && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full z-10">
                        <GalleryHorizontal className="w-3 h-3" />
                        {group.length}
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-gray-700 truncate flex-1" title={isCarousel ? `Carousel (${group.length} items)` : item.file_name}>
                        {isCarousel ? `Carousel (${group.length})` : item.file_name}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      // Delete all items in the carousel group
                      group.forEach(g => handleDeleteQueueItem(g.id));
                    }}
                    disabled={group.some(g => deletingId === g.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    {group.some(g => deletingId === g.id) ? (
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
