'use client';

import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Calendar, Clock, ArrowLeft, ArrowRight, Trash2, Loader2, MessageCircle, Copy, Pencil, Check, X, Tag, FileText, CalendarDays, Sparkles } from 'lucide-react';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { isVideoUrl } from '@/lib/videoUtils';
import { type CalendarEvent, EVENT_COLOR_CLASSES } from './CalendarEventModal';
import logger from '@/lib/logger';
import { TagDropdownModal } from '@/components/TagDropdownModal';
import { AddPostCardButton } from '@/components/AddPostCardButton';
import { supabase } from '@/lib/supabaseClient';
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
import { type ContentEvent, EVENT_TYPE_COLORS } from '@/components/EventsCalendarLayer';

function EventIndicatorsInline({ events }: { events: ContentEvent[] }) {
  const visible = events.slice(0, 4);
  const overflow = events.length - 4;
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {visible.map(event => (
        <span
          key={`${event.id}-${event.occurrence_date || event.event_date}`}
          className={`inline-block w-1.5 h-1.5 rounded-full ${EVENT_TYPE_COLORS[event.event_type]} flex-shrink-0`}
          title={event.title}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-gray-400 leading-none">+{overflow}</span>
      )}
    </div>
  );
}

interface ClientUpload {
  id: string;
  file_name?: string;
  file_type?: string;
  file_url?: string;
  notes?: string | null;
  created_at?: string;
  carousel_group_id?: string | null;
  carousel_order?: number | null;
  one_time_approval?: { approval_status: string; client_comments: string | null } | null;
  [key: string]: any;
}

interface PostTag {
  id: string;
  name: string;
  color: string;
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
  tags?: PostTag[];
  [key: string]: any; // Allow additional properties
}

// Trello-style flat card model: a week column renders one entry per date-with-content
// (a "divider" carrying the day header/events) followed by one entry per post scheduled
// that date — instead of a fixed row per calendar day.
type WeekEntry =
  | { type: 'divider'; dateKey: string; dayDate: Date; dayName: string }
  | { type: 'post'; dateKey: string; post: Post };

interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

interface ColumnViewCalendarProps {
  weeks: Date[];
  scheduledPosts: {[key: string]: Post[]};
  clientUploads?: {[key: string]: ClientUpload[]};
  events?: {[key: string]: CalendarEvent[]};
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
  onAddCardClick?: (weekStart: Date) => void;
  onAddButtonDrop?: (e: React.DragEvent, weekStart: Date) => void;
  onAddNoteForWeek?: (weekStart: Date) => void;
  onDeletePost?: (post: Post) => void | Promise<void>;
  onDuplicatePost?: (post: Post) => void | Promise<void>;
  deletingPostIds?: Set<string>;
  duplicatingPostIds?: Set<string>;
  selectedPosts?: Set<string>;
  onTogglePostSelection?: (postId: string) => void;
  deletingUploadIds?: Set<string>;
  onDeleteClientUpload?: (upload: ClientUpload) => void | Promise<void>;
  onUpdateCaption?: (post: Post, newCaption: string) => Promise<void>;
  savingCaptionPostIds?: Set<string>;
  onEventAdd?: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  contentEvents?: Record<string, import('@/components/EventsCalendarLayer').ContentEvent[]>;
  onPostClick?: (post: Post) => void;
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
  onDuplicatePost,
  isDeleting,
  isDuplicating,
  selectedPosts,
  onTogglePostSelection,
  onDeleteClientUpload,
  onUpdateCaption,
  isSavingCaption,
  clientId,
  onPostClick,
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
  onDeletePost?: (post: Post) => void | Promise<void>;
  onDuplicatePost?: (post: Post) => void | Promise<void>;
  isDeleting: boolean;
  isDuplicating: boolean;
  selectedPosts?: Set<string>;
  onTogglePostSelection?: (postId: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void | Promise<void>;
  onUpdateCaption?: (post: Post, newCaption: string) => Promise<void>;
  isSavingCaption: boolean;
  clientId?: string;
  onPostClick?: (post: Post) => void;
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
  } = useSortable({ id: postKey, disabled: isClientUpload, data: { dateKey } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isNativeDragOver, setIsNativeDragOver] = useState(false);
  const nativeDropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsNativeDragOver(true);
    },
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setIsNativeDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      const relatedTarget = e.relatedTarget as Node;
      const currentTarget = e.currentTarget as Node;
      if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
        setIsNativeDragOver(false);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsNativeDragOver(false);
      onNativeDrop?.(e, dateKey);
    },
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

  // Caption editing state
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption || '');
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Tags state — initialise from post data if available to avoid a round-trip fetch
  const [postTags, setPostTags] = useState<Array<{ id: string; name: string; color: string }>>(post.tags ?? []);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagButtonRef, setTagButtonRef] = useState<HTMLButtonElement | null>(null);

  // Reset edited caption when post changes
  useEffect(() => {
    setEditedCaption(post.caption || '');
  }, [post.caption]);

  // Fetch post tags only when not already provided via post data
  useEffect(() => {
    if (post.id && !isClientUpload && !post.tags) {
      fetchPostTags();
    }
  }, [post.id, isClientUpload]);

  const fetchPostTags = async () => {
    if (!post.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/posts/${post.id}/tags`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPostTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching post tags:', error);
    }
  };

  const handleTagToggle = async (tag: { id: string; name: string; color: string }) => {
    if (!post.id) return;

    const isCurrentlySelected = postTags.some(t => t.id === tag.id);

    // Optimistically update UI immediately — the caller (tag dropdown) shows
    // its own pending state while this resolves, but the post card itself
    // should reflect the change right away rather than waiting on the network.
    if (isCurrentlySelected) {
      setPostTags(prev => prev.filter(t => t.id !== tag.id));
    } else {
      setPostTags(prev => [...prev, tag]);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        // Revert optimistic update
        if (isCurrentlySelected) {
          setPostTags(prev => [...prev, tag]);
        } else {
          setPostTags(prev => prev.filter(t => t.id !== tag.id));
        }
        return;
      }

      let response: Response;

      if (isCurrentlySelected) {
        // Remove tag
        response = await fetch(`/api/posts/${post.id}/tags/${tag.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
      } else {
        // Add tag
        response = await fetch(`/api/posts/${post.id}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tag_id: tag.id }),
        });
      }

      if (!response.ok) {
        // Revert optimistic update on error
        await fetchPostTags();
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error toggling tag:', errorData);
        console.error('Response status:', response.status);
        alert(errorData.error || 'Failed to update tag');
        return;
      }
    } catch (error) {
      console.error('Error toggling tag:', error);
      // Revert optimistic update on error
      await fetchPostTags();
      alert('Failed to update tag. Please try again.');
    }
  };

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingCaption && captionTextareaRef.current) {
      captionTextareaRef.current.focus();
      captionTextareaRef.current.select();
    }
  }, [isEditingCaption]);

  const handleSaveCaption = async () => {
    if (!onUpdateCaption) return;
    if (editedCaption === post.caption) {
      setIsEditingCaption(false);
      return;
    }
    await onUpdateCaption(post, editedCaption);
    setIsEditingCaption(false);
  };

  const handleCancelCaptionEdit = () => {
    setEditedCaption(post.caption || '');
    setIsEditingCaption(false);
  };

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
      'needs_attention': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Improve' },
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
    const uploadNotes = uploadData.notes || post.caption || '';
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

    const carouselCount = (post.carousel_count as number | undefined) ?? 0;
    const oneTimeApprovalStatus = uploadData.one_time_approval?.approval_status as string | undefined;
    const approvalTag = (() => {
      if (oneTimeApprovalStatus === 'approved')
        return { label: 'Approved', className: 'bg-green-100 text-green-700' };
      if (oneTimeApprovalStatus === 'rejected')
        return { label: 'Rejected', className: 'bg-red-100 text-red-700' };
      if (oneTimeApprovalStatus === 'needs_attention')
        return { label: 'Improve', className: 'bg-orange-100 text-orange-700' };
      if (oneTimeApprovalStatus === 'pending')
        return { label: 'Pending', className: 'bg-gray-100 text-gray-600' };
      // Fall back to upload status
      const s = uploadData.status as string | undefined;
      if (s === 'completed' || s === 'in_use' || s === 'published')
        return { label: 'In Use', className: 'bg-blue-100 text-blue-700' };
      return { label: 'Pending', className: 'bg-gray-100 text-gray-600' };
    })();

    const filteredNotes = uploadNotes
      .split('\n')
      .filter(line => !/^\[.*?—.*?—.*?\]:/.test(line))
      .join('\n')
      .trim();

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        {...nativeDropHandlers}
        onClick={() => onPostClick?.(post)}
        className={`relative rounded-lg border-2 bg-white p-3 mb-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
          isNativeDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300' : 'border-gray-200'
        } ${isDragging ? 'opacity-50 cursor-grabbing' : ''} ${isDeleting ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
          <div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${approvalTag.className}`}>{approvalTag.label}</span>
            <br />
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-100 text-blue-700">
              Portal Upload
            </span>
            {(displayDate || displayTime) && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                {displayDate}
                {displayDate && displayTime ? ' • ' : ''}
                {displayTime}
              </div>
            )}
          </div>
        </div>
        {uploadData.file_url && (
          <div className="relative w-full mb-2 rounded overflow-hidden border border-gray-200">
            {carouselCount > 1 && (
              <div className="absolute top-1 left-1 z-10 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {carouselCount} images
              </div>
            )}
            {uploadData.file_type?.startsWith('video/') ? (
              <VideoThumbnail src={uploadData.file_url} className="w-full min-h-24" objectFit="cover" />
            ) : (
              <LazyImage src={uploadData.file_url} alt={fileName || 'Client upload'} className="w-full" />
            )}
          </div>
        )}
        {filteredNotes && (
          <p className="text-xs text-gray-600 whitespace-pre-wrap mb-2">{filteredNotes}</p>
        )}
        {(post.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(post.tags as Array<{ id: string; name: string; color: string }>).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
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
      {...nativeDropHandlers}
      onClick={() => onPostClick?.(post)}
      className={`rounded-lg border-2 bg-white overflow-hidden mb-2 shadow-sm hover:shadow-md transition-all duration-200 ${
        isNativeDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300' : 'border-gray-200'
      } ${isDragging ? 'opacity-50 scale-105' : ''} ${isEditingTime ? 'opacity-50 bg-purple-50 border-purple-300' : ''} ${
        isDeleting ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:cursor-grabbing'
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
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-600">
            {post.scheduled_date ? `:: ${formatDate(post.scheduled_date)}` : ''}
          </span>
          {post.source === 'autopilot' && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-semibold leading-none"
              title="AI-generated post"
            >
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
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
          {onDuplicatePost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDuplicating && !isDeleting) {
                  onDuplicatePost(post);
                }
              }}
              className="text-blue-500 hover:text-blue-600 transition-colors"
              title="Duplicate post"
              disabled={isDuplicating || isDeleting}
            >
              {isDuplicating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
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
          {isVideoUrl(post.image_url) ? (
            <VideoThumbnail src={post.image_url} className="w-full min-h-24" objectFit="cover" />
          ) : (
            <LazyImage
              src={post.image_url}
              alt="Post"
              className="w-full"
            />
          )}
        </div>
      )}

      {/* Caption Preview / Edit */}
      <div className="px-2 mb-1">
        {isEditingCaption ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              ref={captionTextareaRef}
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              className="w-full text-xs text-gray-700 p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder="Enter caption..."
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelCaptionEdit();
                }
                // Ctrl/Cmd + Enter to save
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveCaption();
                }
              }}
              disabled={isSavingCaption}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCaption}
                disabled={isSavingCaption}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingCaption ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelCaptionEdit}
                disabled={isSavingCaption}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <p className="text-xs text-gray-700 whitespace-pre-wrap pr-6">
              {post.caption || 'No caption'}
            </p>
            {onUpdateCaption && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingCaption(true);
                }}
                className="absolute top-0 right-0 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                title="Edit caption"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

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

      {/* Tags Section */}
      <div className="relative mt-2 mx-2 mb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Tags Display */}
          <div className="flex-1 flex flex-wrap gap-1 min-h-[24px]">
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
          
          {/* Add Tag Button */}
          {clientId && !isClientUpload && (
            <button
              ref={setTagButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTagModalOpen(true);
              }}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Add tag"
            >
              <Tag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tag Dropdown Modal */}
      {clientId && isTagModalOpen && (
        <TagDropdownModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          clientId={clientId}
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
// Slim date header — rendered only for dates that have posts and/or events, replacing the
// old always-rendered 120px-tall empty day box. Doubles as a native-HTML5 drop target so
// dropping an unscheduled photo directly onto a date with an event (but no posts yet) still
// schedules it there, matching the old per-day drop behavior.
export function DateDivider({
  dateKey,
  dayDate,
  dayName,
  isTodayDay,
  isDragOver = false,
  getDayNumber,
  onNativeDrop,
  dayEvents = [],
  onEventAdd,
  onEventClick,
  contentEventIndicators,
}: {
  dateKey: string;
  dayDate: Date;
  dayName: string;
  isTodayDay: boolean;
  isDragOver?: boolean;
  getDayNumber: (date: Date) => number;
  onNativeDrop?: (e: React.DragEvent, dateKey: string) => void;
  dayEvents?: CalendarEvent[];
  onEventAdd?: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  contentEventIndicators?: import('@/components/EventsCalendarLayer').ContentEvent[];
}) {
  const { setNodeRef } = useDroppable({
    id: `divider-${dateKey}`,
    data: { dateKey },
  });

  const [isNativeDragOver, setIsNativeDragOver] = useState(false);

  return (
    <div
      ref={setNodeRef}
      onDragOver={(e) => { e.preventDefault(); setIsNativeDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setIsNativeDragOver(true); }}
      onDragLeave={(e) => {
        const relatedTarget = e.relatedTarget as Node;
        const currentTarget = e.currentTarget as Node;
        if (!relatedTarget || !currentTarget.contains(relatedTarget)) setIsNativeDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNativeDragOver(false);
        onNativeDrop?.(e, dateKey);
      }}
      className={`mt-3 mb-1.5 pb-1 border-b rounded-t px-1 transition-colors ${
        isNativeDragOver || isDragOver ? 'border-blue-400 bg-blue-50' : isTodayDay ? 'border-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase ${isTodayDay ? 'text-blue-700' : 'text-gray-700'}`}>
            {dayName}
          </span>
          <span className={`text-xs ${isTodayDay ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>
            {getDayNumber(dayDate)}
          </span>
        </div>
        {onEventAdd && (
          <button
            type="button"
            onClick={() => onEventAdd(dateKey)}
            className="px-2 py-0.5 text-xs font-medium text-purple-600 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
            title="Mark event or note"
          >
            Note
          </button>
        )}
      </div>

      {contentEventIndicators && contentEventIndicators.length > 0 && (
        <div className="mt-1">
          <EventIndicatorsInline events={contentEventIndicators} />
        </div>
      )}

      {dayEvents.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {dayEvents.map(evt => {
            const cls = EVENT_COLOR_CLASSES[evt.color] ?? EVENT_COLOR_CLASSES['purple'];
            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => onEventClick?.(evt)}
                className={`w-full text-left px-2 py-0.5 rounded text-xs font-medium truncate border ${cls.bg} ${cls.text} ${cls.border} hover:opacity-80 transition-opacity`}
                title={evt.notes ?? evt.title}
              >
                <span className="inline-flex items-center gap-1">
                  {evt.type === 'note'
                    ? <FileText className="w-2.5 h-2.5 flex-shrink-0" />
                    : <CalendarDays className="w-2.5 h-2.5 flex-shrink-0" />
                  }
                  <span className="truncate">{evt.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Subtle, hover-revealed control for adding a note/event to any day in the week — including
// bare days that render no divider at all. CalendarEventModal's own day-picker (via its
// weekStart prop) resolves which exact date the note ends up on, so this doesn't need to know.
export function AddNoteAffordance({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-1.5 py-1 mb-1 text-gray-300 hover:text-purple-600 transition-colors"
      title="Add a note or event to a day in this week"
    >
      <span className="flex-1 border-t border-dashed border-transparent group-hover:border-purple-200 transition-colors" />
      <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">+ Note</span>
      <span className="flex-1 border-t border-dashed border-transparent group-hover:border-purple-200 transition-colors" />
    </button>
  );
}

// Renders one week column's flat entry list (dividers + cards) inside a week-scoped
// SortableContext, plus a fallback droppable zone so dnd-kit has a valid (no-op) target when
// a card is dropped into empty space rather than onto a specific card/divider.
function WeekColumnBody({
  weekStart,
  entries,
  isToday,
  getDayNumber,
  onDrop,
  events,
  contentEvents,
  onEventAdd,
  onEventClick,
  onAddCardClick,
  onAddButtonDrop,
  onAddNoteForWeek,
  deletingPostIds,
  duplicatingPostIds,
  deletingUploadIds,
  savingCaptionPostIds,
  dragOverDateKey,
  cardProps,
}: {
  weekStart: Date;
  entries: WeekEntry[];
  isToday: (date: Date) => boolean;
  getDayNumber: (date: Date) => number;
  onDrop?: (e: React.DragEvent, dateKey: string) => void;
  events: { [key: string]: CalendarEvent[] };
  contentEvents?: Record<string, import('@/components/EventsCalendarLayer').ContentEvent[]>;
  onEventAdd?: (dateKey: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  dragOverDateKey?: string | null;
  onAddCardClick?: (weekStart: Date) => void;
  onAddButtonDrop?: (e: React.DragEvent, weekStart: Date) => void;
  onAddNoteForWeek?: (weekStart: Date) => void;
  deletingPostIds?: Set<string>;
  duplicatingPostIds?: Set<string>;
  deletingUploadIds?: Set<string>;
  savingCaptionPostIds?: Set<string>;
  cardProps: Omit<React.ComponentProps<typeof SortablePostCard>, 'post' | 'postKey' | 'onNativeDrop' | 'isDeleting' | 'isDuplicating' | 'isSavingCaption'>;
}) {
  const { setNodeRef } = useDroppable({
    id: `week-fallback-${weekStart.toISOString()}`,
    data: { dateKey: null },
  });

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
                onNativeDrop={onDrop}
                dayEvents={events[entry.dateKey] ?? []}
                onEventAdd={onEventAdd}
                onEventClick={onEventClick}
                contentEventIndicators={contentEvents?.[entry.dateKey]}
              />
            );
          }

          const post = entry.post;
          const postKey = `${post.post_type || 'post'}-${post.id}`;
          const isClientUpload =
            post.post_type === 'client-upload' ||
            post.post_type === 'client_upload' ||
            (post as any).isClientUpload;
          const isDeletingPost = deletingPostIds?.has(post.id) || false;
          const isDeletingUpload = deletingUploadIds?.has(post.id) || false;
          const isDeleting = isClientUpload ? isDeletingUpload : isDeletingPost;
          const isDuplicating = duplicatingPostIds?.has(post.id) || false;
          const isSavingCaption = savingCaptionPostIds?.has(post.id) || false;

          return (
            <SortablePostCard
              key={postKey}
              {...cardProps}
              post={post}
              postKey={postKey}
              onNativeDrop={onDrop}
              onDuplicatePost={isClientUpload ? undefined : cardProps.onDuplicatePost}
              onUpdateCaption={isClientUpload ? undefined : cardProps.onUpdateCaption}
              isDeleting={isDeleting}
              isDuplicating={isDuplicating}
              isSavingCaption={isSavingCaption}
            />
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

export interface ColumnViewCalendarHandle {
  navigate: (direction: 'left' | 'right') => void;
}

export const ColumnViewCalendar = forwardRef<ColumnViewCalendarHandle, ColumnViewCalendarProps>(function ColumnViewCalendar({
  weeks,
  scheduledPosts,
  clientUploads = {},
  events = {},
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
  onAddCardClick,
  onAddButtonDrop,
  onAddNoteForWeek,
  onDeletePost,
  onDuplicatePost,
  deletingPostIds,
  duplicatingPostIds,
  selectedPosts,
  onTogglePostSelection,
  deletingUploadIds,
  onDeleteClientUpload,
  onUpdateCaption,
  savingCaptionPostIds,
  onEventAdd,
  onEventClick,
  contentEvents,
  onPostClick,
}: ColumnViewCalendarProps, ref: React.Ref<ColumnViewCalendarHandle>) {
  const clientUploadsMap = clientUploads ?? {};
  const VISIBLE_WEEK_COUNT = 10;
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
              caption: group[0].notes || 'Client Upload',
              image_url: isImage ? group[0].file_url : undefined,
              scheduled_date: dateKey,
              client_upload: group[0],
              isClientUpload: true,
              carouselUploads: group,
              carousel_count: group.length,
              tags: group[0].tags ?? [],
            });
          } else {
            const isImage = typeof upload.file_type === 'string'
              ? upload.file_type.startsWith('image/')
              : /\.(png|jpe?g|gif|webp|svg)$/i.test(upload.file_name || '');
            uploadEntries.push({
              id: upload.id,
              post_type: 'client-upload',
              caption: upload.notes || 'Client Upload',
              image_url: isImage ? upload.file_url : undefined,
              scheduled_date: dateKey,
              client_upload: upload,
              isClientUpload: true,
              tags: upload.tags ?? [],
            });
          }
        }

        const postsForDate = [...postsForDay, ...uploadEntries];
        const hasEvents = (events[dateKey]?.length ?? 0) > 0 || (contentEvents?.[dateKey]?.length ?? 0) > 0;

        // Decluttering: only render a date's header when it actually has something to show.
        // A bare date (no posts, no events) contributes nothing — it's reachable only via the
        // "+" add-card button or the week-wide "Add note" hover affordance.
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
  }, [startWeek, scheduledPosts, clientUploads, events, contentEvents]);

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

    // Every drop target (a post card, a date divider, or the week-fallback zone) carries its
    // own dateKey via useSortable/useDroppable `data` — no need to re-search the columns.
    const targetDateKey = (over.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;
    const currentDateKey = (active.data.current as { dateKey?: string } | undefined)?.dateKey ?? null;

    if (targetDateKey && targetDateKey !== currentDateKey) {
      logger.debug('🔵 Moving post from', currentDateKey, 'to:', targetDateKey);
      onPostMove(activeIdStr, targetDateKey);
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

  const handleNavigate = (direction: 'left' | 'right') => {
    setStartWeek((prev) => {
      const base = new Date(prev);
      const deltaDays = direction === 'left' ? -7 : 7;
      base.setDate(base.getDate() + deltaDays);
      base.setHours(0, 0, 0, 0);
      return base;
    });
  };

  useImperativeHandle(ref, () => ({ navigate: handleNavigate }));

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
      {/* Scroll container fills its parent entirely */}
      <div style={{width: '100%', height: '100%', overflowX: 'scroll', overflowY: 'auto'}} className="calendar-hscroll">
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
                  events={events}
                  contentEvents={contentEvents}
                  onEventAdd={onEventAdd}
                  onEventClick={onEventClick}
                  onAddCardClick={onAddCardClick}
                  onAddButtonDrop={onAddButtonDrop}
                  onAddNoteForWeek={onAddNoteForWeek}
                  deletingPostIds={deletingPostIds}
                  duplicatingPostIds={duplicatingPostIds}
                  deletingUploadIds={deletingUploadIds}
                  savingCaptionPostIds={savingCaptionPostIds}
                  dragOverDateKey={dragOverDay}
                  cardProps={{
                    clientId,
                    handleEditScheduledPost,
                    editingPostId,
                    setEditingPostId,
                    editingTimePostIds,
                    formatTimeTo12Hour,
                    projects,
                    onDeletePost,
                    onDuplicatePost,
                    selectedPosts,
                    onTogglePostSelection,
                    onDeleteClientUpload,
                    onUpdateCaption,
                    onPostClick,
                  }}
                />
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
});

