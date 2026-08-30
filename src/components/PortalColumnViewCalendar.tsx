'use client';

import React, { useState, useEffect, useRef, useMemo, ChangeEvent, useImperativeHandle, forwardRef } from 'react';
import { Calendar, CheckCircle, AlertTriangle, XCircle, Minus, Tag, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { isVideoUrl } from '@/lib/videoUtils';
import { type CalendarEvent } from './CalendarEventModal';
import logger from '@/lib/logger';
import { PortalTagDropdown } from '@/components/PortalTagDropdown';
import { DateDivider, AddNoteAffordance } from '@/components/ColumnViewCalendar';
import { AddPostCardButton } from '@/components/AddPostCardButton';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ClientUpload {
  id: string;
  file_name?: string;
  file_type?: string;
  file_url?: string;
  notes?: string | null;
  created_at?: string;
  [key: string]: any;
}

interface Post {
  id: string;
  post_type?: string;
  caption: string;
  image_url?: string;
  scheduled_date?: string;
  scheduled_time?: string | null;
  platform?: string;
  project_id?: string | null | undefined;
  [key: string]: any; // Allow additional properties
}

// Trello-style flat card model — see ColumnViewCalendar.tsx for the internal-planner
// equivalent this mirrors. A week column renders one entry per date-with-content (a
// "divider" carrying the day header/events) followed by one entry per post/upload for
// that date, instead of a fixed row per calendar day.
type WeekEntry =
  | { type: 'divider'; dateKey: string; dayDate: Date; dayName: string }
  | { type: 'post'; dateKey: string; post: Post };

interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

interface PortalColumnViewCalendarProps {
  weeks: Date[];
  scheduledPosts: {[key: string]: Post[]};
  clientUploads?: {[key: string]: ClientUpload[]};
  events?: {[key: string]: CalendarEvent[]};
  loading?: boolean;
  onPostMove?: (postKey: string, newDate: string) => void;
  onDateClick?: (date: Date) => void;
  formatWeekCommencing: (weekStart: Date) => string;
  onDrop?: (e: React.DragEvent, dateKey: string) => void;
  onQueueItemDrop?: (uploadId: string, dateKey: string) => void;
  clientId?: string;
  portalToken?: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
  onAddCardClick?: (weekStart: Date) => void;
  onAddButtonDrop?: (e: React.DragEvent, weekStart: Date) => void;
  onAddNoteForWeek?: (weekStart: Date) => void;
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  comments: {[key: string]: string};
  onCommentChange: (postKey: string, comment: string) => void;
  editedCaptions: {[key: string]: string};
  onCaptionChange: (postKey: string, caption: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
  deletingUploadIds?: Set<string>;
  onPostClick?: (post: Post) => void;
  onEventAdd?: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  movingToDate?: string | null;
  movingUploadId?: string | null;
  calendarSelectedPostIds?: Set<string>;
  onToggleCalendarPostSelection?: (postId: string) => void;
  onTagsChange?: (postId: string, tags: Array<{ id: string; name: string; color: string }>) => void;
}

// Lazy loading image component
const LazyImage = ({ 
  src, 
  alt, 
  className 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-auto object-contain rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onError={(e) => {
            e.currentTarget.src = '/api/placeholder/100/100';
          }}
        />
      )}
      {!isLoaded && isInView && (
        <div className="w-full min-h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
      {!isInView && (
        <div className="w-full min-h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

// Sortable Post Card Component
function SortablePostCard({
  post,
  postKey,
  handleEditScheduledPost,
  editingPostId,
  setEditingPostId,
  editingTimePostIds,
  formatTimeTo12Hour,
  projects,
  selectedPosts,
  onPostSelection,
  comments,
  onCommentChange,
  editedCaptions,
  onCaptionChange,
  onDeleteClientUpload,
  deletingUploadIds,
  clientId,
  portalToken,
  onPostClick,
  calendarSelectedPostIds,
  onToggleCalendarPostSelection,
  onTagsChange,
  movingUploadId,
  onNativeDrop,
}: {
  post: Post;
  postKey: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  comments: {[key: string]: string};
  onCommentChange: (postKey: string, comment: string) => void;
  editedCaptions: {[key: string]: string};
  onCaptionChange: (postKey: string, caption: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
  deletingUploadIds?: Set<string>;
  clientId?: string;
  portalToken?: string;
  onPostClick?: (post: Post) => void;
  calendarSelectedPostIds?: Set<string>;
  onToggleCalendarPostSelection?: (postId: string) => void;
  onTagsChange?: (postId: string, tags: Array<{ id: string; name: string; color: string }>) => void;
  movingUploadId?: string | null;
  onNativeDrop?: (e: React.DragEvent, dateKey: string) => void;
}) {
  const isClientUpload =
    post.post_type === 'client-upload' ||
    post.post_type === 'client_upload' ||
    post.isClientUpload;

  const dateKey = post.scheduled_date || '';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: postKey, data: { dateKey } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isNativeDragOver, setIsNativeDragOver] = useState(false);
  const nativeDropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsNativeDragOver(true);
    },
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setIsNativeDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      const relatedTarget = e.relatedTarget as Node;
      const currentTarget = e.currentTarget as Node;
      if (!relatedTarget || !currentTarget.contains(relatedTarget)) setIsNativeDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsNativeDragOver(false);
      onNativeDrop?.(e, dateKey);
    },
  };

  const formatTime = (time24?: string) => {
    if (formatTimeTo12Hour) {
      return formatTimeTo12Hour(time24 || '');
    }
    if (!time24) return '';
    
    if (time24.includes('AM') || time24.includes('PM')) {
      return time24;
    }
    
    const timeParts = time24.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = timeParts[1] || '00';
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isEditingTime = editingTimePostIds?.has(post.id) || false;
  const isEditing = editingPostId === post.id;
  const isCalendarSelected = calendarSelectedPostIds?.has(post.id) ?? false;

  const selectedStatus = selectedPosts[postKey];
  const statusToUse = selectedStatus || post.approval_status;
  const commentValue = comments[postKey] || '';
  const captionValue = Object.prototype.hasOwnProperty.call(editedCaptions, postKey)
    ? editedCaptions[postKey]
    : post.caption || '';
  const hasCaptionChanged = captionValue !== (post.caption || '');
  const isDeletingUpload = isClientUpload ? deletingUploadIds?.has(post.id) ?? false : false;

  // Carousel navigation state
  const [imgIndex, setImgIndex] = useState(0);

  // Tags state — initialise from post.tags (pre-loaded by portal calendar API)
  const [postTags, setPostTags] = useState<Array<{ id: string; name: string; color: string }>>(
    post.tags ?? []
  );
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagButtonRef, setTagButtonRef] = useState<HTMLButtonElement | null>(null);

  // Sync local tags when parent updates post.tags (e.g. changed via the detail modal)
  useEffect(() => {
    setPostTags(post.tags ?? []);
  }, [post.tags]);

  const handleTagToggle = async (tagId: string, tag: { id: string; name: string; color: string }, isSelected: boolean) => {
    if (!portalToken) return;
    if (isSelected) {
      const next = postTags.filter(t => t.id !== tagId);
      setPostTags(next);
      const res = await fetch(
        `/api/portal/post-tags?portal_token=${encodeURIComponent(portalToken)}&post_id=${post.id}&tag_id=${tagId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setPostTags(prev => [...prev, tag]);
      } else {
        onTagsChange?.(post.id, next);
      }
    } else {
      const next = [...postTags, tag];
      setPostTags(next);
      const res = await fetch('/api/portal/post-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_token: portalToken, post_id: post.id, tag_id: tagId }),
      });
      if (!res.ok) {
        setPostTags(prev => prev.filter(t => t.id !== tagId));
      } else {
        onTagsChange?.(post.id, next);
      }
    }
  };

  const getCardStyling = () => {
    if (selectedStatus === 'approved') {
      return 'border-green-400 bg-green-100 shadow-lg shadow-green-200/50';
    }
    if (selectedStatus === 'rejected') {
      return 'border-red-400 bg-red-100 shadow-lg shadow-red-200/50';
    }
    if (selectedStatus === 'needs_attention') {
      return 'border-orange-400 bg-orange-100 shadow-lg shadow-orange-200/50';
    }

    switch (post.approval_status) {
      case 'approved':
        return 'border-green-200 bg-green-50';
      case 'rejected':
        return 'border-red-200 bg-red-50';
      case 'needs_attention':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const handleStatusClick = (status: 'approved' | 'rejected' | 'needs_attention') => {
    const nextStatus = selectedStatus === status ? null : status;
    onPostSelection(postKey, nextStatus);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  };

  // Render per-party approval chips when a pipeline exists
  const renderPipelineChips = () => {
    const steps: Array<{ id: string; step_order: number; status: string; party: { name: string; color: string | null } | null }> = post.approval_steps || [];
    if (steps.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {steps.map(step => (
          <span
            key={step.id}
            className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              step.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : step.status === 'rejected'
                ? 'bg-red-100 text-red-700'
                : step.status === 'changes_requested'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step.status === 'approved' ? '✓ ' : step.status === 'rejected' ? '✗ ' : '· '}
            {step.party?.name ?? `Step ${step.step_order}`}
          </span>
        ))}
      </div>
    );
  };

  const renderApprovalStatusBadge = () => {
    const status = post.approval_status || 'pending';
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'approved':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      case 'needs_attention':
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Improve
          </span>
        );
      case 'draft':
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            Draft
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            <Minus className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  const handleCaptionTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    onCaptionChange(postKey, value);
    event.target.style.height = 'auto';
    event.target.style.height = Math.max(40, event.target.scrollHeight) + 'px';
  };

  if (isClientUpload) {
    const uploadData = (post.client_upload || post.upload || {}) as ClientUpload;
    const uploadNotes = uploadData.notes || post.caption || 'Client upload submitted';
    const fileName = uploadData.file_name || uploadData.name;
    const createdAt = uploadData.created_at ? new Date(uploadData.created_at) : null;
    const displayDate = createdAt
      ? createdAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
      : post.scheduled_date
      ? new Date(post.scheduled_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
      : '';
    const displayTime = createdAt
      ? createdAt.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
      : '';

    const approvalTag = (() => {
      // One-time link approval takes priority over the raw upload status field
      const otaStatus = (uploadData as any).one_time_approval?.approval_status as string | undefined;
      if (otaStatus === 'approved') return { label: 'Approved', className: 'bg-green-100 text-green-700', card: 'border-green-200 bg-green-50' };
      if (otaStatus === 'rejected') return { label: 'Rejected', className: 'bg-red-100 text-red-700', card: 'border-red-200 bg-red-50' };
      if (otaStatus === 'needs_attention') return { label: 'Improve', className: 'bg-orange-100 text-orange-700', card: 'border-orange-200 bg-orange-50' };

      const s = uploadData.status as string | undefined;
      if (s === 'completed' || s === 'in_use' || s === 'published')
        return { label: 'Approved', className: 'bg-green-100 text-green-700', card: 'border-green-200 bg-green-50' };
      if (s === 'failed')
        return { label: 'Rejected', className: 'bg-red-100 text-red-700', card: 'border-red-200 bg-red-50' };
      return { label: 'Pending', className: 'bg-gray-100 text-gray-600', card: 'border-gray-200 bg-white' };
    })();

    return (
      <div
        ref={setNodeRef}
        data-date-key={dateKey}
        style={style}
        {...attributes}
        {...listeners}
        {...nativeDropHandlers}
        onClick={() => onPostClick?.(post)}
        className={`relative rounded-lg border-2 ${isNativeDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300' : approvalTag.card} p-3 mb-2 transition-all duration-200 cursor-grab hover:shadow-md ${
          isDragging ? 'opacity-50 cursor-grabbing' : ''
        } ${isDeletingUpload ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {movingUploadId === post.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg z-10">
            <div className="flex flex-col items-center gap-1.5">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">Moving…</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${approvalTag.className}`}>{approvalTag.label}</span>
            <br />
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-100 text-blue-700">Portal Upload</span>
            {(displayDate || displayTime) && (
              <div className="text-[11px] text-gray-500">
                {displayDate}
                {displayDate && displayTime ? ' • ' : ''}
                {displayTime}
              </div>
            )}
          </div>
          {onToggleCalendarPostSelection && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCalendarPostSelection(post.id); }}
              className={`text-[10px] px-2 py-1 rounded font-semibold border transition-colors ${
                calendarSelectedPostIds?.has(post.id)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              {calendarSelectedPostIds?.has(post.id) ? '✓ Selected' : 'Select'}
            </button>
          )}
        </div>
        {uploadData.file_url && (() => {
          const carouselGroup: any[] = (post.carouselUploads?.length ?? 0) > 1 ? post.carouselUploads : null;
          const activeUpload = carouselGroup ? carouselGroup[imgIndex] ?? carouselGroup[0] : uploadData;
          const activeUrl = activeUpload.file_url || uploadData.file_url;
          const activeType = activeUpload.file_type || uploadData.file_type;
          const total = carouselGroup ? carouselGroup.length : 1;
          return (
            <div className="relative w-full mb-2 rounded overflow-hidden border border-gray-200">
              {activeType?.startsWith('video/') ? (
                <VideoThumbnail src={activeUrl} className="w-full min-h-24" objectFit="cover" />
              ) : (
                <LazyImage src={activeUrl} alt={fileName || 'Client upload'} className="w-full" />
              )}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + total) % total); }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % total); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full z-10">
                    {imgIndex + 1} / {total}
                  </div>
                </>
              )}
            </div>
          );
        })()}
        {(() => {
          const filtered = uploadNotes
            .split('\n')
            .filter(line => !/^\[.*?—.*?—.*?\]:/.test(line))
            .join('\n')
            .trim();
          return filtered ? (
            <p className="text-xs text-gray-600 whitespace-pre-wrap mb-2">{filtered}</p>
          ) : null;
        })()}
        {/* Tags */}
        <div className="relative mt-2 mb-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex flex-wrap gap-1">
              {postTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
            {portalToken && (
              <button
                ref={setTagButtonRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsTagModalOpen(true); }}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title="Add tag"
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {portalToken && isTagModalOpen && (
          <PortalTagDropdown
            isOpen={isTagModalOpen}
            onClose={() => setIsTagModalOpen(false)}
            portalToken={portalToken}
            postId={post.id}
            selectedTagIds={postTags.map(t => t.id)}
            onTagToggle={handleTagToggle}
            position={tagButtonRef ? {
              top: tagButtonRef.getBoundingClientRect().bottom + window.scrollY,
              left: tagButtonRef.getBoundingClientRect().left + window.scrollX,
            } : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-date-key={dateKey}
      style={style}
      {...attributes}
      {...listeners}
      {...nativeDropHandlers}
      onClick={() => onPostClick?.(post)}
      className={`rounded-lg border-2 p-3 mb-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
        isNativeDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300' : isCalendarSelected ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-200/50' : getCardStyling()
      } ${isDragging ? 'opacity-50 scale-105 cursor-grabbing' : ''} ${isEditingTime ? 'opacity-50 bg-purple-50 border-purple-300' : ''}`}
    >
      {/* Header with Date, Status and Select button */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-gray-700">
            {post.scheduled_date ? formatDate(post.scheduled_date) : ''}
          </span>
          {post.scheduled_time && (
            <span className="text-[11px] text-gray-500">
              {formatTime(post.scheduled_time)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {renderApprovalStatusBadge()}
          {onToggleCalendarPostSelection && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCalendarPostSelection(post.id); }}
              className={`text-[10px] px-2 py-1 rounded font-semibold border transition-colors ${
                isCalendarSelected
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              {isCalendarSelected ? '✓ Selected' : 'Select'}
            </button>
          )}
        </div>
        {renderPipelineChips()}
      </div>

      {/* Post Image */}
      {post.image_url && (() => {
        const allMedia: string[] = (post.media_urls?.length ?? 0) > 1 ? post.media_urls : [post.image_url];
        const activeUrl = allMedia[imgIndex] ?? post.image_url;
        const total = allMedia.length;
        return (
          <div className="relative w-full mb-2 rounded overflow-hidden">
            {isVideoUrl(activeUrl) ? (
              <VideoThumbnail src={activeUrl} className="w-full min-h-24" objectFit="cover" />
            ) : (
              <LazyImage src={activeUrl} alt="Post" className="w-full" />
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + total) % total); }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % total); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full z-10">
                  {imgIndex + 1} / {total}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Editable Caption */}
      <div className="mb-3">
        <textarea
          value={captionValue}
          onChange={handleCaptionTextareaChange}
          className="w-full p-2 text-xs border border-gray-300 rounded-md resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 overflow-hidden"
          rows={1}
          onClick={(e) => e.stopPropagation()}
          placeholder="Edit caption..."
          style={{ 
            minHeight: '40px',
            height: 'auto',
            overflow: 'hidden'
          }}
          ref={(textarea) => {
            if (textarea) {
              textarea.style.height = 'auto';
              textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px';
            }
          }}
        />
        {hasCaptionChanged && (
          <p className="text-xs text-blue-600 mt-1 font-medium">✏️ Caption edited</p>
        )}
      </div>

      {/* Post Notes (read-only, from agency) */}
      {post.post_notes && (
        <div className="mt-1 mb-2 mx-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
          <div className="flex items-start gap-1.5">
            <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{post.post_notes}</p>
          </div>
        </div>
      )}

      {/* Client feedback comment */}
      {post.client_feedback && (
        <div className="mt-1 mb-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">Feedback</p>
          <p className="text-xs text-orange-800 whitespace-pre-wrap leading-relaxed">{post.client_feedback}</p>
        </div>
      )}

      {/* Platform */}
      {post.platform && (
        <div className="mt-1 mb-2">
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            {post.platform}
          </span>
        </div>
      )}

      {/* Tags Section */}
      <div className="relative mt-2 mb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-wrap gap-1">
            {postTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
          {portalToken && (
            <button
              ref={setTagButtonRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsTagModalOpen(true); }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Add tag"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Portal Tag Dropdown */}
      {portalToken && isTagModalOpen && (
        <PortalTagDropdown
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          portalToken={portalToken}
          postId={post.id}
          selectedTagIds={postTags.map(t => t.id)}
          onTagToggle={handleTagToggle}
          position={tagButtonRef ? {
            top: tagButtonRef.getBoundingClientRect().bottom + window.scrollY,
            left: tagButtonRef.getBoundingClientRect().left + window.scrollX,
          } : undefined}
        />
      )}
    </div>
  );
}

// Droppable Day Row Component
// Renders one week column's flat entry list (dividers + cards) — mirrors WeekColumnBody in
// ColumnViewCalendar.tsx, adapted for the portal's queue-drop payload format and moving-state
// overlay instead of delete/duplicate/AI caption editing (clients can't do those).
function WeekColumnBody({
  weekStart,
  entries,
  isToday,
  getDayNumber,
  onDrop,
  onQueueItemDrop,
  events,
  onEventAdd,
  onEventClick,
  onAddCardClick,
  onAddButtonDrop,
  onAddNoteForWeek,
  movingToDate,
  dragOverDateKey,
  cardProps,
}: {
  weekStart: Date;
  entries: WeekEntry[];
  isToday: (date: Date) => boolean;
  getDayNumber: (date: Date) => number;
  onDrop?: (e: React.DragEvent, dateKey: string) => void;
  onQueueItemDrop?: (uploadId: string, dateKey: string) => void;
  events: { [key: string]: CalendarEvent[] };
  onEventAdd?: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAddCardClick?: (weekStart: Date) => void;
  onAddButtonDrop?: (e: React.DragEvent, weekStart: Date) => void;
  onAddNoteForWeek?: (weekStart: Date) => void;
  movingToDate?: string | null;
  dragOverDateKey?: string | null;
  cardProps: Omit<React.ComponentProps<typeof SortablePostCard>, 'post' | 'postKey' | 'onNativeDrop'>;
}) {
  const { setNodeRef } = useDroppable({
    id: `week-fallback-${weekStart.toISOString()}`,
    data: { dateKey: null },
  });

  // Prefer the page-level onDrop handler; fall back to onQueueItemDrop's raw dataTransfer
  // payload if the caller didn't wire onDrop (mirrors the old DroppableDayRow's fallback).
  const handleNativeDrop = (e: React.DragEvent, dateKey: string) => {
    if (onDrop) {
      onDrop(e, dateKey);
      return;
    }
    const queueData = e.dataTransfer.getData('text/portal-upload');
    if (queueData) {
      try {
        const upload = JSON.parse(queueData);
        if (upload?.id && onQueueItemDrop) onQueueItemDrop(upload.id, dateKey);
      } catch {
        // ignore
      }
    }
  };

  const postItems = entries
    .filter((entry): entry is Extract<WeekEntry, { type: 'post' }> => entry.type === 'post')
    .map((entry) => `${entry.post.post_type || 'post'}-${entry.post.id}`);

  return (
    <div ref={setNodeRef} className="min-h-[40px]">
      {onAddNoteForWeek && <AddNoteAffordance onClick={() => onAddNoteForWeek(weekStart)} />}
      <SortableContext id={weekStart.toISOString()} items={postItems} strategy={verticalListSortingStrategy}>
        {entries.map((entry) => {
          if (entry.type === 'divider') {
            return (
              <DateDivider
                key={`divider-${entry.dateKey}`}
                dateKey={entry.dateKey}
                dayDate={entry.dayDate}
                dayName={entry.dayName}
                isTodayDay={isToday(entry.dayDate)}
                isDragOver={dragOverDateKey === entry.dateKey}
                getDayNumber={getDayNumber}
                onNativeDrop={handleNativeDrop}
                dayEvents={events[entry.dateKey] ?? []}
                onEventAdd={onEventAdd}
                onEventClick={onEventClick}
              />
            );
          }

          const post = entry.post;
          const postKey = `${post.post_type || 'post'}-${post.id}`;
          const isMovingToThisDate = movingToDate === entry.dateKey;

          return (
            <div key={postKey} className="relative">
              {isMovingToThisDate && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg z-10">
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Loading…</span>
                  </div>
                </div>
              )}
              <SortablePostCard
                post={post}
                postKey={postKey}
                onNativeDrop={handleNativeDrop}
                {...cardProps}
              />
            </div>
          );
        })}
      </SortableContext>
      <div className="mt-1">
        <AddPostCardButton
          onClick={() => onAddCardClick?.(weekStart)}
          onNativeDrop={(e) => onAddButtonDrop?.(e, weekStart)}
        />
      </div>
    </div>
  );
}

export interface PortalCalendarRef {
  navigatePrev: () => void;
  navigateNext: () => void;
}

export const PortalColumnViewCalendar = forwardRef<PortalCalendarRef, PortalColumnViewCalendarProps>(function PortalColumnViewCalendar({
  weeks,
  scheduledPosts,
  clientUploads = {},
  events = {},
  loading = false,
  onPostMove,
  formatWeekCommencing,
  onDrop,
  onQueueItemDrop,
  clientId,
  portalToken,
  handleEditScheduledPost,
  editingPostId,
  setEditingPostId,
  editingTimePostIds,
  formatTimeTo12Hour,
  projects,
  onAddCardClick,
  onAddButtonDrop,
  onAddNoteForWeek,
  selectedPosts,
  onPostSelection,
  comments,
  onCommentChange,
  editedCaptions,
  onCaptionChange,
  onDeleteClientUpload,
  deletingUploadIds,
  onPostClick,
  onEventAdd,
  onEventClick,
  movingToDate,
  movingUploadId,
  calendarSelectedPostIds,
  onToggleCalendarPostSelection,
  onTagsChange,
}, ref) {
  const clientUploadsMap = clientUploads ?? {};
  const VISIBLE_WEEK_COUNT = 10;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [startWeek, setStartWeek] = useState<Date | null>(() => {
    let initial: Date;
    if (weeks.length > 0) {
      initial = new Date(weeks[0]);
      initial.setHours(0, 0, 0, 0);
    } else {
      const today = new Date();
      const currentWeekStart = new Date(today);
      const dayOfWeek = currentWeekStart.getDay();
      const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      currentWeekStart.setDate(diff);
      currentWeekStart.setHours(0, 0, 0, 0);
      initial = currentWeekStart;
    }
    // Start one week earlier to show partial week before
    const adjusted = new Date(initial);
    adjusted.setDate(initial.getDate() - 7);
    return adjusted;
  });
  const hasInitializedStartWeek = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get day name and format date
  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-NZ', { weekday: 'short' });
  };

  const getDayNumber = (date: Date) => {
    return date.getDate();
  };

  // Initialize start week from provided weeks once
  useEffect(() => {
    if (!hasInitializedStartWeek.current && weeks.length > 0) {
      const firstWeek = new Date(weeks[0]);
      firstWeek.setHours(0, 0, 0, 0);
      // Start one week earlier to show partial week before
      const adjusted = new Date(firstWeek);
      adjusted.setDate(firstWeek.getDate() - 7);
      setStartWeek(adjusted);
      hasInitializedStartWeek.current = true;
    }
  }, [weeks]);

  const columns = useMemo(() => {
    if (!startWeek) {
      return [];
    }

    const weekColumns: Array<{ weekStart: Date; entries: WeekEntry[] }> = [];

    for (let weekIndex = 0; weekIndex < VISIBLE_WEEK_COUNT; weekIndex++) {
      const weekStartDate = new Date(startWeek);
      weekStartDate.setDate(startWeek.getDate() + weekIndex * 7);

      const entries: WeekEntry[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + dayIndex);

        const dateKey = dayDate.toLocaleDateString('en-CA');
        const postsForDay = (scheduledPosts[dateKey] || []).map(post => ({
          ...post,
          post_type: post.post_type || 'post',
          scheduled_date: post.scheduled_date || dateKey,
        }));

        const uploadsForDay: ClientUpload[] = clientUploadsMap?.[dateKey] ?? [];

        // Group carousel uploads (same carousel_group_id) into a single card
        const seenCarouselGroups = new Set<string>();
        const uploadEntries: Post[] = [];
        for (const upload of uploadsForDay) {
          if (upload.carousel_group_id) {
            if (seenCarouselGroups.has(upload.carousel_group_id)) continue;
            seenCarouselGroups.add(upload.carousel_group_id);
            const group = uploadsForDay
              .filter((u: ClientUpload) => u.carousel_group_id === upload.carousel_group_id)
              .sort((a: ClientUpload, b: ClientUpload) => (a.carousel_order ?? 0) - (b.carousel_order ?? 0));
            const isImage = typeof group[0].file_type === 'string'
              ? group[0].file_type.startsWith('image/')
              : /\.(png|jpe?g|gif|webp|svg)$/i.test(group[0].file_name || '');
            uploadEntries.push({
              id: group[0].id,
              post_type: 'client-upload',
              caption: group[0].notes || 'Portal Upload',
              image_url: isImage ? group[0].file_url : undefined,
              scheduled_date: dateKey,
              client_upload: group[0],
              isClientUpload: true,
              carouselUploads: group,
              carousel_count: group.length,
            });
          } else {
            const isImage = typeof upload.file_type === 'string'
              ? upload.file_type.startsWith('image/')
              : /\.(png|jpe?g|gif|webp|svg)$/i.test(upload.file_name || '');
            uploadEntries.push({
              id: upload.id,
              post_type: 'client-upload',
              caption: upload.notes || 'Portal Upload',
              image_url: isImage ? upload.file_url : undefined,
              scheduled_date: dateKey,
              client_upload: upload,
              isClientUpload: true,
            });
          }
        }

        const postsForDate = [...postsForDay, ...uploadEntries];
        const hasEvents = (events[dateKey]?.length ?? 0) > 0;

        if (postsForDate.length > 0 || hasEvents) {
          entries.push({ type: 'divider', dateKey, dayDate, dayName: getDayName(dayDate) });
          for (const post of postsForDate) {
            entries.push({ type: 'post', dateKey, post });
          }
        }
      }

      weekColumns.push({
        weekStart: weekStartDate,
        entries,
      });
    }

    return weekColumns;
  }, [startWeek, scheduledPosts, clientUploads, events]);

  const handleDragStart = (event: DragStartEvent) => {
    logger.debug('🔵 ColumnView DragStart:', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setDragOverDay(null);

    logger.debug('🔵 ColumnView DragEnd:', { activeId: active.id, overId: over?.id });

    if (!over || !onPostMove) {
      logger.debug('🔵 No over target or onPostMove handler');
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;

    // Every drop target (a post card, a date divider, or the week-fallback zone) carries its
    // own dateKey via useSortable/useDroppable `data` — no need to re-search the columns.
    const targetDateKey = (over.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;
    const currentDateKey = (active.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;

    if (targetDateKey && targetDateKey !== currentDateKey) {
      if (activeId.startsWith('client-upload-')) {
        const uploadId = activeId.replace('client-upload-', '');
        logger.debug('🔵 Moving portal upload', uploadId, 'to:', targetDateKey);
        onQueueItemDrop?.(uploadId, targetDateKey);
      } else {
        logger.debug('🔵 Moving post from', currentDateKey, 'to:', targetDateKey);
        onPostMove(activeId, targetDateKey);
      }
    } else {
      logger.debug('🔵 No valid target found or same location', { targetDateKey, currentDateKey });
    }

    setActiveId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const targetDateKey = (over?.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;
    setDragOverDay(targetDateKey);
  };

  // Check if a week is the current week
  const isCurrentWeek = (weekStart: Date) => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const weekStartCopy = new Date(weekStart);
    weekStartCopy.setHours(0, 0, 0, 0);
    
    return weekStartCopy.getTime() === currentWeekStart.getTime();
  };

  // Check if a day is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Native drop handler — bypasses React's event delegation (more reliable inside DndContext)
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = calendarContainerRef.current;
    if (!container || !onDrop) return;

    const nativeDragOver = (e: DragEvent) => {
      const target = (e.target as HTMLElement).closest('[data-date-key]');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      }
    };

    const nativeDrop = (e: DragEvent) => {
      const target = (e.target as HTMLElement).closest('[data-date-key]') as HTMLElement | null;
      if (!target) return;
      const dateKey = target.dataset.dateKey;
      if (!dateKey) return;
      e.preventDefault();
      e.stopPropagation();
      onDrop(e as unknown as React.DragEvent<HTMLElement>, dateKey);
    };

    container.addEventListener('dragover', nativeDragOver);
    container.addEventListener('drop', nativeDrop);
    return () => {
      container.removeEventListener('dragover', nativeDragOver);
      container.removeEventListener('drop', nativeDrop);
    };
  }, [onDrop]);

  const handleNavigate = (direction: 'left' | 'right') => {
    setStartWeek((prev) => {
      const base = prev ? new Date(prev) : new Date();
      const deltaDays = direction === 'left' ? -7 : 7;
      base.setDate(base.getDate() + deltaDays);
      base.setHours(0, 0, 0, 0);
      return base;
    });
  };

  useImperativeHandle(ref, () => ({
    navigatePrev: () => handleNavigate('left'),
    navigateNext: () => handleNavigate('right'),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      {/* Relative root — gives absolute children a positioning context */}
      <div style={{position: 'relative', width: '100%'}} ref={calendarContainerRef}>
        {/* Scroll container: block element, natural height (page scrolls vertically), horizontal scroll self-contained */}
        <div
          className="calendar-hscroll"
          style={{overflowX: 'scroll', overflowY: 'visible'}}
        >
        <div style={{display: 'flex', gap: '8px', padding: '16px 8px', width: 'max-content', minWidth: '100%'}}>
          {columns.map((column, index) => {
            const isCurrent = isCurrentWeek(column.weekStart);
            const opacityClass = 'opacity-100';
            
            return (
              <div
                key={column.weekStart.toISOString()}
                data-week-column
                className={`flex-shrink-0 w-80 rounded-lg border-2 border-transparent p-4 transition-all duration-200 ${opacityClass}`}
              >
                {/* Column Header */}
                <div className={`flex items-center justify-center mb-4 pb-2 px-3 py-2 rounded ${isCurrent ? 'bg-blue-900' : 'bg-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white" />
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-white">
                      {formatWeekCommencing(column.weekStart)}
                      {isCurrent && ' (CURRENT)'}
                    </h3>
                  </div>
                </div>

                {/* Flat card list — dividers only for dates with content, "+" to add a card */}
                <WeekColumnBody
                  weekStart={column.weekStart}
                  entries={column.entries}
                  isToday={isToday}
                  getDayNumber={getDayNumber}
                  onDrop={onDrop}
                  onQueueItemDrop={onQueueItemDrop}
                  events={events}
                  onEventAdd={onEventAdd}
                  onEventClick={onEventClick}
                  onAddCardClick={onAddCardClick}
                  onAddButtonDrop={onAddButtonDrop}
                  onAddNoteForWeek={onAddNoteForWeek}
                  movingToDate={movingToDate}
                  dragOverDateKey={dragOverDay}
                  cardProps={{
                    clientId,
                    portalToken,
                    handleEditScheduledPost,
                    editingPostId,
                    setEditingPostId,
                    editingTimePostIds,
                    formatTimeTo12Hour,
                    projects,
                    selectedPosts,
                    onPostSelection,
                    comments,
                    onCommentChange,
                    editedCaptions,
                    onCaptionChange,
                    onDeleteClientUpload,
                    deletingUploadIds,
                    onPostClick,
                    calendarSelectedPostIds,
                    onToggleCalendarPostSelection,
                    onTagsChange,
                    movingUploadId,
                  }}
                />
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white rounded-lg border-2 border-blue-400 p-3 shadow-xl opacity-95 transform rotate-2">
            <div className="text-sm text-gray-600 font-medium">Dragging post...</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

