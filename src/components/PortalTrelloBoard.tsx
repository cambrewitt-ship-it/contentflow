'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Minus, Edit3, Clock, Calendar } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Lazy loading image component for portal calendar
const LazyPortalImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
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
        <>
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-auto max-h-48 object-contain rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isLoaded && (
            <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </>
      )}
      {!isInView && (
        <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

interface Post {
  id: string;
  post_type: string;
  caption: string;
  image_url?: string;
  scheduled_date: string;
  scheduled_time?: string;
  approval_status?: string;
  needs_attention?: boolean;
  client_feedback?: string;
  created_at: string;
  project_id: string;
}

interface PortalTrelloBoardProps {
  weeks: { weekStart: Date | string; weekLabel: string; posts: Post[] }[];
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  comments: {[key: string]: string};
  editedCaptions: {[key: string]: string};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  onCommentChange: (postKey: string, comment: string) => void;
  onCaptionChange: (postKey: string, caption: string) => void;
  onPostMove?: (postKey: string, newWeekIndex: number) => void;
}

// Sortable Card Component
function SortableCard({ 
  post, 
  postKey, 
  selectedStatus, 
  comments, 
  editedCaptions, 
  onPostSelection, 
  onCommentChange, 
  onCaptionChange 
}: {
  post: Post;
  postKey: string;
  selectedStatus: 'approved' | 'rejected' | 'needs_attention' | undefined;
  comments: {[key: string]: string};
  editedCaptions: {[key: string]: string};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  onCommentChange: (postKey: string, comment: string) => void;
  onCaptionChange: (postKey: string, caption: string) => void;
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

  // Helper function to convert 24-hour time to 12-hour format
  const formatTimeTo12Hour = (time24: string) => {
    if (!time24) return '12:00 PM';
    
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

  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-NZ', { weekday: 'short' });
    const dateNum = date.getDate();
    const month = date.toLocaleDateString('en-NZ', { month: 'short' });
    return `${dayName} ${dateNum} ${month}`;
  };

  const isSelected = !!selectedStatus;
  
  // Determine card styling based on approval status
  const getCardStyling = () => {
    const statusToUse = selectedStatus || post.approval_status;
    
    if (statusToUse === 'approved') {
      return 'border-green-400 bg-green-50 shadow-green-200';
    } else if (statusToUse === 'needs_attention') {
      return 'border-orange-400 bg-orange-50 shadow-orange-200';
    } else if (statusToUse === 'rejected') {
      return 'border-red-400 bg-red-50 shadow-red-200';
    } else if (isSelected) {
      return 'border-blue-400 bg-blue-50 shadow-blue-200';
    } else {
      return 'border-gray-200 bg-white hover:border-gray-300';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border-2 p-3 mb-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${getCardStyling()} ${
        isDragging ? 'opacity-50 scale-105' : ''
      }`}
    >
      {/* Approval Status - Top Row */}
      {(selectedStatus || post.approval_status) && (
        <div className="mb-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            (selectedStatus || post.approval_status) === 'approved' ? 'bg-green-200 text-green-800' :
            (selectedStatus || post.approval_status) === 'needs_attention' ? 'bg-orange-200 text-orange-800' :
            (selectedStatus || post.approval_status) === 'rejected' ? 'bg-red-200 text-red-800' :
            'bg-blue-200 text-blue-800'
          }`}>
            {(selectedStatus || post.approval_status) === 'approved' ? '✓ Approved' :
             (selectedStatus || post.approval_status) === 'needs_attention' ? '⚠ Needs Attention' :
             (selectedStatus || post.approval_status) === 'rejected' ? '✗ Rejected' :
             'Selected'}
          </span>
        </div>
      )}

      {/* Date and Time - Below Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(post.scheduled_date)}</span>
        </div>
        
        {post.scheduled_time && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{formatTimeTo12Hour(post.scheduled_time)}</span>
          </div>
        )}
      </div>

      {/* Post Image */}
      {post.image_url && (
        <div className="w-full mb-3 rounded overflow-hidden">
          <LazyPortalImage
            src={post.image_url}
            alt="Post"
            className="w-full h-auto object-contain"
          />
        </div>
      )}

      {/* Caption */}
      <div className="mb-3">
        <p className="text-sm text-gray-700">
          {post.caption}
        </p>
      </div>

      {/* Client Feedback */}
      {post.client_feedback && (
        <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
          <span className="font-medium text-blue-700">Previous feedback:</span>
          <p className="mt-1 text-blue-600">{post.client_feedback}</p>
        </div>
      )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPostSelection(postKey, 'approved');
              }}
              className={`flex items-center justify-center gap-1 text-xs flex-1 px-3 py-2 rounded-md font-medium transition-all duration-200 ${
                (selectedStatus || post.approval_status) === 'approved' 
                  ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-300' 
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              Approve
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPostSelection(postKey, 'needs_attention');
              }}
              className={`flex items-center justify-center gap-1 text-xs flex-1 px-3 py-2 rounded-md font-medium transition-all duration-200 ${
                (selectedStatus || post.approval_status) === 'needs_attention' 
                  ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-300' 
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Improve
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPostSelection(postKey, 'rejected');
              }}
              className={`flex items-center justify-center text-xs w-10 h-8 p-0 rounded-md font-medium transition-all duration-200 ${
                (selectedStatus || post.approval_status) === 'rejected' 
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300' 
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

        {/* Comment Input */}
        <div>
          <textarea
            placeholder="Add feedback..."
            value={comments[postKey] || ''}
            onChange={(e) => onCommentChange(postKey, e.target.value)}
            className="w-full p-2 text-xs border border-gray-300 rounded-md resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Editable Caption */}
        <div>
          <textarea
            value={editedCaptions[postKey] || post.caption}
            onChange={(e) => onCaptionChange(postKey, e.target.value)}
            className="w-full p-2 text-xs border border-gray-300 rounded-md resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
          {editedCaptions[postKey] && 
           editedCaptions[postKey] !== post.caption && (
            <p className="text-xs text-blue-600 mt-1 font-medium">✏️ Caption edited</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PortalTrelloBoard({
  weeks,
  selectedPosts,
  comments,
  editedCaptions,
  onPostSelection,
  onCommentChange,
  onCaptionChange,
  onPostMove
}: PortalTrelloBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columns, setColumns] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Helper function to format week commencing date as "W/C 8th Sept"
  const formatWeekCommencing = (weekStart: Date | string) => {
    const date = weekStart instanceof Date ? weekStart : new Date(weekStart);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-NZ', { month: 'short' });
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                   day === 2 || day === 22 ? 'nd' : 
                   day === 3 || day === 23 ? 'rd' : 'th';
    return `W/C ${day}${suffix} ${month}`;
  };

  // Helper function to check if a week is the current week
  const isCurrentWeek = (weekStart: Date | string) => {
    const date = weekStart instanceof Date ? weekStart : new Date(weekStart);
    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    
    return date.getTime() === startOfCurrentWeek.getTime();
  };

  // Initialize columns based on weeks
  useEffect(() => {
    // Sort weeks with current week first
    const sortedWeeks = [...weeks].sort((a, b) => {
      const dateA = a.weekStart instanceof Date ? a.weekStart : new Date(a.weekStart);
      const dateB = b.weekStart instanceof Date ? b.weekStart : new Date(b.weekStart);
      return dateA.getTime() - dateB.getTime();
    });

    const weekColumns = sortedWeeks.map((week, index) => {
      const weekStart = week.weekStart instanceof Date ? week.weekStart : new Date(week.weekStart);
      const isCurrent = isCurrentWeek(weekStart);
      
      return {
        id: `week-${index}`,
        weekStart: weekStart,
        title: formatWeekCommencing(weekStart),
        posts: week.posts,
        color: isCurrent ? 'bg-blue-50' : 'bg-gray-50',
        borderColor: isCurrent ? 'border-blue-300' : 'border-gray-300',
        count: week.posts.length,
        isCurrent: isCurrent
      };
    });

    setColumns(weekColumns);
  }, [weeks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setDragOverColumn(null);
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which column the post is being dropped into
    const targetColumn = columns.find(col => col.id === overId);
    if (!targetColumn) {
      setActiveId(null);
      return;
    }

    // Find the post being dragged
    const draggedPost = columns
      .flatMap(col => col.posts)
      .find(post => `${post.post_type}-${post.id}` === activeId);

    if (!draggedPost) {
      setActiveId(null);
      return;
    }

    // For week-based columns, we can move posts between weeks
    // Extract the week index from the target column ID
    const weekIndex = parseInt(targetColumn.id.replace('week-', ''));
    
    console.log('📅 Post moved to week:', targetColumn.title, 'Week index:', weekIndex);
    
    // Call the onPostMove callback if provided
    if (onPostMove) {
      onPostMove(activeId, weekIndex);
    }
    
    setActiveId(null);
  };

  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDragOverColumn(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which column we're hovering over
    const targetColumn = columns.find(col => col.id === overId);
    if (targetColumn) {
      setDragOverColumn(targetColumn.id);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 min-h-screen">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 ${column.color} rounded-lg border-2 ${column.borderColor} p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
              dragOverColumn === column.id ? 'ring-2 ring-blue-400 ring-opacity-50 scale-105' : ''
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-300">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-sm uppercase tracking-wide ${
                  column.isCurrent ? 'text-blue-800' : 'text-gray-800'
                }`}>
                  {column.title}
                  {column.isCurrent && ' (Current)'}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  column.isCurrent 
                    ? 'bg-blue-200 text-blue-800' 
                    : 'bg-white text-gray-600'
                }`}>
                  {column.count}
                </span>
              </div>
            </div>

            {/* Posts in Column */}
            <SortableContext
              id={column.id}
              items={column.posts.map((post: any) => `${post.post_type}-${post.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 min-h-96">
                {column.posts.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-gray-400 mb-2">📅</div>
                    <div>No posts scheduled for this week</div>
                  </div>
                ) : (
                  column.posts.map((post) => {
                    const postKey = `${post.post_type}-${post.id}`;
                    const selectedStatus = selectedPosts[postKey];
                    
                    return (
                      <SortableCard
                        key={postKey}
                        post={post}
                        postKey={postKey}
                        selectedStatus={selectedStatus}
                        comments={comments}
                        editedCaptions={editedCaptions}
                        onPostSelection={onPostSelection}
                        onCommentChange={onCommentChange}
                        onCaptionChange={onCaptionChange}
                      />
                    );
                  })
                )}
              </div>
            </SortableContext>
          </div>
        ))}
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
