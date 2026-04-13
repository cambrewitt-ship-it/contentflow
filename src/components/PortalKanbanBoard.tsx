"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Film, FileText, Loader2, Check, AlertTriangle, X, Clock } from "lucide-react";

export interface KanbanItem {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes: string | null;
  created_at: string;
  status: string;
}

interface Props {
  token: string;
  onItemClick?: (item: KanbanItem) => void;
  refreshTrigger?: number;
  onStatusChange?: () => void;
}

type ColumnId = "briefing" | "in_review" | "approved" | "rejected";

const COLUMNS: {
  id: ColumnId;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "briefing",
    label: "Briefing",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50/60",
    borderColor: "border-blue-200",
    headerBg: "bg-blue-50",
    icon: <Clock className="w-4 h-4 text-blue-500" />,
  },
  {
    id: "in_review",
    label: "In Review",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50/60",
    borderColor: "border-orange-200",
    headerBg: "bg-orange-50",
    icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  },
  {
    id: "approved",
    label: "Approved",
    textColor: "text-green-700",
    bgColor: "bg-green-50/60",
    borderColor: "border-green-200",
    headerBg: "bg-green-50",
    icon: <Check className="w-4 h-4 text-green-600" />,
  },
  {
    id: "rejected",
    label: "Rejected",
    textColor: "text-red-700",
    bgColor: "bg-red-50/60",
    borderColor: "border-red-200",
    headerBg: "bg-red-50",
    icon: <X className="w-4 h-4 text-red-500" />,
  },
];

// Maps DB status values → Kanban column
// DB constraint: pending | processing | completed | failed | unassigned | in_use | published
function getColumnForStatus(status: string): ColumnId {
  if (["completed", "in_use", "published"].includes(status)) return "approved";
  if (["failed"].includes(status)) return "rejected";
  if (["processing"].includes(status)) return "in_review";
  return "briefing"; // pending, unassigned, or anything else
}

// Maps Kanban column → DB status value
function getStatusForColumn(columnId: ColumnId): string {
  switch (columnId) {
    case "approved": return "completed";
    case "rejected": return "failed";
    case "in_review": return "processing";
    default: return "pending";
  }
}

function KanbanCard({
  item,
  onItemClick,
}: {
  item: KanbanItem;
  onItemClick?: (item: KanbanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const isImage = item.file_type?.startsWith("image/");
  const isVideo = item.file_type?.startsWith("video/");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onItemClick?.(item)}
      className={`bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.file_url}
            alt={item.file_name}
            className="w-full h-full object-cover"
          />
        ) : isVideo ? (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Film className="w-7 h-7" />
            <span className="text-xs">Video</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <FileText className="w-7 h-7" />
            <span className="text-xs">
              {item.file_type?.split("/")[1]?.toUpperCase() ?? "File"}
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-gray-700 truncate">{item.file_name}</p>
        {item.notes && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-snug">
            {item.notes}
          </p>
        )}
        <p className="text-xs text-gray-300 mt-1.5">
          {new Date(item.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  items,
  onItemClick,
  isOver,
}: {
  column: (typeof COLUMNS)[0];
  items: KanbanItem[];
  onItemClick?: (item: KanbanItem) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 transition-all duration-150 min-h-[480px] ${
        isOver
          ? "border-blue-400 bg-blue-50/80 ring-2 ring-blue-200"
          : `${column.borderColor} ${column.bgColor}`
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 rounded-t-xl border-b ${column.borderColor} ${column.headerBg} flex items-center gap-2`}
      >
        {column.icon}
        <span className={`text-sm font-semibold ${column.textColor}`}>
          {column.label}
        </span>
        <span
          className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${column.textColor} ${column.bgColor} ${column.borderColor}`}
        >
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="p-3 flex flex-col gap-3 flex-1">
        {items.length === 0 ? (
          <div
            className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-lg ${column.borderColor} min-h-[80px]`}
          >
            <p className={`text-xs ${column.textColor} opacity-40`}>
              Drag here
            </p>
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard key={item.id} item={item} onItemClick={onItemClick} />
          ))
        )}
      </div>
    </div>
  );
}

export function PortalKanbanBoard({ token, onItemClick, refreshTrigger, onStatusChange }: Props) {
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<ColumnId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/portal/upload?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      // Only show items without a target_date (queue items)
      const queue: KanbanItem[] = (data.uploads || []).filter(
        (u: any) => !u.target_date
      );
      setItems(queue);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshTrigger]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    const col = over?.id
      ? COLUMNS.find((c) => c.id === over.id)
      : null;
    setOverColumnId(col ? (over!.id as ColumnId) : null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverColumnId(null);
    if (!over) return;

    const targetColumnId = over.id as ColumnId;
    if (!COLUMNS.find((c) => c.id === targetColumnId)) return;

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    const currentColumn = getColumnForStatus(item.status);
    if (currentColumn === targetColumnId) return;

    const newStatus = getStatusForColumn(targetColumnId);

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
    );

    try {
      const res = await fetch("/api/portal/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uploadId: item.id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      onStatusChange?.();
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
      );
    }
  };

  const columnItems = (columnId: ColumnId) =>
    items.filter((i) => getColumnForStatus(i.status) === columnId);

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  if (isLoading && items.length === 0) {
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
          Drag cards between columns to update their status
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              items={columnItems(column.id)}
              onItemClick={onItemClick}
              isOver={overColumnId === column.id}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="bg-white rounded-lg border-2 border-blue-400 shadow-xl p-3 w-44 opacity-95 rotate-1">
              <p className="text-xs font-semibold text-gray-700 truncate">
                {activeItem.file_name}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {items.length === 0 && !isLoading && (
        <p className="text-sm text-gray-400 text-center py-8">
          No queue items yet. Add content using the form above.
        </p>
      )}
    </div>
  );
}
