'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Minus, Edit3 } from 'lucide-react';

// Lazy loading media component for portal calendar (supports images and videos)
const LazyPortalImage = ({ 
  src, 
  alt, 
  className, 
  mediaType 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
  mediaType?: 'image' | 'video' | 'unknown';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Auto-detect media type if not specified
  const detectedMediaType = mediaType === 'unknown' || !mediaType
    ? (src.match(/\.(mp4|mov|avi|webm|mpeg)(\?|$)/i) || src.startsWith('data:video/') ? 'video' : 'image')
    : mediaType;

  const isVideo = detectedMediaType === 'video';

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

    if (mediaRef.current) {
      observer.observe(mediaRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={mediaRef} className={className}>
      {isInView && (
        <>
          {isVideo ? (
            <video
              src={src}
              controls
              muted
              playsInline
              preload="metadata"
              onLoadedData={() => setIsLoaded(true)}
              className={`w-full h-auto max-h-96 object-contain rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            >
              <p>Your browser doesn&apos;t support HTML5 video.</p>
            </video>
          ) : (
            <img
              src={src}
              alt={alt}
              onLoad={() => setIsLoaded(true)}
              className={`w-full h-auto max-h-96 object-contain rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {!isLoaded && (
            <div className="w-full h-48 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </>
      )}
      {!isInView && (
        <div className="w-full h-48 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

interface WeekData {
  weekStart: Date | string;
  weekLabel: string;
  posts: any[];
}

interface PortalKanbanCalendarProps {
  weeks: WeekData[];
  selectedPosts: {[key: string]: 'approved' | 'rejected' | 'needs_attention'};
  comments: {[key: string]: string};
  editedCaptions: {[key: string]: string};
  onPostSelection: (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => void;
  onCommentChange: (postKey: string, comment: string) => void;
  onCaptionChange: (postKey: string, caption: string) => void;
}

export function PortalKanbanCalendar({
  weeks,
  selectedPosts,
  comments,
  editedCaptions,
  onPostSelection,
  onCommentChange,
  onCaptionChange
}: PortalKanbanCalendarProps) {
  
  // Helper function to format week commencing date as "W/C 8th Sept"
  const formatWeekCommencing = (weekStart: Date | string) => {
    // Ensure we have a Date object
    const date = weekStart instanceof Date ? weekStart : new Date(weekStart);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-NZ', { month: 'short' });
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                   day === 2 || day === 22 ? 'nd' : 
                   day === 3 || day === 23 ? 'rd' : 'th';
    return `W/C ${day}${suffix} ${month}`;
  };

  // Helper function to convert 24-hour time to 12-hour format
  const formatTimeTo12Hour = (time24: string) => {
    if (!time24) return '12:00 PM';
    
    // Check if time already has AM/PM
    if (time24.includes('AM') || time24.includes('PM')) {
      return time24;
    }
    
    // Handle different time formats (with or without seconds)
    const timeParts = time24.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = timeParts[1] || '00';
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Early return if no weeks data
  if (!weeks || weeks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No weeks data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.map((week, weekIndex) => {
        // Get all posts for this week and sort them
        const weekPosts = week.posts.sort((a, b) => {
          // Sort by date, then by time
          const dateA = new Date(a.scheduled_date || '');
          const dateB = new Date(b.scheduled_date || '');
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
        });

        return (
          <div key={weekIndex} className="bg-white border rounded-lg overflow-hidden">
            {/* Week Header */}
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-semibold text-lg">
                {formatWeekCommencing(week.weekStart)}
                {weekIndex === 0 && ' (Current)'}
              </h3>
              <p className="text-sm text-gray-600">
                {(() => {
                  const weekStartDate = week.weekStart instanceof Date ? week.weekStart : new Date(week.weekStart);
                  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
                  return `${weekStartDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} - ${weekEndDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`;
                })()}
              </p>
            </div>
            
            {/* Posts by Date */}
            <div className="w-full p-4">
              {weekPosts.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8 w-full">
                  No posts scheduled for this week
                </div>
              ) : (
                (() => {
                  // Group posts by date
                  const postsByDate = weekPosts.reduce((acc, post) => {
                    const dateKey = post.scheduled_date;
                    if (!acc[dateKey]) {
                      acc[dateKey] = [];
                    }
                    acc[dateKey].push(post);
                    return acc;
                  }, {} as Record<string, typeof weekPosts>);

                  return Object.entries(postsByDate).map(([dateKey, datePosts]) => {
                    const firstPost = datePosts[0];
                    const postDate = new Date(firstPost.scheduled_date + 'T00:00:00');
                    const dayName = postDate.toLocaleDateString('en-NZ', { weekday: 'long' });
                    const dateStr = postDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
                    
                    return (
                      <div key={dateKey} className="mb-6 last:mb-0">
                        {/* Date Header */}
                        <div className="mb-3 pb-2 border-b border-gray-200">
                          <h4 className="font-semibold text-base text-gray-800">{dayName}</h4>
                          <p className="text-sm text-gray-600">{dateStr}</p>
                        </div>
                        
                        {/* Posts for this date - side by side */}
                        <div className="flex flex-wrap gap-4">
                          {datePosts.map((post) => {
                    const postKey = `${post.post_type}-${post.id}`;
                    const selectedStatus = selectedPosts[postKey];
                    
                    // Determine card styling based on selected status or existing approval status
                    const getCardStyling = () => {
                      const statusToUse = selectedStatus || post.approval_status;
                      
                      if (statusToUse === 'approved') {
                        return 'border-green-200 bg-green-50';
                      } else if (statusToUse === 'needs_attention') {
                        return 'border-orange-200 bg-orange-50';
                      } else if (statusToUse === 'rejected') {
                        return 'border-red-200 bg-red-50';
                      } else {
                        return 'border-gray-200 bg-white';
                      }
                    };
                    
                    return (
                      <div
                        key={postKey}
                        className={`flex-shrink-0 w-72 border rounded-lg p-3 hover:shadow-md transition-shadow ${getCardStyling()}`}
                      >
                        {/* Post Header */}
                        <div className="mb-3 pb-2 border-b border-gray-200 flex items-center justify-between">
                          <div className="text-xs text-gray-600">
                            {post.scheduled_time && formatTimeTo12Hour(post.scheduled_time)}
                          </div>
                          {/* Approval Selection Checkbox */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={!!selectedStatus}
                              onChange={(e) => onPostSelection(postKey, e.target.checked ? 'approved' : null)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                          </div>
                        </div>

                        {/* Approval Status Icons */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {post.approval_status === 'approved' && (
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center" title="Approved">
                                <CheckCircle className="w-3 h-3 text-green-700" />
                              </div>
                            )}
                            {post.approval_status === 'rejected' && (
                              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center" title="Rejected">
                                <XCircle className="w-3 h-3 text-red-700" />
                              </div>
                            )}
                            {post.approval_status === 'needs_attention' && (
                              <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center" title="Needs Attention">
                                <AlertTriangle className="w-3 h-3 text-orange-700" />
                              </div>
                            )}
                            {(!post.approval_status || post.approval_status === 'pending') && (
                              <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center" title="Pending Approval">
                                <Minus className="w-3 h-3 text-gray-700" />
                              </div>
                            )}
                          </div>
                          
                          {/* Client Feedback Indicator */}
                          {post.client_feedback && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Has client feedback" />
                          )}
                        </div>

                        {/* Post Media (Image or Video) */}
                        {post.image_url && (
                          <div className="w-full mb-3 rounded overflow-hidden">
                            <LazyPortalImage
                              src={post.image_url}
                              alt="Post"
                              className="w-full h-auto object-contain"
                              mediaType={post.media_type as 'image' | 'video' | undefined}
                            />
                          </div>
                        )}
                        
                        {/* Caption */}
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-gray-700 flex-1">
                            {post.caption}
                          </p>
                        </div>
                        
                        {/* Client Feedback */}
                        {post.client_feedback && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium text-gray-700">Client feedback:</span>
                            <p className="mt-1 text-gray-600">{post.client_feedback}</p>
                          </div>
                        )}

                        {/* Approval Actions */}
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <div className="space-y-2">
                            {/* Approval Buttons */}
                            <div className="flex gap-1 w-full">
                              <button
                                onClick={() => onPostSelection(postKey, 'approved')}
                                className={`flex items-center justify-center gap-1 text-xs flex-1 px-2 py-1 rounded ${
                                  selectedStatus === 'approved' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                <CheckCircle className="w-3 h-3" />
                                Approve
                              </button>
                              
                              <button
                                onClick={() => onPostSelection(postKey, 'needs_attention')}
                                className={`flex items-center justify-center gap-1 text-xs flex-1 px-2 py-1 rounded ${
                                  selectedStatus === 'needs_attention' 
                                    ? 'bg-orange-600 text-white' 
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Improve
                              </button>
                              
                              <button
                                onClick={() => onPostSelection(postKey, 'rejected')}
                                className={`flex items-center justify-center text-xs w-8 h-8 p-0 rounded ${
                                  selectedStatus === 'rejected' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Comment Input */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Comments or feedback:
                              </label>
                              <textarea
                                placeholder="Let us know what changes you'd like to see..."
                                value={comments[postKey] || ''}
                                onChange={(e) => onCommentChange(postKey, e.target.value)}
                                className="w-full p-2 text-xs border border-gray-300 rounded resize-none bg-white"
                                rows={2}
                              />
                            </div>

                            {/* Editable Caption */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Caption (you can edit this):
                              </label>
                              <textarea
                                value={editedCaptions[postKey] || post.caption}
                                onChange={(e) => onCaptionChange(postKey, e.target.value)}
                                className="w-full p-2 text-sm border border-gray-300 rounded resize-none bg-white"
                                rows={3}
                              />
                              {editedCaptions[postKey] && 
                               editedCaptions[postKey] !== post.caption && (
                                <p className="text-xs text-blue-600 mt-1">Caption has been edited</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
