'use client';

import React, { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

interface Post {
  id: string;
  post_type?: string;
  caption: string;
  image_url?: string;
  scheduled_date?: string;
  scheduled_time?: string | null;
  platform?: string;
  approval_status?: string;
  tags?: Array<{ id: string; name: string; color: string }>;
  [key: string]: any;
}

interface StripCalendarProps {
  scheduledPosts: { [dateKey: string]: Post[] };
  clientUploads?: { [dateKey: string]: any[] };
  onPostClick?: (post: Post) => void;
  onPostMove?: (postKey: string, newDate: string) => void;
  loading?: boolean;
}

export interface StripCalendarHandle {
  navigatePrev: () => void;
  navigateNext: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  approved:        { label: 'Approved',       bg: 'bg-green-100',  text: 'text-green-700' },
  rejected:        { label: 'Rejected',        bg: 'bg-red-100',    text: 'text-red-700' },
  needs_attention: { label: 'Needs Attention', bg: 'bg-orange-100', text: 'text-orange-700' },
  pending:         { label: 'Pending',          bg: 'bg-gray-100',   text: 'text-gray-600' },
  draft:           { label: 'Draft',            bg: 'bg-gray-100',   text: 'text-gray-500' },
};

function formatTime(time24?: string | null): string {
  if (!time24) return '';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const [h, m] = time24.split(':');
  const hours = parseInt(h);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${m || '00'} ${ampm}`;
}

// ─── Draggable post card ────────────────────────────────────────────────────

function DraggablePostCard({
  post,
  postKey,
  onClick,
  isBeingDragged,
}: {
  post: Post;
  postKey: string;
  onClick: () => void;
  isBeingDragged: boolean;
}) {
  const isUpload =
    post.post_type === 'client-upload' ||
    post.post_type === 'client_upload' ||
    post.isClientUpload;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: postKey,
    disabled: isUpload,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`transition-opacity ${isDragging ? 'opacity-30' : ''} ${isUpload ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <PostCardContent post={post} onClick={onClick} />
    </div>
  );
}

// ─── Shared card content (used for both draggable and overlay) ───────────────

function PostCardContent({ post, onClick }: { post: Post; onClick: () => void }) {
  const status = post.approval_status || 'pending';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const caption = post.caption || '';
  const isUpload =
    post.post_type === 'client-upload' ||
    post.post_type === 'client_upload' ||
    post.isClientUpload;
  const tags: Array<{ id: string; name: string; color: string }> = post.tags ?? [];
  const time = formatTime(post.scheduled_time);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all duration-150 overflow-hidden"
    >
      {/* Image — full aspect ratio */}
      {post.image_url && (
        <div className="w-full bg-gray-50">
          <img
            src={post.image_url}
            alt=""
            className="w-full h-auto block"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
          />
        </div>
      )}

      <div className="p-2 space-y-1.5">
        {/* Status + platform */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
            {isUpload ? 'Upload' : statusCfg.label}
          </span>
          {post.platform && !isUpload && (
            <span className="text-[10px] text-gray-500 uppercase font-medium truncate">
              {post.platform}
            </span>
          )}
        </div>

        {/* Caption */}
        <p className="text-xs text-gray-700 leading-snug line-clamp-3">
          {caption || 'No caption'}
        </p>

        {/* Time */}
        {time && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{time}</span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full text-white leading-none"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Droppable day column ────────────────────────────────────────────────────

function DroppableDayColumn({
  dateKey,
  isToday,
  isWeekend,
  isDragOver,
  dayName,
  dayNum,
  posts,
  activeId,
  onPostClick,
  todayRef,
}: {
  dateKey: string;
  isToday: boolean;
  isWeekend: boolean;
  isDragOver: boolean;
  dayName: string;
  dayNum: number;
  posts: Post[];
  activeId: string | null;
  onPostClick: (post: Post) => void;
  todayRef?: React.RefObject<HTMLDivElement>;
}) {
  const { setNodeRef } = useDroppable({ id: dateKey });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (todayRef && el) (todayRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`flex-shrink-0 rounded-lg border-2 flex flex-col transition-colors ${
        isDragOver
          ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
          : isToday
          ? 'border-blue-400'
          : 'border-gray-200'
      } ${!isDragOver && isWeekend ? 'bg-gray-100' : !isDragOver ? 'bg-white' : ''}`}
      style={{ width: 'calc((100vw - 320px) / 5)', minWidth: '200px', maxWidth: '280px', minHeight: '200px' }}
    >
      {/* Day header */}
      <div className={`px-3 py-2 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 rounded-t-lg ${
        isToday ? 'bg-blue-50' : ''
      }`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-blue-700' : 'text-gray-500'}`}>
          {dayName}
        </span>
        <span className={`text-base font-bold leading-none ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
          {dayNum}
        </span>
        {posts.length > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
            {posts.length}
          </span>
        )}
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-2 p-2 flex-1">
        {posts.map(post => {
          const postKey = `${post.post_type || 'post'}-${post.id}`;
          return (
            <DraggablePostCard
              key={postKey}
              post={post}
              postKey={postKey}
              onClick={() => onPostClick(post)}
              isBeingDragged={activeId === postKey}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export const StripCalendar = forwardRef<StripCalendarHandle, StripCalendarProps>(
  function StripCalendar({ scheduledPosts, clientUploads = {}, onPostClick, onPostMove, loading = false }, ref) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dragOverDay, setDragOverDay] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const todayColRef = useRef<HTMLDivElement | null>(null);

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const days = useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const result: Date[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        result.push(new Date(year, month, d));
      }
      return result;
    }, [currentMonth]);

    const postsForDay = useMemo(() => {
      const map: Record<string, Post[]> = {};
      for (const day of days) {
        const dateKey = day.toLocaleDateString('en-CA');
        const posts = (scheduledPosts[dateKey] || []).map(p => ({
          ...p,
          post_type: p.post_type || 'post',
          scheduled_date: p.scheduled_date || dateKey,
        }));
        const uploads = (clientUploads[dateKey] || []).map((upload: any) => {
          const isImage =
            typeof upload.file_type === 'string'
              ? upload.file_type.startsWith('image/')
              : /\.(png|jpe?g|gif|webp|svg)$/i.test(upload.file_name || '');
          return {
            id: upload.id,
            post_type: 'client-upload',
            caption: upload.notes || 'Client Upload',
            image_url: isImage ? upload.file_url : undefined,
            scheduled_date: dateKey,
            isClientUpload: true,
            tags: upload.tags ?? [],
          };
        });
        map[dateKey] = [...posts, ...uploads];
      }
      return map;
    }, [days, scheduledPosts, clientUploads]);

    // Build a flat lookup: postKey → dateKey for drag resolution
    const postKeyToDate = useMemo(() => {
      const lookup: Record<string, string> = {};
      for (const [dateKey, posts] of Object.entries(postsForDay)) {
        for (const post of posts) {
          lookup[`${post.post_type || 'post'}-${post.id}`] = dateKey;
        }
      }
      return lookup;
    }, [postsForDay]);

    const navigatePrev = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const navigateNext = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    useImperativeHandle(ref, () => ({ navigatePrev, navigateNext }));

    useEffect(() => {
      if (todayColRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const el = todayColRef.current;
        container.scrollLeft = Math.max(0, el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2);
      } else if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
      }
    }, [currentMonth]);

    // ── DnD handlers ──────────────────────────────────────────────────────────

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
      const overId = event.over?.id as string | undefined;
      if (!overId) { setDragOverDay(null); return; }
      // overId is a dateKey if we're over a day column
      if (postsForDay[overId] !== undefined) {
        setDragOverDay(overId);
      } else {
        // overId might be a postKey — resolve to its dateKey
        setDragOverDay(postKeyToDate[overId] ?? null);
      }
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setDragOverDay(null);

      if (!over || !onPostMove) return;

      const postKey = active.id as string;
      // Skip client uploads — they're not draggable
      if (postKey.startsWith('client-upload-')) return;

      const overId = over.id as string;
      const targetDateKey = postsForDay[overId] !== undefined
        ? overId
        : postKeyToDate[overId] ?? null;

      if (!targetDateKey) return;

      const currentDateKey = postKeyToDate[postKey];
      if (targetDateKey !== currentDateKey) {
        onPostMove(postKey, targetDateKey);
      }
    };

    // Find the active post for the drag overlay
    const activePost = useMemo(() => {
      if (!activeId) return null;
      for (const posts of Object.values(postsForDay)) {
        const found = posts.find(p => `${p.post_type || 'post'}-${p.id}` === activeId);
        if (found) return found;
      }
      return null;
    }, [activeId, postsForDay]);

    const monthLabel = currentMonth.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Header nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={navigatePrev}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600 text-sm font-medium shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
            <button
              type="button"
              onClick={navigateNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600 text-sm font-medium shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Strip scroll area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto min-h-0"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="flex gap-2 p-3" style={{ width: 'max-content', minHeight: '100%' }}>
              {days.map(day => {
                const dateKey = day.toLocaleDateString('en-CA');
                const dayOfWeek = day.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isToday = day.toDateString() === today.toDateString();
                const posts = postsForDay[dateKey] || [];
                const dayName = day.toLocaleDateString('en-NZ', { weekday: 'short' });

                return (
                  <DroppableDayColumn
                    key={dateKey}
                    dateKey={dateKey}
                    isToday={isToday}
                    isWeekend={isWeekend}
                    isDragOver={dragOverDay === dateKey}
                    dayName={dayName}
                    dayNum={day.getDate()}
                    posts={posts}
                    activeId={activeId}
                    onPostClick={(post) => onPostClick?.(post)}
                    todayRef={isToday ? (todayColRef as React.RefObject<HTMLDivElement>) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePost ? (
            <div className="w-52 opacity-95 rotate-1 shadow-xl">
              <PostCardContent post={activePost} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }
);
