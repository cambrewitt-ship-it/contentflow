'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';
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
  clientUploads?: {[key: string]: any[]};
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
  projects
}: {
  post: Post;
  postKey: string;
  handleEditScheduledPost?: (post: any, newTime: string) => Promise<void>;
  editingPostId?: string | null;
  setEditingPostId?: (postId: string | null) => void;
  editingTimePostIds?: Set<string>;
  formatTimeTo12Hour?: (time24: string) => string;
  projects?: Project[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: postKey });

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
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      'draft': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    };
    
    const config = statusConfig[post.approval_status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border-2 border-gray-200 bg-white p-2 mb-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-105' : ''
      } ${isEditingTime ? 'opacity-50 bg-purple-50 border-purple-300' : ''}`}
    >
      {/* Header with Date and Status */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
        <div className="text-xs text-gray-600">
          {post.scheduled_date ? formatDate(post.scheduled_date) : ''}
        </div>
        {getStatusTag()}
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

      {/* Caption Preview */}
      <p className="text-xs text-gray-700 line-clamp-2 mb-1">
        {post.caption || 'No caption'}
      </p>

      {/* Time and Project - Editable */}
      {post.scheduled_time && (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
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
        <div className="mt-1">
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
            {post.platform}
          </span>
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
  projects
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
      </div>

      {/* Posts in Day Row */}
      <SortableContext
        id={dayRow.dateKey}
        items={dayRow.posts.map((post) => `${post.post_type || 'post'}-${post.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 max-h-[400px] overflow-y-auto min-h-[60px]">
          {dayRow.posts.length === 0 ? (
            <button
              onClick={() => {
                if (clientId) {
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
  projects
}: ColumnViewCalendarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [columns, setColumns] = useState<Array<{weekStart: Date; dayRows: DayRow[]}>>([]);

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

  // Initialize columns with day rows
  useEffect(() => {
    const weekColumns = weeks.map((weekStart) => {
      const dayRows: DayRow[] = [];
      
      // Create 7 day rows (Mon-Sun)
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        
        const dateKey = dayDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        const postsForDay = (scheduledPosts[dateKey] || []).map(post => ({
          ...post,
          post_type: post.post_type || 'post',
          scheduled_date: post.scheduled_date || dateKey
        }));
        
        dayRows.push({
          dayName: getDayName(dayDate),
          dayDate: dayDate,
          dateKey: dateKey,
          posts: postsForDay,
        });
      }
      
      return {
        weekStart: weekStart,
        dayRows: dayRows,
      };
    });
    
    setColumns(weekColumns);
  }, [weeks, scheduledPosts]);

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 min-h-screen">
        {columns.map((column, columnIndex) => {
          const isCurrent = isCurrentWeek(column.weekStart);
          
          return (
            <div
              key={columnIndex}
              className={`flex-shrink-0 w-80 rounded-lg border-2 border-transparent p-4 transition-all duration-200`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`} />
                  <h3 className={`font-semibold text-sm uppercase tracking-wide ${
                    isCurrent ? 'text-blue-800' : 'text-gray-800'
                  }`}>
                    {formatWeekCommencing(column.weekStart)}
                    {isCurrent && ' (Current)'}
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
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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

