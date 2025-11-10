'use client';

import { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import { Calendar, Plus, ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, XCircle, Minus, Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface PortalColumnViewCalendarProps {
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
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  comments: {[key: string]: string};
  onCommentChange: (postKey: string, comment: string) => void;
  editedCaptions: {[key: string]: string};
  onCaptionChange: (postKey: string, caption: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
  deletingUploadIds?: Set<string>;
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
          className={`w-full h-auto max-h-32 object-cover rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onError={(e) => {
            e.currentTarget.src = '/api/placeholder/100/100';
          }}
        />
      )}
      {!isLoaded && isInView && (
        <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
      {!isInView && (
        <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
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

  const selectedStatus = selectedPosts[postKey];
  const statusToUse = selectedStatus || post.approval_status;
  const commentValue = comments[postKey] || '';
  const captionValue = Object.prototype.hasOwnProperty.call(editedCaptions, postKey)
    ? editedCaptions[postKey]
    : post.caption || '';
  const hasCaptionChanged = captionValue !== (post.caption || '');
  const isDeletingUpload = isClientUpload ? deletingUploadIds?.has(post.id) ?? false : false;

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
            Needs Attention
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

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-lg border-2 border-blue-300 bg-blue-50 p-3 mb-2 transition-all duration-200 ${
          isDragging ? 'opacity-50' : ''
        } ${isDeletingUpload ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-blue-200">
          <div>
            <span className="text-xs font-semibold uppercase text-blue-700">Client Upload</span>
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
            <LazyImage
              src={post.image_url}
              alt={fileName || 'Client upload'}
              className="w-full"
            />
          </div>
        )}
        {fileName && (
          <p className="text-xs text-blue-700 font-semibold mb-1 break-all">
            File: {fileName}
          </p>
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
            disabled={!onDeleteClientUpload || isDeletingUpload}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border-2 p-3 mb-2 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md ${getCardStyling()} ${
        isDragging ? 'opacity-50 scale-105' : ''
      } ${isEditingTime ? 'opacity-50 bg-purple-50 border-purple-300' : ''}`}
    >
      {/* Header with Date and Status */}
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
        {renderApprovalStatusBadge()}
      </div>

      {/* Post Image */}
      {post.image_url && (
        <div className="w-full mb-2 rounded overflow-hidden">
          <LazyImage
            src={post.image_url}
            alt="Post"
            className="w-full"
          />
        </div>
      )}

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

      {/* Platform */}
      {post.platform && (
        <div className="mt-1 mb-2">
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            {post.platform}
          </span>
        </div>
      )}

      {/* Approval Actions */}
      <div className="mt-2 space-y-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusClick('approved');
            }}
            className={`flex items-center justify-center gap-1 text-xs flex-1 px-2 py-1.5 rounded-md font-medium transition-all duration-200 ${
              statusToUse === 'approved'
                ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-300'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            <CheckCircle className="w-3 h-3" />
            Approve
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusClick('needs_attention');
            }}
            className={`flex items-center justify-center gap-1 text-xs flex-1 px-2 py-1.5 rounded-md font-medium transition-all duration-200 ${
              statusToUse === 'needs_attention'
                ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-300'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Improve
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusClick('rejected');
            }}
            className={`flex items-center justify-center text-xs w-10 h-8 p-0 rounded-md font-medium transition-all duration-200 ${
              statusToUse === 'rejected'
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
            title="Reject"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div>
          <textarea
            value={commentValue}
            onChange={(e) => onCommentChange(postKey, e.target.value)}
            placeholder="Add feedback..."
            className="w-full p-2 text-xs border border-gray-300 rounded-md resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

      </div>
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
  selectedPosts,
  onPostSelection,
  comments,
  onCommentChange,
  editedCaptions,
  onCaptionChange,
  onDeleteClientUpload,
  deletingUploadIds,
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
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  comments: {[key: string]: string};
  onCommentChange: (postKey: string, comment: string) => void;
  editedCaptions: {[key: string]: string};
  onCaptionChange: (postKey: string, caption: string) => void;
  onDeleteClientUpload?: (upload: ClientUpload) => void;
  deletingUploadIds?: Set<string>;
}) {
  const router = useRouter();
  const { setNodeRef } = useDroppable({
    id: dayRow.dateKey,
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
    setIsNativeDragOver(false);
    if (onNativeDragLeave) {
      onNativeDragLeave(e);
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
              <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
            </button>
          ) : (
            dayRow.posts.map((post) => {
              const postKey = `${post.post_type || 'post'}-${post.id}`;
              
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
                  selectedPosts={selectedPosts}
                  onPostSelection={onPostSelection}
                  comments={comments}
                  onCommentChange={onCommentChange}
                  editedCaptions={editedCaptions}
                  onCaptionChange={onCaptionChange}
                  onDeleteClientUpload={onDeleteClientUpload}
                  deletingUploadIds={deletingUploadIds}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function PortalColumnViewCalendar({
  weeks,
  scheduledPosts,
  clientUploads,
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
  selectedPosts,
  onPostSelection,
  comments,
  onCommentChange,
  editedCaptions,
  onCaptionChange,
  onDeleteClientUpload,
  deletingUploadIds,
}: PortalColumnViewCalendarProps) {
  const VISIBLE_WEEK_COUNT = 3;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [startWeek, setStartWeek] = useState<Date | null>(() => {
    if (weeks.length > 0) {
      const initialWeek = new Date(weeks[0]);
      initialWeek.setHours(0, 0, 0, 0);
      return initialWeek;
    }
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
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
      setStartWeek(firstWeek);
      hasInitializedStartWeek.current = true;
    }
  }, [weeks]);

  const columns = useMemo(() => {
    if (!startWeek) {
      return [];
    }

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

        const uploadsForDay = clientUploads?.[dateKey] ?? [];
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
    console.log('🔵 ColumnView DragStart:', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setDragOverDay(null);
    
    console.log('🔵 ColumnView DragEnd:', { activeId: active.id, overId: over?.id });
    
    if (!over || !onPostMove) {
      console.log('🔵 No over target or onPostMove handler');
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    console.log('🔵 Looking for drop target:', { activeId, overId });

    if (activeId.startsWith('client-upload-')) {
      setActiveId(null);
      return;
    }

    // Find which day row the post is being dropped into
    // The overId could be either:
    // 1. A day row dateKey (when dropping on empty area or the droppable container)
    // 2. Another post ID (when dropping on a post in a different day row)
    // 3. A SortableContext id (which is also the dateKey)
    let targetDateKey: string | null = null;
    
    // First, check if overId is directly a day row dateKey (handles both droppable and SortableContext)
    columns.forEach((column) => {
      column.dayRows.forEach((dayRow) => {
        if (dayRow.dateKey === overId) {
          targetDateKey = dayRow.dateKey;
          console.log('🔵 Found target date (direct match):', targetDateKey);
        }
      });
    });

    // If not found, check if overId is a post ID and find which day row it belongs to
    if (!targetDateKey) {
      columns.forEach((column) => {
        column.dayRows.forEach((dayRow) => {
          const postInDay = dayRow.posts.find(post => `${post.post_type || 'post'}-${post.id}` === overId);
          if (postInDay) {
            targetDateKey = dayRow.dateKey;
            console.log('🔵 Found target date (via post):', targetDateKey);
          }
        });
      });
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
      console.log('🔵 Moving post from', currentDateKey, 'to:', targetDateKey);
      onPostMove(activeId, targetDateKey);
    } else {
      console.log('🔵 No valid target found or same location', { targetDateKey, currentDateKey });
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
    columns.forEach((column) => {
      column.dayRows.forEach((dayRow) => {
        if (dayRow.dateKey === overId) {
          targetDateKey = dayRow.dateKey;
        }
      });
    });

    // If not found, check if overId is a post ID and find which day row it belongs to
    if (!targetDateKey) {
      columns.forEach((column) => {
        column.dayRows.forEach((dayRow) => {
          const postInDay = dayRow.posts.find(post => `${post.post_type || 'post'}-${post.id}` === overId);
          if (postInDay) {
            targetDateKey = dayRow.dateKey;
          }
        });
      });
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
      const base = prev ? new Date(prev) : new Date();
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
          className="absolute top-2 left-4 z-10 flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll to previous weeks"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => handleNavigate('right')}
          className="absolute top-2 right-4 z-10 flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll to next weeks"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div
          className="flex justify-center gap-4 overflow-x-hidden pb-4 px-2 pt-14 min-h-screen"
        >
          {columns.map((column) => {
            const isCurrent = isCurrentWeek(column.weekStart);
            
            return (
              <div
                key={column.weekStart.toISOString()}
                data-week-column
                className={`flex-shrink-0 w-80 rounded-lg border-2 p-4 transition-all duration-200 ${
                  isCurrent
                    ? 'border-blue-400 bg-white shadow-md'
                    : 'border-transparent'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`} />
                    <h3 className={`font-semibold text-sm uppercase tracking-wide ${
                      isCurrent ? 'text-blue-800' : 'text-gray-800'
                    }`}>
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
                      selectedPosts={selectedPosts}
                      onPostSelection={onPostSelection}
                      comments={comments}
                      onCommentChange={onCommentChange}
                      editedCaptions={editedCaptions}
                      onCaptionChange={onCaptionChange}
                      onDeleteClientUpload={onDeleteClientUpload}
                      deletingUploadIds={deletingUploadIds}
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

