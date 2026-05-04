"use client";

import { useState, useCallback, useEffect } from "react";
import { Film, FileText, Loader2, Check, Clock, Image as ImageIcon, Calendar } from "lucide-react";

export interface KanbanItem {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
  status: string;
}

export interface KanbanCalendarPost {
  id: string;
  caption: string;
  image_url: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  approval_status: string;
  approval_steps: any[];
  platforms_scheduled: string[] | null;
  post_notes: string | null;
  tags?: Array<{ id: string; name: string; color: string }>;
}

interface UploadItem {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
  status: string;
  target_date: string | null;
}

type KanbanCard =
  | { kind: "upload"; data: UploadItem }
  | { kind: "post"; data: KanbanCalendarPost };

interface Props {
  token: string;
  onItemClick?: (item: KanbanItem) => void;
  onPostClick?: (post: KanbanCalendarPost) => void;
  refreshTrigger?: number;
  onStatusChange?: () => void;
}

type ColumnId = "in_queue" | "pending" | "approved";

const COLUMNS: {
  id: ColumnId;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  countBg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "in_queue",
    label: "In Queue",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50/60",
    borderColor: "border-blue-200",
    headerBg: "bg-blue-50",
    countBg: "bg-blue-100",
    icon: <Clock className="w-4 h-4 text-blue-500" />,
  },
  {
    id: "pending",
    label: "Pending",
    textColor: "text-gray-600",
    bgColor: "bg-gray-50/60",
    borderColor: "border-gray-300",
    headerBg: "bg-gray-100",
    countBg: "bg-gray-200",
    icon: <Clock className="w-4 h-4 text-gray-400" />,
  },
  {
    id: "approved",
    label: "Approved",
    textColor: "text-green-700",
    bgColor: "bg-green-50/60",
    borderColor: "border-green-200",
    headerBg: "bg-green-50",
    countBg: "bg-green-100",
    icon: <Check className="w-4 h-4 text-green-600" />,
  },
];

function getColumnForCard(card: KanbanCard): ColumnId | null {
  if (card.kind === "upload") {
    if (card.data.status === "failed") return null;
    if (!card.data.target_date) return "in_queue";
    return "pending";
  } else {
    if (card.data.approval_status === "rejected") return null;
    if (card.data.approval_status === "approved") return "approved";
    return "pending";
  }
}

function UploadCard({ upload, onClick }: { upload: UploadItem; onClick?: () => void }) {
  const isImage = upload.file_type?.startsWith("image/");
  const isVideo = upload.file_type?.startsWith("video/");

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all select-none"
    >
      <div className="h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={upload.file_url} alt={upload.file_name} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Film className="w-7 h-7" />
            <span className="text-xs">Video</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <FileText className="w-7 h-7" />
            <span className="text-xs">{upload.file_type?.split("/")[1]?.toUpperCase() ?? "File"}</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-gray-700 truncate">{upload.file_name}</p>
        {upload.notes && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-snug">{upload.notes}</p>
        )}
        <p className="text-xs text-gray-300 mt-1.5">
          {new Date(upload.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
      </div>
    </div>
  );
}

function CalendarPostCard({ post, onClick }: { post: KanbanCalendarPost; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all select-none"
    >
      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="Post" className="w-full h-28 object-cover" />
      ) : (
        <div className="h-28 bg-gray-100 flex items-center justify-center">
          <ImageIcon className="w-7 h-7 text-gray-300" />
        </div>
      )}
      <div className="p-2.5">
        {post.caption && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-snug">{post.caption}</p>
        )}
        {post.scheduled_date && (
          <p className="text-xs text-gray-300 mt-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  cards,
  onItemClick,
  onPostClick,
}: {
  column: (typeof COLUMNS)[0];
  cards: KanbanCard[];
  onItemClick?: (item: KanbanItem) => void;
  onPostClick?: (post: KanbanCalendarPost) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border-2 ${column.borderColor} ${column.bgColor} min-h-[480px]`}
    >
      <div
        className={`px-4 py-3 rounded-t-xl border-b ${column.borderColor} ${column.headerBg} flex items-center gap-2`}
      >
        {column.icon}
        <span className={`text-sm font-semibold ${column.textColor}`}>{column.label}</span>
        <span
          className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${column.countBg} ${column.textColor}`}
        >
          {cards.length}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3 flex-1">
        {cards.length === 0 ? (
          <div
            className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-lg ${column.borderColor} min-h-[80px]`}
          >
            <p className={`text-xs ${column.textColor} opacity-40`}>Empty</p>
          </div>
        ) : (
          cards.map((card) =>
            card.kind === "upload" ? (
              <UploadCard
                key={`upload-${card.data.id}`}
                upload={card.data}
                onClick={() =>
                  onItemClick?.({
                    id: card.data.id,
                    file_name: card.data.file_name,
                    file_type: card.data.file_type,
                    file_url: card.data.file_url,
                    notes: card.data.notes,
                    review_notes: card.data.review_notes,
                    created_at: card.data.created_at,
                    status: card.data.status,
                  })
                }
              />
            ) : (
              <CalendarPostCard
                key={`post-${card.data.id}`}
                post={card.data}
                onClick={() => onPostClick?.(card.data)}
              />
            )
          )
        )}
      </div>
    </div>
  );
}

export function PortalKanbanBoard({
  token,
  onItemClick,
  onPostClick,
  refreshTrigger,
}: Props) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [uploadsRes, calendarRes] = await Promise.all([
        fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`),
        fetch(`/api/portal/calendar?token=${encodeURIComponent(token)}`),
      ]);

      const allCards: KanbanCard[] = [];

      if (uploadsRes.ok) {
        const uploadsData = await uploadsRes.json();
        for (const u of uploadsData.uploads ?? []) {
          allCards.push({ kind: "upload", data: u });
        }
      }

      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        const posts = Object.values(calendarData.posts as Record<string, any[]>).flat();
        for (const p of posts) {
          allCards.push({ kind: "post", data: p });
        }
      }

      setCards(allCards);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshTrigger]);

  const columnCards = (columnId: ColumnId) =>
    cards.filter((c) => getColumnForCard(c) === columnId);

  if (isLoading && cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Content Pipeline</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Content moves through the pipeline as it&apos;s scheduled and approved
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={columnCards(column.id)}
            onItemClick={onItemClick}
            onPostClick={onPostClick}
          />
        ))}
      </div>
    </div>
  );
}
