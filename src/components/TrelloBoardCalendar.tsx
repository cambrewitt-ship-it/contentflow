'use client';

// Trello-style "Board (beta)" view of the calendar. Same data + handlers as ColumnViewCalendar,
// but rendered as compact cards in fixed-width week lists on a coloured/photo background.
// Self-contained so it can be removed by deleting this file and the 'board' branch in the
// calendar page.

import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  Loader2,
  MessageCircle,
  Sparkles,
  Clock,
  Check,
  Image as ImageIcon,
  Palette,
  Rows3,
  LayoutList,
  Plus,
  Paperclip,
  ChevronsRightLeft,
  ChevronsLeftRight,
} from 'lucide-react';
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
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  buildWeekColumns,
  computeInitialStartWeek,
  normalizeToWeekStart,
  DateDivider,
  AddNoteAffordance,
  type ColumnViewCalendarProps,
  type ColumnViewCalendarHandle,
  type ClientUpload,
  type Post,
  type WeekEntry,
} from '@/components/ColumnViewCalendar';
import { PlatformBadges } from '@/components/PlatformBadges';
import { getPublishStatus } from '@/components/PublishStatusBadge';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { isVideoUrl } from '@/lib/videoUtils';
import logger from '@/lib/logger';
import { BOARD_BACKGROUNDS, isBoardBackgroundId } from '@/lib/boardBackgrounds';

export { BOARD_BACKGROUNDS };

const VISIBLE_WEEK_COUNT = 10;

type Density = 'cover' | 'compact';


const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.) — the preference just won't persist.
  }
};

// Trello's card and list elevation.
const TRELLO_SHADOW = 'shadow-[0_1px_1px_#091e4240,0_0_1px_#091e424f]';

const isUploadPost = (post: Post) =>
  post.post_type === 'client-upload' || post.post_type === 'client_upload' || !!post.isClientUpload;

const postKeyOf = (post: Post) => `${post.post_type || 'post'}-${post.id}`;

const APPROVAL_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  needs_attention: { label: 'Improve', className: 'bg-orange-100 text-orange-700' },
  pending: { label: 'Pending', className: 'bg-gray-200 text-gray-700' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
};

function fallbackFormatTime(time?: string | null) {
  if (!time) return '';
  if (time.includes('AM') || time.includes('PM')) return time;
  const [h, m = '00'] = time.split(':');
  const hours = parseInt(h);
  return `${hours % 12 || 12}:${m.slice(0, 2)} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function CardCover({ url, isVideo, compact }: { url: string; isVideo: boolean; compact: boolean }) {
  if (compact) {
    return (
      <div className="relative overflow-hidden bg-gray-200 flex-shrink-0 w-14 h-14 rounded-md">
        {isVideo ? (
          <VideoThumbnail src={url} className="w-full h-full" objectFit="cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = '/api/placeholder/100/100';
            }}
          />
        )}
      </div>
    );
  }

  // Full-bleed cover like Trello: images keep their own shape (capped so tall portraits
  // don't swallow the list); videos use a fixed frame since the thumbnail has no intrinsic size.
  return (
    <div className="relative overflow-hidden rounded-t-lg bg-[#dcdfe4]">
      {isVideo ? (
        <div className="w-full aspect-[4/3]">
          <VideoThumbnail src={url} className="w-full h-full" objectFit="cover" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          draggable={false}
          className="block w-full h-auto min-h-[80px] max-h-[260px] object-cover"
          onError={(e) => {
            e.currentTarget.src = '/api/placeholder/100/100';
          }}
        />
      )}
    </div>
  );
}

// Carousel cover: arrows + dots to click through a multi-photo post without opening it.
// A fixed square frame stops the card height jumping between differently shaped slides.
function CarouselCover({ media }: { media: Array<{ url: string; isVideo: boolean }> }) {
  const [index, setIndex] = useState(0);
  const current = media[Math.min(index, media.length - 1)];

  // Clicks here must not open the post or start a drag.
  const step = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    setIndex((i) => (i + delta + media.length) % media.length);
  };
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="relative overflow-hidden rounded-t-lg bg-[#dcdfe4] aspect-square">
      {current.isVideo ? (
        <VideoThumbnail key={current.url} src={current.url} className="w-full h-full" objectFit="cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.url}
          src={current.url}
          alt=""
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/api/placeholder/100/100';
          }}
        />
      )}

      <button
        type="button"
        onPointerDown={stopPointer}
        onClick={(e) => step(e, -1)}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition"
        title="Previous photo"
        aria-label="Previous photo"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onPointerDown={stopPointer}
        onClick={(e) => step(e, 1)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition"
        title="Next photo"
        aria-label="Next photo"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
        {index + 1}/{media.length}
      </span>
      <div className="absolute bottom-1.5 inset-x-0 flex justify-center gap-1">
        {media.map((m, i) => (
          <button
            key={`${m.url}-${i}`}
            type="button"
            onPointerDown={stopPointer}
            onClick={(e) => {
              e.stopPropagation();
              setIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-3 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'}`}
            aria-label={`Show photo ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function BoardCard({
  post,
  density,
  isDeleting,
  isDuplicating,
  isSelected,
  labelsExpanded,
  onToggleLabels,
  formatTimeTo12Hour,
  projectName,
  onPostClick,
  onTogglePostSelection,
  onDuplicatePost,
  onDeletePost,
  onDeleteClientUpload,
  onNativeDrop,
}: {
  post: Post;
  density: Density;
  isDeleting: boolean;
  isDuplicating: boolean;
  isSelected: boolean;
  labelsExpanded: boolean;
  onToggleLabels: () => void;
  formatTimeTo12Hour?: (time24: string) => string;
  projectName?: string;
  onPostClick?: (post: Post) => void;
  onTogglePostSelection?: (postId: string) => void;
  onDuplicatePost?: (post: Post) => void | Promise<void>;
  onDeletePost?: (post: Post) => void | Promise<void>;
  onDeleteClientUpload?: (upload: ClientUpload) => void | Promise<void>;
  onNativeDrop?: (e: React.DragEvent, dateKey: string) => void;
}) {
  const isUpload = isUploadPost(post);
  const dateKey = post.scheduled_date || '';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: postKeyOf(post),
    disabled: isUpload,
    data: { dateKey },
  });
  const [isNativeDragOver, setIsNativeDragOver] = useState(false);
  const compact = density === 'compact';

  // Media: posts carry image_url/media_urls; uploads carry the upload row (or a carousel group).
  let media: Array<{ url: string; isVideo: boolean }> = [];
  let text = '';
  let approval: { label: string; className: string } | null = null;
  const upload = (post.client_upload || post.upload || null) as ClientUpload | null;

  if (isUpload) {
    const group: ClientUpload[] = (post.carouselUploads?.length ?? 0) > 1 ? post.carouselUploads : upload ? [upload] : [];
    media = group
      .filter((u) => u.file_url)
      .map((u) => ({ url: u.file_url as string, isVideo: u.file_type?.startsWith('video/') ?? false }));
    text = (upload?.notes || post.caption || '')
      .split('\n')
      .filter((line: string) => !/^\[.*?—.*?—.*?\]:/.test(line))
      .join('\n')
      .trim();
    const status = upload?.one_time_approval?.approval_status as string | undefined;
    approval = status ? APPROVAL_STYLES[status] ?? APPROVAL_STYLES.pending : null;
  } else {
    const urls: string[] = (post.media_urls?.length ?? 0) > 1 ? post.media_urls : post.image_url ? [post.image_url] : [];
    media = urls.map((url) => ({ url, isVideo: isVideoUrl(url) }));
    text = post.caption || '';
    approval = post.approval_status ? APPROVAL_STYLES[post.approval_status] ?? APPROVAL_STYLES.pending : null;
  }

  const cover = media[0];
  const tags: Array<{ id: string; name: string; color: string }> = post.tags ?? [];
  const publish = isUpload ? null : getPublishStatus(post as any);
  const hasFeedback = !!(post.client_feedback || post.client_comments || post.approval?.client_comments || post.approval_comment);
  const time = post.scheduled_time
    ? formatTimeTo12Hour
      ? formatTimeTo12Hour(post.scheduled_time)
      : fallbackFormatTime(post.scheduled_time)
    : '';

  const handleDelete = () => {
    if (isDeleting) return;
    if (isUpload) {
      if (upload) onDeleteClientUpload?.(upload);
    } else {
      onDeletePost?.(post);
    }
  };

  const quickActions = (
    <div
      className={`absolute top-1.5 right-1.5 z-10 flex items-center gap-1 transition-opacity ${
        isSelected || isDeleting || isDuplicating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!isUpload && onTogglePostSelection && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePostSelection(post.id);
          }}
          className={`w-6 h-6 rounded-md flex items-center justify-center shadow-sm border transition-colors ${
            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/95 border-gray-300 text-transparent hover:text-gray-400'
          }`}
          title={isSelected ? 'Deselect post' : 'Select post'}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      {!isUpload && onDuplicatePost && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDuplicating && !isDeleting) onDuplicatePost(post);
          }}
          className="w-6 h-6 rounded-md bg-white/95 border border-gray-300 shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-600"
          title="Duplicate post"
        >
          {isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
      {(isUpload ? onDeleteClientUpload : onDeletePost) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="w-6 h-6 rounded-md bg-white/95 border border-gray-300 shadow-sm flex items-center justify-center text-gray-600 hover:text-red-600"
          title={isUpload ? 'Delete upload' : 'Delete post'}
        >
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onPostClick?.(post)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsNativeDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsNativeDragOver(true);
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node;
        if (!related || !(e.currentTarget as Node).contains(related)) setIsNativeDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNativeDragOver(false);
        onNativeDrop?.(e, dateKey);
      }}
      className={`group relative mb-2 rounded-lg bg-white ${TRELLO_SHADOW} hover:ring-2 hover:ring-[#388bff] transition-shadow ${
        isUpload ? 'cursor-pointer' : 'cursor-pointer active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''} ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${isNativeDragOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
    >
      {quickActions}

      {!compact && media.length > 1 && <CarouselCover media={media} />}
      {!compact && media.length === 1 && <CardCover url={cover.url} isVideo={cover.isVideo} compact={false} />}

      <div className={`px-3 pt-2 pb-1.5 ${compact ? 'flex gap-2' : ''}`}>
        {compact && cover && <CardCover url={cover.url} isVideo={cover.isVideo} compact />}

        <div className="min-w-0 flex-1">
          {/* Labels row — Trello-style colour bars; click any label to show/hide label names board-wide. */}
          {(tags.length > 0 || isUpload) && (
            <div className="flex flex-wrap gap-1 mb-1.5 pr-16">
              {[
                ...(isUpload ? [{ id: '__upload', name: 'Portal upload', color: '#579dff' }] : []),
                ...tags,
              ].map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLabels();
                  }}
                  className={`rounded transition-all hover:brightness-90 ${
                    labelsExpanded
                      ? 'h-4 px-1.5 text-[11px] leading-4 font-semibold text-white max-w-[140px] truncate'
                      : 'h-2 w-10'
                  }`}
                  style={{ backgroundColor: tag.color }}
                  title={labelsExpanded ? 'Hide label names' : tag.name}
                >
                  {labelsExpanded ? tag.name : null}
                </button>
              ))}
            </div>
          )}

          <p className={`text-sm leading-5 text-[#172b4d] break-words ${compact ? 'line-clamp-2' : 'line-clamp-3'} ${
            !cover && tags.length === 0 && !isUpload ? 'pr-16' : ''
          }`}>
            {text || <span className="text-[#626f86] italic">{isUpload ? 'Client upload' : 'No caption'}</span>}
          </p>

          {/* Badges row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#44546f]">
            {!isUpload && <PlatformBadges platforms={post.target_platforms} size={14} />}
            {time && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="w-3.5 h-3.5" />
                {time}
              </span>
            )}
            {approval && (
              <span className={`px-1.5 py-0.5 rounded font-medium text-[10px] ${approval.className}`}>{approval.label}</span>
            )}
            {publish && (
              <span
                className={`px-1.5 py-0.5 rounded font-semibold text-[10px] text-white ${publish.isPosted ? 'bg-green-500' : 'bg-indigo-500'}`}
                title={`${publish.isPosted ? 'Posted' : 'Scheduled'} to ${publish.platforms.join(', ')}`}
              >
                {publish.isPosted ? 'Posted' : 'Scheduled'}
              </span>
            )}
            {post.source === 'autopilot' && (
              <span className="inline-flex items-center gap-0.5 text-purple-600" title="AI-generated post">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            {hasFeedback && (
              <span className="inline-flex items-center" title="Client feedback">
                <MessageCircle className="w-3.5 h-3.5" />
              </span>
            )}
            {media.length > 1 && (
              <span className="inline-flex items-center gap-0.5" title={`${media.length} media files`}>
                <Paperclip className="w-3.5 h-3.5" />
                {media.length}
              </span>
            )}
            {projectName && (
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] truncate max-w-[100px]">
                {projectName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCardFooter({
  onClick,
  onNativeDrop,
}: {
  onClick?: () => void;
  onNativeDrop?: (e: React.DragEvent) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onNativeDrop?.(e);
      }}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isDragOver ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'text-[#44546f] hover:bg-[#091e4224] hover:text-[#172b4d]'
      }`}
    >
      <Plus className="w-4 h-4" />
      Add a post
    </button>
  );
}

function BoardList({
  weekStart,
  entries,
  title,
  isCurrent,
  density,
  dragOverDateKey,
  labelsExpanded,
  onToggleLabels,
  collapsed,
  onToggleCollapsed,
  props,
}: {
  weekStart: Date;
  entries: WeekEntry[];
  title: string;
  isCurrent: boolean;
  density: Density;
  dragOverDateKey: string | null;
  labelsExpanded: boolean;
  onToggleLabels: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  props: ColumnViewCalendarProps;
}) {
  const { setNodeRef } = useDroppable({
    id: `week-fallback-${weekStart.toISOString()}`,
    data: { dateKey: null, weekStart: weekStart.toISOString() },
  });

  const postEntries = entries.filter((e): e is Extract<WeekEntry, { type: 'post' }> => e.type === 'post');
  const items = postEntries.map((e) => postKeyOf(e.post));
  const today = new Date().toDateString();
  const projectName = (id?: string | null) => (id ? props.projects?.find((p) => p.id === id)?.name : undefined);

  // Collapsed list: a narrow vertical strip, like Trello's collapse-list control.
  if (collapsed) {
    return (
      <button
        type="button"
        data-board-list
        ref={setNodeRef}
        onClick={onToggleCollapsed}
        className={`w-10 flex-shrink-0 self-start rounded-xl bg-[#f1f2f4] ${TRELLO_SHADOW} hover:bg-[#dcdfe4] transition-colors flex flex-col items-center gap-2 py-3 ${
          isCurrent ? 'ring-2 ring-white' : ''
        }`}
        title="Expand list"
      >
        <ChevronsLeftRight className="w-4 h-4 text-[#44546f]" />
        <span className="[writing-mode:vertical-rl] text-sm font-semibold text-[#172b4d] whitespace-nowrap">{title}</span>
        <span className="text-xs text-[#626f86]">{postEntries.length}</span>
      </button>
    );
  }

  return (
    <div
      data-board-list
      className={`w-[300px] flex-shrink-0 max-h-full flex flex-col rounded-xl bg-[#f1f2f4] ${TRELLO_SHADOW} ${
        isCurrent ? 'ring-2 ring-white' : ''
      }`}
    >
      <div className="flex items-center gap-1 pl-3 pr-1.5 pt-2 pb-1">
        <h3 className="flex-1 min-w-0 text-sm font-semibold text-[#172b4d] truncate py-1">
          {title}
          {isCurrent && (
            <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded bg-[#0c66e4] text-white text-[10px] font-semibold uppercase">
              This week
            </span>
          )}
        </h3>
        <span className="text-xs text-[#626f86] flex-shrink-0 px-1">{postEntries.length}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1.5 rounded-md text-[#44546f] hover:bg-[#091e4224] transition-colors flex-shrink-0"
          title="Collapse list"
        >
          <ChevronsRightLeft className="w-4 h-4" />
        </button>
      </div>

      <div ref={setNodeRef} className="flex-1 min-h-[40px] overflow-y-auto px-2 board-list-scroll">
        {props.onAddNoteForWeek && <AddNoteAffordance onClick={() => props.onAddNoteForWeek?.(weekStart)} />}
        <SortableContext id={weekStart.toISOString()} items={items} strategy={verticalListSortingStrategy}>
          {entries.map((entry) => {
            if (entry.type === 'divider') {
              return (
                <DateDivider
                  key={`divider-${entry.dateKey}`}
                  dateKey={entry.dateKey}
                  dayDate={entry.dayDate}
                  dayName={entry.dayName}
                  isTodayDay={entry.dayDate.toDateString() === today}
                  isDragOver={dragOverDateKey === entry.dateKey}
                  getDayNumber={(d) => d.getDate()}
                  onNativeDrop={props.onDrop}
                  dayEvents={props.events?.[entry.dateKey] ?? []}
                  onEventAdd={props.onEventAdd}
                  onEventClick={props.onEventClick}
                  contentEventIndicators={props.contentEvents?.[entry.dateKey]}
                  variant="board"
                />
              );
            }
            const post = entry.post;
            const isUpload = isUploadPost(post);
            return (
              <BoardCard
                key={postKeyOf(post)}
                post={post}
                density={density}
                isDeleting={(isUpload ? props.deletingUploadIds : props.deletingPostIds)?.has(post.id) ?? false}
                isDuplicating={props.duplicatingPostIds?.has(post.id) ?? false}
                isSelected={props.selectedPosts?.has(post.id) ?? false}
                labelsExpanded={labelsExpanded}
                onToggleLabels={onToggleLabels}
                formatTimeTo12Hour={props.formatTimeTo12Hour}
                projectName={projectName(post.project_id)}
                onPostClick={props.onPostClick}
                onTogglePostSelection={props.onTogglePostSelection}
                onDuplicatePost={props.onDuplicatePost}
                onDeletePost={props.onDeletePost}
                onDeleteClientUpload={props.onDeleteClientUpload}
                onNativeDrop={props.onDrop}
              />
            );
          })}
        </SortableContext>
      </div>

      <div className="px-2 pb-2 pt-1">
        <AddCardFooter
          onClick={() => props.onAddCardClick?.(weekStart)}
          onNativeDrop={(e) => props.onAddButtonDrop?.(e, weekStart)}
        />
      </div>
    </div>
  );
}

export interface TrelloBoardCalendarProps extends ColumnViewCalendarProps {
  /** Controls rendered in the board's top bar (view toggle, events, exit, …). */
  toolbar?: React.ReactNode;
  /** Optional strip rendered under the top bar (e.g. bulk actions when posts are selected). */
  subToolbar?: React.ReactNode;
  /** Optional left drawer (the unscheduled posts tray). */
  leftDrawer?: React.ReactNode;
  /** Optional right-hand panel (the events panel). */
  rightPanel?: React.ReactNode;
  /** Optional floating dock centred at the bottom of the board (Trello-style view switcher). */
  bottomDock?: React.ReactNode;
  /**
   * Saved background id. When given, it wins over this browser's local choice (so the client
   * portal matches the agency's calendar).
   */
  background?: string | null;
  /** Called when the user picks a background; omit to hide the picker (read-only). */
  onBackgroundChange?: (id: string) => void;
}

export const TrelloBoardCalendar = forwardRef<ColumnViewCalendarHandle, TrelloBoardCalendarProps>(function TrelloBoardCalendar(
  props,
  ref
) {
  const { weeks, scheduledPosts, clientUploads = {}, events = {}, contentEvents, loading, clientId, formatWeekCommencing } = props;
  const { toolbar, subToolbar, leftDrawer, rightPanel, bottomDock, background, onBackgroundChange } = props;

  const initialStart = () => {
    const start = new Date(computeInitialStartWeek(weeks));
    start.setDate(start.getDate() - 7);
    return start;
  };

  const [startWeek, setStartWeek] = useState<Date>(initialStart);
  const hasInitializedStartWeek = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [bgId, setBgId] = useState<string>('ocean');
  const [density, setDensity] = useState<Density>('cover');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  const bgKey = `boardBg:${clientId ?? 'default'}`;

  useEffect(() => {
    const savedBg = readStorage(bgKey);
    if (savedBg && BOARD_BACKGROUNDS.some((b) => b.id === savedBg)) setBgId(savedBg);
    const savedDensity = readStorage('boardDensity');
    if (savedDensity === 'cover' || savedDensity === 'compact') setDensity(savedDensity);
    setLabelsExpanded(readStorage('boardLabelsExpanded') === '1');
  }, [bgKey]);

  useEffect(() => {
    if (!hasInitializedStartWeek.current && weeks.length > 0) {
      setStartWeek(initialStart());
      hasInitializedStartWeek.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const columns = useMemo(
    () => buildWeekColumns(startWeek, VISIBLE_WEEK_COUNT, scheduledPosts, clientUploads, events, contentEvents),
    [startWeek, scheduledPosts, clientUploads, events, contentEvents]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const navigate = (direction: 'left' | 'right') => {
    setStartWeek((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (direction === 'left' ? -7 : 7));
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const goToToday = () => {
    const start = normalizeToWeekStart(new Date());
    start.setDate(start.getDate() - 7);
    setStartWeek(start);
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  useImperativeHandle(ref, () => ({ navigate }));

  // A saved (server-side) background overrides the local one.
  useEffect(() => {
    if (isBoardBackgroundId(background)) setBgId(background);
  }, [background]);

  const selectBg = (id: string) => {
    setBgId(id);
    writeStorage(bgKey, id);
    setShowBgPicker(false);
    onBackgroundChange?.(id);
  };

  const toggleDensity = () => {
    const next: Density = density === 'cover' ? 'compact' : 'cover';
    setDensity(next);
    writeStorage('boardDensity', next);
  };

  const toggleLabels = () => {
    setLabelsExpanded((prev) => {
      writeStorage('boardLabelsExpanded', prev ? '0' : '1');
      return !prev;
    });
  };

  const toggleCollapsed = (weekKey: string) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragOver = (event: DragOverEvent) => {
    setDragOverDay((event.over?.data.current as { dateKey?: string } | undefined)?.dateKey ?? null);
  };

  // Same drop semantics as ColumnViewCalendar: a card/divider carries its dateKey; the list's
  // fallback zone carries only the week, so the page asks which day.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragOverDay(null);
    setActiveId(null);
    const activeIdStr = String(active.id);
    if (activeIdStr.startsWith('client-upload-') || !over) return;

    const overData = over.data.current as { dateKey?: string | null; weekStart?: string } | undefined;
    const targetDateKey = overData?.dateKey ?? null;
    const currentDateKey = (active.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;

    if (targetDateKey) {
      if (targetDateKey !== currentDateKey) {
        logger.debug('🔵 Board: moving post', { from: currentDateKey, to: targetDateKey });
        props.onPostMove?.(activeIdStr, targetDateKey);
      }
    } else if (overData?.weekStart) {
      props.onPostMoveToWeek?.(activeIdStr, new Date(overData.weekStart));
    }
  };

  // Trello-style click-and-drag panning on empty board background.
  const onPanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-board-list], button, a, input, select, textarea')) return;
    if (!scrollRef.current) return;
    panRef.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
  };
  const onPanMove = (e: React.MouseEvent) => {
    if (!panRef.current || !scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.x);
  };
  const onPanEnd = () => {
    panRef.current = null;
  };

  const isCurrentWeek = (weekStart: Date) =>
    normalizeToWeekStart(weekStart).getTime() === normalizeToWeekStart(new Date()).getTime();

  const bg = BOARD_BACKGROUNDS.find((b) => b.id === bgId) ?? BOARD_BACKGROUNDS[0];
  const activePost = activeId
    ? columns.flatMap((c) => c.entries).find((e) => e.type === 'post' && postKeyOf(e.post) === activeId)
    : undefined;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={bg.style}>
      {bg.isPhoto && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-2.5 bg-black/35 backdrop-blur-md text-white">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('left')}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-2.5 py-1 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigate('right')}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 text-base font-bold tracking-tight hidden md:inline">
            {formatWeekCommencing(columns[0]?.weekStart ?? startWeek)} – {formatWeekCommencing(columns[columns.length - 1]?.weekStart ?? startWeek)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={toggleDensity}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
            title={density === 'cover' ? 'Compact cards' : 'Show image covers'}
          >
            {density === 'cover' ? <Rows3 className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
          </button>
          {onBackgroundChange && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBgPicker((v) => !v)}
              className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
              title="Change background"
            >
              <Palette className="w-4 h-4" />
            </button>
            {showBgPicker && (
              <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-white shadow-xl text-gray-800 z-20">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Board background
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {BOARD_BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBg(b.id)}
                      className={`h-12 rounded-md relative overflow-hidden ${b.id === bgId ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                      style={b.style}
                      title={b.label}
                    >
                      {b.id === bgId && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {subToolbar && <div className="relative z-10 flex-shrink-0 bg-black/20 backdrop-blur-sm px-4 py-2">{subToolbar}</div>}

      <div className="relative flex-1 min-h-0 flex">
        {leftDrawer}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={scrollRef}
              className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden calendar-hscroll"
              onMouseDown={onPanStart}
              onMouseMove={onPanMove}
              onMouseUp={onPanEnd}
              onMouseLeave={onPanEnd}
            >
              {/* Bottom padding keeps the last cards clear of the floating dock. */}
              <div className={`h-full flex items-start gap-3 p-3 w-max ${bottomDock ? 'pb-20' : ''}`}>
                {columns.map((column) => (
                  <BoardList
                    key={column.weekStart.toISOString()}
                    weekStart={column.weekStart}
                    entries={column.entries}
                    title={formatWeekCommencing(column.weekStart)}
                    isCurrent={isCurrentWeek(column.weekStart)}
                    density={density}
                    dragOverDateKey={dragOverDay}
                    labelsExpanded={labelsExpanded}
                    onToggleLabels={toggleLabels}
                    collapsed={collapsedWeeks.has(column.weekStart.toISOString())}
                    onToggleCollapsed={() => toggleCollapsed(column.weekStart.toISOString())}
                    props={props}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activePost && activePost.type === 'post' ? (
                <div className="w-[284px] rotate-3 rounded-lg bg-white shadow-2xl px-3 py-2 text-sm text-[#172b4d] line-clamp-3">
                  {activePost.post.caption || 'Post'}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {rightPanel && <div className="relative z-10 flex-shrink-0 h-full bg-white">{rightPanel}</div>}

        {bottomDock && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 p-1 rounded-xl bg-white shadow-[0_8px_24px_rgba(9,30,66,0.25)] text-sm text-[#44546f]">
            {bottomDock}
          </div>
        )}
      </div>
    </div>
  );
});
