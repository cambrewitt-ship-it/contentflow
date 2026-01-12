'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, Plus, ArrowLeft, ArrowRight, Trash2, Loader2, MessageCircle, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import logger from '@/lib/logger';
import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  ThreadsIcon 
} from '@/components/social-icons';
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

interface DayRow {
  dayName: string;
  dayDate: Date;
  dateKey: string;
  posts: Post[];
}

interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

interface ColumnViewCalendarProps {
  weeks: Date[];
  scheduledPosts: {[key: string]: Post[]};
  clientUploads?: {[key: string]: ClientUpload[]};
  loading?: boolean;
  onPostMove?: (postKey: string, newDate: string) => void;
  onDateClick?: (date: Date) => void;
  formatWeekCommencing: (weekStart: Date) => string;
  onDrop?: (e: React.DragEvent, dateKey: string) => void;
  clientId?: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
  onAddUploadClick?: (dateKey: string) => void;
  onDeletePost?: (post: Post) => void;
  deletingPostIds?: Set<string>;
  selectedPosts?: Set<string>;
  onTogglePostSelection?: (postId: string) => void;
  deletingUploadIds?: Set<string>;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
}

const normalizeToWeekStart = (input: Date) => {
  const date = new Date(input);
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Helper to get platform icon
const getPlatformIcon = (platform: string, size: number = 14) => {
  const normalizedPlatform = platform.toLowerCase();
  
  switch (normalizedPlatform) {
    case 'facebook':
      return <FacebookIcon size={size} className="text-white" />;
    case 'instagram':
      return <InstagramIcon size={size} className="text-white" />;
    case 'twitter':
    case 'x':
      return <TwitterIcon size={size} className="text-white" />;
    case 'linkedin':
      return <LinkedInIcon size={size} className="text-white" />;
    case 'tiktok':
      return <TikTokIcon size={size} className="text-white" />;
    case 'youtube':
      return <YouTubeIcon size={size} className="text-white" />;
    case 'threads':
      return <ThreadsIcon size={size} className="text-white" />;
    default:
      return null;
  }
};

const computeInitialStartWeek = (weekDates: Date[]) => {
  const currentWeekStart = normalizeToWeekStart(new Date());

  if (weekDates.length === 0) {
    return currentWeekStart;
  }

  const normalizedWeekDates = weekDates.map((week) =>
    normalizeToWeekStart(new Date(week))
  );

  const exactMatch = normalizedWeekDates.find(
    (week) => week.getTime() === currentWeekStart.getTime()
  );
  if (exactMatch) {
    return exactMatch;
  }

  const sortedWeeks = [...normalizedWeekDates].sort(
    (a, b) => a.getTime() - b.getTime()
  );
  const closestPastWeek = sortedWeeks
    .filter((week) => week.getTime() <= currentWeekStart.getTime())
    .pop();

  return closestPastWeek || sortedWeeks[0] || currentWeekStart;
};

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
  onDeletePost,
  isDeleting,
  selectedPosts,
  onTogglePostSelection,
  onDeleteClientUpload,
}: {
  post: Post;
  postKey: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
  onDeletePost?: (post: Post) => void;
  isDeleting: boolean;
  selectedPosts?: Set<string>;
  onTogglePostSelection?: (postId: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
}) {
  const isClientUpload =
    post.post_type === 'client-upload' ||
    post.post_type === 'client_upload' ||
    post.isClientUpload;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: postKey, disabled: isClientUpload });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Use passed formatTimeTo12Hour or fallback to local function
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
  const isSelected = selectedPosts?.has(post.id) ?? false;
  const approvalComment =
    post.client_feedback ||
    post.client_comments ||
    post.approval?.client_comments ||
    post.approval_comment ||
    null;

  // Helper function to format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  };

  // Get status tag styling
  const getStatusTag = () => {
    if (!post.approval_status) return null;
    
    const statusConfig = {
      'approved': { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      'rejected': { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
      'needs_attention': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Needs Attention' },
      'pending': { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Pending' },
      'draft': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    };
    
    const config = statusConfig[post.approval_status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
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

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-lg border-2 border-blue-300 bg-blue-50 p-3 mb-2 shadow-sm ${
          isDragging ? 'opacity-50' : ''
        } ${isDeleting ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-blue-200">
          <div>
            <div className="text-xs font-semibold text-blue-700 uppercase">Client Upload</div>
            {(displayDate || displayTime) && (
              <div className="text-[11px] text-blue-600">
                {displayDate}
                {displayDate && displayTime ? ' • ' : ''}
                {displayTime}
              </div>
            )}
          </div>
        </div>
        {post.image_url && (
          <div className="w-full mb-2 rounded overflow-hidden border border-blue-200">
            <LazyImage src={post.image_url} alt={fileName || 'Client upload'} className="w-full" />
          </div>
        )}
        {fileName && (
          <p className="text-xs text-blue-700 font-medium mb-1 break-all">File: {fileName}</p>
        )}
        {uploadNotes && (
          <p className="text-xs text-blue-700 whitespace-pre-wrap">{uploadNotes}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {uploadData.file_url && (
            <a
              href={uploadData.file_url}
              download={fileName || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          )}
          <button
            type="button"
            onClick={() => onDeleteClientUpload?.(uploadData)}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            disabled={!onDeleteClientUpload || isDeleting}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    );
  }

  // Check if this post is published
  const isPublished = post.late_status === 'published' || 
                     (post.platforms_scheduled && post.platforms_scheduled.length > 0);
  
  const publishedPlatforms: string[] = [];
  if (isPublished && post.platforms_scheduled) {
    post.platforms_scheduled.forEach((platform: string) => {
      publishedPlatforms.push(platform.toLowerCase());
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border-2 border-gray-200 bg-white overflow-hidden mb-2 shadow-sm hover:shadow-md transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-105' : ''
      } ${isEditingTime ? 'opacity-50 bg-purple-50 border-purple-300' : ''} ${
        isDeleting ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-grab active:cursor-grabbing'
      } ${isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : ''}`}
    >
      {/* Published Indicator Bar */}
      {isPublished && publishedPlatforms.length > 0 && (
        <div className="bg-green-500 px-3 py-1.5 flex items-center gap-2">
          <span className="text-white text-xs font-bold tracking-wide">PUBLISHED</span>
          <div className="flex items-center gap-1.5">
            {publishedPlatforms.map((platform, index) => (
              <div key={`${platform}-${index}`} className="flex items-center">
                {getPlatformIcon(platform, 14)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header with Date and Status */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200 p-2">
        <div className="text-xs text-gray-600">
          {post.scheduled_date ? `:: ${formatDate(post.scheduled_date)}` : ''}
        </div>
        <div className="flex items-center gap-2">
          {onTogglePostSelection && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePostSelection(post.id);
              }}
              disabled={isDeleting}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title={isSelected ? "Deselect post" : "Select post for scheduling or deletion"}
            >
              {isSelected ? 'Selected' : 'Select'}
            </button>
          )}
          {getStatusTag()}
          {onDeletePost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDeleting) {
                  onDeletePost(post);
                }
              }}
              className="text-red-500 hover:text-red-600 transition-colors"
              title="Delete post"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Post Image */}
      {post.image_url && (
        <div className="w-full mb-2 rounded overflow-hidden px-2">
          <LazyImage
            src={post.image_url}
            alt="Post"
            className="w-full"
          />
        </div>
      )}

      {/* Caption Preview */}
      <p className="text-xs text-gray-700 whitespace-pre-wrap mb-1 px-2">
        {post.caption || 'No caption'}
      </p>

      {/* Time and Project - Editable */}
      {post.scheduled_time && (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-2 pb-2">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isEditing ? (
              <input
                type="time"
                defaultValue={post.scheduled_time?.slice(0, 5) || '12:00'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (handleEditScheduledPost && setEditingPostId) {
                      handleEditScheduledPost(post, e.currentTarget.value);
                      setEditingPostId(null);
                    }
                  }
                  if (e.key === 'Escape') {
                    if (setEditingPostId) {
                      setEditingPostId(null);
                    }
                  }
                }}
                onBlur={(e) => {
                  if (handleEditScheduledPost && setEditingPostId) {
                    handleEditScheduledPost(post, e.target.value);
                    setEditingPostId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs p-1 rounded border bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            ) : isEditingTime ? (
              <span className="text-purple-600">Updating time...</span>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (setEditingPostId) {
                    setEditingPostId(post.id);
                  }
                }}
                className="cursor-pointer bg-white border border-gray-300 rounded px-2 py-1 hover:border-blue-500 hover:text-blue-600"
                title="Click to edit time"
              >
                {formatTime(post.scheduled_time)}
              </span>
            )}
          </div>
          {post.project_id && projects && projects.find(p => p.id === post.project_id) && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
              {projects.find(p => p.id === post.project_id)?.name}
            </span>
          )}
        </div>
      )}

      {/* Platform */}
      {post.platform && (
        <div className="mt-1 px-2">
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            {post.platform}
          </span>
        </div>
      )}

      {/* Approval Comment */}
      {approvalComment && (
        <div className="mt-2 mx-2 mb-2 rounded-md border border-blue-100 bg-blue-50 p-2">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 whitespace-pre-wrap">
              {approvalComment}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Droppable Day Row Component
function DroppableDayRow({
  dayRow,
  isTodayDay,
  isDragOver,
  getDayNumber,
  onNativeDrop,
  onNativeDragOver,
  onNativeDragEnter,
  onNativeDragLeave,
  clientId,
  handleEditScheduledPost,
  editingPostId,
  setEditingPostId,
  editingTimePostIds,
  formatTimeTo12Hour,
  projects,
  onAddUploadClick,
  onDeletePost,
  deletingPostIds,
  deletingUploadIds,
  selectedPosts,
  onTogglePostSelection,
  onDeleteClientUpload,
  isCurrentWeek,
}: {
  dayRow: DayRow;
  isTodayDay: boolean;
  isDragOver: boolean;
  getDayNumber: (date: Date) => number;
  onNativeDrop?: (e: React.DragEvent, dateKey: string) => void;
  onNativeDragOver?: (e: React.DragEvent) => void;
  onNativeDragEnter?: (e: React.DragEvent) => void;
  onNativeDragLeave?: (e: React.DragEvent) => void;
  clientId?: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
  onAddUploadClick?: (dateKey: string) => void;
  onDeletePost?: (post: Post) => void;
  deletingPostIds?: Set<string>;
  deletingUploadIds?: Set<string>;
  selectedPosts?: Set<string>;
  onTogglePostSelection?: (postId: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
  isCurrentWeek?: boolean;
}) {
  const router = useRouter();
  const { setNodeRef } = useDroppable({
    id: dayRow.dateKey,
    data: {
      dateKey: dayRow.dateKey,
      dayDate: dayRow.dayDate,
    },
  });

  const [isNativeDragOver, setIsNativeDragOver] = useState(false);

  const handleNativeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(true);
    if (onNativeDragOver) {
      onNativeDragOver(e);
    }
  };

  const handleNativeDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(true);
    if (onNativeDragEnter) {
      onNativeDragEnter(e);
    }
  };

  const handleNativeDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drag-over state if we're actually leaving the container
    // (not just entering a child element)
    const relatedTarget = e.relatedTarget as Node;
    const currentTarget = e.currentTarget as Node;
    
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setIsNativeDragOver(false);
      if (onNativeDragLeave) {
        onNativeDragLeave(e);
      }
    }
  };

  const handleNativeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(false);
    if (onNativeDrop) {
      onNativeDrop(e, dayRow.dateKey);
    }
  };

  return (
    <div
      ref={setNodeRef}
      onDrop={handleNativeDrop}
      onDragOver={handleNativeDragOver}
      onDragEnter={handleNativeDragEnter}
      onDragLeave={handleNativeDragLeave}
      className={`rounded-lg border-2 p-3 min-h-[120px] transition-all duration-200 ${
        isDragOver || isNativeDragOver
          ? 'border-blue-400 bg-blue-100 ring-2 ring-blue-300' 
          : isTodayDay
          ? 'border-blue-300 bg-blue-50'
          : isCurrentWeek
          ? 'border-gray-200 bg-gray-100'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase ${
            isTodayDay ? 'text-blue-700' : 'text-gray-700'
          }`}>
            {dayRow.dayName}
          </span>
          <span className={`text-xs ${
            isTodayDay ? 'text-blue-600 font-bold' : 'text-gray-600'
          }`}>
            {getDayNumber(dayRow.dayDate)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onAddUploadClick) {
              onAddUploadClick(dayRow.dateKey);
            } else if (clientId) {
              router.push(`/dashboard/client/${clientId}/content-suite?scheduledDate=${dayRow.dateKey}`);
            }
          }}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          aria-label="Add upload"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Posts in Day Row */}
      <SortableContext
        id={dayRow.dateKey}
        items={dayRow.posts.map((post) => `${post.post_type || 'post'}-${post.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[60px]">
          {dayRow.posts.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                if (onAddUploadClick) {
                  onAddUploadClick(dayRow.dateKey);
                } else if (clientId) {
                  router.push(`/dashboard/client/${clientId}/content-suite?scheduledDate=${dayRow.dateKey}`);
                }
              }}
              className="w-full flex items-center justify-center py-4 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-blue-600">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Upload Content</span>
              </div>
            </button>
          ) : (
            dayRow.posts.map((post) => {
              const postKey = `${post.post_type || 'post'}-${post.id}`;
              const isClientUpload =
                post.post_type === 'client-upload' ||
                post.post_type === 'client_upload' ||
                (post as any).isClientUpload;
              const isDeletingPost = deletingPostIds?.has(post.id) || false;
              const isDeletingUpload = deletingUploadIds?.has(post.id) || false;
              const isDeleting = isClientUpload ? isDeletingUpload : isDeletingPost;
              
              return (
                <SortablePostCard
                  key={postKey}
                  post={post}
                  postKey={postKey}
                  handleEditScheduledPost={handleEditScheduledPost}
                  editingPostId={editingPostId}
                  setEditingPostId={setEditingPostId}
                  editingTimePostIds={editingTimePostIds}
                  formatTimeTo12Hour={formatTimeTo12Hour}
                  projects={projects}
                  onDeletePost={onDeletePost}
                  isDeleting={isDeleting}
                  selectedPosts={selectedPosts}
                  onTogglePostSelection={onTogglePostSelection}
                  onDeleteClientUpload={onDeleteClientUpload}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ColumnViewCalendar({
  weeks,
  scheduledPosts,
  clientUploads = {},
  loading = false,
  onPostMove,
  formatWeekCommencing,
  onDrop,
  clientId,
  handleEditScheduledPost,
  editingPostId,
  setEditingPostId,
  editingTimePostIds,
  formatTimeTo12Hour,
  projects,
  onAddUploadClick,
  onDeletePost,
  deletingPostIds,
  selectedPosts,
  onTogglePostSelection,
  deletingUploadIds,
  onDeleteClientUpload,
}: ColumnViewCalendarProps) {
  const clientUploadsMap = clientUploads ?? {};
  const VISIBLE_WEEK_COUNT = 5; // Show 5 weeks: 1 partial before, 3 main, 1 partial after
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [startWeek, setStartWeek] = useState<Date>(() => {
    const initial = computeInitialStartWeek(weeks);
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
      const initial = computeInitialStartWeek(weeks);
      // Start one week earlier to show partial week before
      const adjusted = new Date(initial);
      adjusted.setDate(initial.getDate() - 7);
      setStartWeek(adjusted);
      hasInitializedStartWeek.current = true;
    }
  }, [weeks]);

  const columns = useMemo(() => {
    const weekColumns: Array<{weekStart: Date; dayRows: DayRow[]}> = [];

    for (let weekIndex = 0; weekIndex < VISIBLE_WEEK_COUNT; weekIndex++) {
      const weekStartDate = new Date(startWeek);
      weekStartDate.setDate(startWeek.getDate() + weekIndex * 7);

      const dayRows: DayRow[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + dayIndex);

        const dateKey = dayDate.toLocaleDateString('en-CA');
        const postsForDay = (scheduledPosts[dateKey] || []).map(post => ({
          ...post,
          post_type: post.post_type || 'post',
          scheduled_date: post.scheduled_date || dateKey,
        }));

        const uploadsForDay = clientUploadsMap?.[dateKey] ?? [];
        const uploadEntries = uploadsForDay.map((upload: ClientUpload) => {
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
            client_upload: upload,
            isClientUpload: true,
          };
        });

        dayRows.push({
          dayName: getDayName(dayDate),
          dayDate,
          dateKey,
          posts: [...postsForDay, ...uploadEntries],
        });
      }

      weekColumns.push({
        weekStart: weekStartDate,
        dayRows,
      });
    }

    return weekColumns;
  }, [startWeek, scheduledPosts, clientUploads]);

  const handleDragStart = (event: DragStartEvent) => {
    logger.debug('🔵 ColumnView DragStart:', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setDragOverDay(null);
    
    logger.debug('🔵 ColumnView DragEnd:', { activeId: active.id, overId: over?.id });

    const activeIdStr = String(active.id);
    if (activeIdStr.startsWith('client-upload-')) {
      setActiveId(null);
      return;
    }

    if (!over || !onPostMove) {
      logger.debug('🔵 No over target or onPostMove handler');
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    logger.debug('🔵 Looking for drop target:', { activeId, overId });

    // Find which day row the post is being dropped into
    // The overId could be either:
    // 1. A day row dateKey (when dropping on empty area or the droppable container)
    // 2. Another post ID (when dropping on a post in a different day row)
    // 3. A SortableContext id (which is also the dateKey)
    let targetDateKey: string | null = null;
    
    // First, check if overId is directly a day row dateKey (handles both droppable and SortableContext)
    // Break early when found to avoid overwriting with wrong matches
    outerLoop: for (const column of columns) {
      for (const dayRow of column.dayRows) {
        if (dayRow.dateKey === overId) {
          targetDateKey = dayRow.dateKey;
          logger.debug('🔵 Found target date (direct match):', targetDateKey);
          break outerLoop;
        }
      }
    }

    // If not found, check if overId is a post ID and find which day row it belongs to
    // Break early when found to avoid overwriting with wrong matches
    if (!targetDateKey) {
      outerLoop2: for (const column of columns) {
        for (const dayRow of column.dayRows) {
          const postInDay = dayRow.posts.find(post => `${post.post_type || 'post'}-${post.id}` === overId);
          if (postInDay) {
            targetDateKey = dayRow.dateKey;
            logger.debug('🔵 Found target date (via post):', targetDateKey);
            break outerLoop2;
          }
        }
      }
    }
    
    // Additional validation: if we still don't have a target, check if over.data contains dateKey
    if (!targetDateKey && over.data.current) {
      const data = over.data.current as any;
      if (data.dateKey && typeof data.dateKey === 'string') {
        // Validate that this dateKey actually exists in our columns
        for (const column of columns) {
          for (const dayRow of column.dayRows) {
            if (dayRow.dateKey === data.dateKey) {
              targetDateKey = data.dateKey;
              logger.debug('🔵 Found target date (via data):', targetDateKey);
              break;
            }
          }
        }
      }
    }

    // Get the current post's date to avoid moving to the same location
    let currentDateKey: string | null = null;
    columns.forEach((column) => {
      column.dayRows.forEach((dayRow) => {
        const postInDay = dayRow.posts.find(post => `${post.post_type || 'post'}-${post.id}` === activeId);
        if (postInDay) {
          currentDateKey = dayRow.dateKey;
        }
      });
    });

    if (targetDateKey && targetDateKey !== currentDateKey) {
      logger.debug('🔵 Moving post from', currentDateKey, 'to:', targetDateKey);
      onPostMove(activeId, targetDateKey);
    } else {
      logger.debug('🔵 No valid target found or same location', { targetDateKey, currentDateKey });
    }
    
    setActiveId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    
    if (!over) {
      setDragOverDay(null);
      return;
    }

    const overId = over.id as string;
    
    // Find which day row this corresponds to
    let targetDateKey: string | null = null;
    
    // Check if overId is directly a day row dateKey
    // Break early when found to avoid overwriting with wrong matches
    outerLoop: for (const column of columns) {
      for (const dayRow of column.dayRows) {
        if (dayRow.dateKey === overId) {
          targetDateKey = dayRow.dateKey;
          break outerLoop;
        }
      }
    }

    // If not found, check if overId is a post ID and find which day row it belongs to
    // Break early when found to avoid overwriting with wrong matches
    if (!targetDateKey) {
      outerLoop2: for (const column of columns) {
        for (const dayRow of column.dayRows) {
          const postInDay = dayRow.posts.find(post => `${post.post_type || 'post'}-${post.id}` === overId);
          if (postInDay) {
            targetDateKey = dayRow.dateKey;
            break outerLoop2;
          }
        }
      }
    }
    
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleNavigate = (direction: 'left' | 'right') => {
    setStartWeek((prev) => {
      const base = new Date(prev);
      const deltaDays = direction === 'left' ? -7 : 7;
      base.setDate(base.getDate() + deltaDays);
      base.setHours(0, 0, 0, 0);
      return base;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => handleNavigate('left')}
          className="absolute -top-[4.75rem] left-4 z-10 flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll to previous weeks"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => handleNavigate('right')}
          className="absolute -top-[4.75rem] right-4 z-10 flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll to next weeks"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div
          className="flex justify-center gap-2 overflow-x-clip pb-4 px-2 pt-4 min-h-screen max-w-[1312px] mx-auto"
        >
          {columns.map((column, index) => {
            const isCurrent = isCurrentWeek(column.weekStart);
            const isEdgeColumn = index === 0 || index === columns.length - 1;
            const opacityClass = isEdgeColumn ? 'opacity-40' : 'opacity-100';
            
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

                {/* Day Rows */}
                <div className="space-y-3">
                  {column.dayRows.map((dayRow) => {
                    const isTodayDay = isToday(dayRow.dayDate);
                    const isDragOver = dragOverDay === dayRow.dateKey;
                    
                    return (
                      <DroppableDayRow
                        key={dayRow.dateKey}
                        dayRow={dayRow}
                        isTodayDay={isTodayDay}
                        isDragOver={isDragOver}
                        getDayNumber={getDayNumber}
                        onNativeDrop={onDrop}
                        clientId={clientId}
                        handleEditScheduledPost={handleEditScheduledPost}
                        editingPostId={editingPostId}
                        setEditingPostId={setEditingPostId}
                        editingTimePostIds={editingTimePostIds}
                        formatTimeTo12Hour={formatTimeTo12Hour}
                        projects={projects}
                        onAddUploadClick={onAddUploadClick}
                        onDeletePost={onDeletePost}
                        deletingPostIds={deletingPostIds}
                        deletingUploadIds={deletingUploadIds}
                        selectedPosts={selectedPosts}
                        onTogglePostSelection={onTogglePostSelection}
                        onDeleteClientUpload={onDeleteClientUpload}
                        isCurrentWeek={isCurrent}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white rounded-lg border-2 border-blue-400 p-3 shadow-xl opacity-95 transform rotate-2">
            <div className="text-sm text-gray-600 font-medium">📝 Dragging post...</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

