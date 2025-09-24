"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Check, X, AlertTriangle, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";

// Lazy loading image component
const LazyImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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
    <div ref={imgRef} className={`relative ${className}`}>
      {isInView && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            className={`transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
    </div>
  );
};

interface Post {
  id: string;
  project_id: string;
  caption: string;
  image_url: string;
  scheduled_time: string | null;
  scheduled_date?: string;
  late_post_id?: string;
  platforms_scheduled?: string[];
  late_status?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  needs_attention?: boolean;
  client_feedback?: string;
  edit_count?: number;
  last_edited_at?: string;
  last_edited_by?: {
    id: string;
    name: string;
    email: string;
  };
  needs_reapproval?: boolean;
  original_caption?: string;
  status?: 'draft' | 'ready' | 'scheduled' | 'published' | 'archived' | 'deleted';
}

export default function PortalCalendarPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingScheduledPosts, setIsLoadingScheduledPosts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get NZ timezone start of week (Monday)
  const getStartOfWeek = (offset: number = 0) => {
    const today = new Date();
    const nzDate = new Date(today.toLocaleString("en-US", {timeZone: "Pacific/Auckland"}));
    const monday = new Date(nzDate);
    const dayOfWeek = monday.getDay();
    const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    monday.setDate(diff + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const fetchScheduledPosts = useCallback(async (retryCount = 0, forceRefresh = false) => {
    if (!token) return;
    
    // Check cache first (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < 30000 && Object.keys(scheduledPosts).length > 0) {
      console.log('📦 Using cached scheduled posts data');
      return;
    }
    
    const maxRetries = 1;
    const baseLimit = 20;
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
      setError(null);
      }
      console.log(`🔍 FETCHING - Scheduled posts for portal (attempt ${retryCount + 1})`);
      
      // Calculate date range for current 4-week view
      const startOfWeek = getStartOfWeek(weekOffset);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + (4 * 7) - 1); // 4 weeks

      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = endOfWeek.toISOString().split('T')[0];

      const response = await fetch(
        `/api/portal/calendar?token=${encodeURIComponent(token)}&startDate=${startDate}&endDate=${endDate}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 408) {
          console.error('⏰ Query timeout:', errorData);
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (attempt ${retryCount + 1})`);
            return fetchScheduledPosts(retryCount + 1);
          } else {
            setError('Query timeout - please try refreshing the page');
            setIsLoadingScheduledPosts(false);
            return;
          }
        }
        
        if (response.status === 404) {
          console.log('📭 No scheduled posts found for this period');
          setScheduledPosts({});
          setIsLoadingScheduledPosts(false);
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      const postsByDate = data.posts || {};
      
      console.log(`✅ Retrieved posts for ${Object.keys(postsByDate).length} dates`);
      
      // The API already returns posts grouped by date, so we can use it directly
      setScheduledPosts(postsByDate);
      setLastFetchTime(Date.now());
      setIsLoadingScheduledPosts(false);
      setRefreshKey(prev => prev + 1);
      console.log('Scheduled posts loaded - dates:', Object.keys(postsByDate).length);
      
    } catch (error) {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(false);
      }
      console.error('❌ Error fetching scheduled posts:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (retryCount < maxRetries && errorMessage.includes('fetch')) {
        console.log(`🔄 Network error, retrying... (attempt ${retryCount + 1})`);
        setTimeout(() => fetchScheduledPosts(retryCount + 1), 2000);
        return;
      }
      
      setError(`Failed to load scheduled posts: ${errorMessage}`);
      setIsLoadingScheduledPosts(false);
    }
  }, [token, lastFetchTime, scheduledPosts, weekOffset]);

  useEffect(() => {
    if (token) {
      fetchScheduledPosts(0, true);
    }
  }, [token, weekOffset]);

  const getWeeksToDisplay = () => {
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      weeks.push(getStartOfWeek(weekOffset + i));
    }
    return weeks;
  };

  // Format week commencing date as "W/C 8th Sept"
  const formatWeekCommencing = (weekStart: Date) => {
    const day = weekStart.getDate();
    const month = weekStart.toLocaleDateString('en-NZ', { month: 'short' });
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

  if (isLoadingScheduledPosts && Object.keys(scheduledPosts).length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">{error}</div>
        <Button onClick={() => fetchScheduledPosts(0, true)} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">Content Calendar</h2>
          <p className="text-muted-foreground">
            View your scheduled posts and their approval status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => fetchScheduledPosts(0, true)} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Content Calendar - 4 Week View
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-2 rounded-md border hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Week {weekOffset + 1} - {weekOffset + 4}
              </span>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-2 rounded-md border hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4 pb-2">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {getStartOfWeek(weekOffset).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' })} - 
                {getStartOfWeek(weekOffset + 3).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Current Week
              </button>
            </div>
            
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] p-4">
            <div className="grid grid-cols-4" style={{ gap: '16px' }}>
              {getWeeksToDisplay().map((weekStart, weekIndex) => (
                <div key={weekIndex} className="flex flex-col border rounded-lg bg-white min-w-64 flex-1">
                  <div className="bg-gray-50 p-3 border-b">
                    <h3 className="font-semibold text-sm">
                      {formatWeekCommencing(weekStart)}
                      {weekOffset + weekIndex === 0 && ' (Current)'}
            </h3>
                    <p className="text-xs text-gray-600">
                      {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} - 
                      {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                    </p>
                    </div>
                  
                  <div className="p-2 space-y-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIndex) => {
                      const dayDate = new Date(weekStart);
                      dayDate.setDate(weekStart.getDate() + dayIndex);
                      const isToday = dayDate.toDateString() === new Date().toDateString();
                      const dateKey = dayDate.toLocaleDateString('en-CA');
                      
                      return (
                        <div
                          key={day}
                          className={`p-2 rounded min-h-[80px] border-2 border-transparent transition-all duration-200 ${
                            isToday 
                              ? 'bg-blue-50 border-blue-300' 
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{day}</span>
                            <span className="text-gray-500">{dayDate.getDate()}</span>
                          </div>
                          
                          {/* Loading state for scheduled posts */}
                          {isLoadingScheduledPosts && (
                            <div className="flex items-center justify-center py-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              <span className="ml-2 text-xs text-gray-500">Loading...</span>
                          </div>
                          )}
                          
                          {/* Display scheduled posts */}
                          {!isLoadingScheduledPosts && scheduledPosts[dayDate.toLocaleDateString('en-CA')]?.map((post: Post, idx: number) => {
                            return (
                              <div key={idx} className="mt-1">
                                <div className={`flex items-center gap-1 rounded p-1 cursor-default ${
                                  post.late_status === 'scheduled' 
                                    ? 'bg-green-100 border border-green-300' 
                                    : 'bg-blue-100 border border-blue-300'
                                }`}>
                          {/* Platform Icons */}
                          {post.platforms_scheduled && post.platforms_scheduled.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {post.platforms_scheduled.map((platform, platformIdx) => (
                                        <div key={platformIdx} className="w-4 h-4 flex items-center justify-center" title={`Scheduled to ${platform}`}>
                                          {platform === 'facebook' && <div className="w-3 h-3 bg-blue-600 rounded-sm" />}
                                          {platform === 'instagram' && <div className="w-3 h-3 bg-pink-600 rounded-sm" />}
                                          {platform === 'twitter' && <div className="w-3 h-3 bg-sky-500 rounded-sm" />}
                                          {platform === 'linkedin' && <div className="w-3 h-3 bg-blue-700 rounded-sm" />}
                                        </div>
                              ))}
                            </div>
                          )}
                                  
                                  {/* LATE Status Indicator */}
                                  {post.late_status && (
                                    <div className={`w-2 h-2 rounded-full ${
                                      post.late_status === 'scheduled' ? 'bg-green-500' :
                                      post.late_status === 'published' ? 'bg-green-600' :
                                      post.late_status === 'failed' ? 'bg-red-500' :
                                      'bg-gray-400'
                                    }`} title={`LATE Status: ${post.late_status}`} />
                                  )}
                                  
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img 
                                    src={post.image_url || '/api/placeholder/100/100'} 
                                    alt="Post"
                                    className="w-8 h-8 object-cover rounded"
                                    onError={(e) => {
                                      console.log('Scheduled post image failed to load, using placeholder for post:', post.id);
                                      e.currentTarget.src = '/api/placeholder/100/100';
                                    }}
                                  />
                                  
                                  {/* Enhanced Status Indicator - Fixed Icon Position */}
                                  <div className="relative flex items-center justify-between w-full">
                                    {/* Time display */}
                                    <div className="flex items-center justify-start flex-1">
                                      <span 
                                        className="text-xs text-gray-600"
                                        style={{ minWidth: '60px', display: 'inline-block' }}
                                        title="Scheduled time"
                                      >
                                        {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                      </span>
                                    </div>
                                    
                                    {/* Approval Status Icons - Right aligned with proper spacing */}
                                    <div className="flex items-center ml-2">
                                      {post.approval_status === 'approved' && (
                                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center" title="Approved">
                                          <Check className="w-3 h-3 text-green-700" />
                                        </div>
                                      )}
                                      {post.approval_status === 'rejected' && (
                                        <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center" title="Rejected">
                                          <X className="w-3 h-3 text-red-700" />
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
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
              );
            })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Kanban Calendar - Weekly Rows with Daily Columns */}
        <div className="mt-8 border-t border-gray-200 pt-8 mx-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
        <div>
                <h2 className="text-xl font-semibold text-gray-700">Scheduled Posts - Detailed View</h2>
                <p className="text-sm text-gray-600 mt-1">Review all scheduled posts with detailed information</p>
              </div>
              
              {/* Loading State for Scheduled Posts */}
              {isLoadingScheduledPosts && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Loading scheduled posts...
                </div>
              )}
            </div>
          </div>
          
          {/* Horizontal Posts Queue */}
          <div className="space-y-4">
            {isLoadingScheduledPosts ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading scheduled posts...</p>
                </div>
              </div>
            ) : (
              getWeeksToDisplay().map((weekStart, weekIndex) => {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                // Get all posts for this week
                const weekPosts = Object.entries(scheduledPosts)
                  .flatMap(([date, posts]) => 
                    posts.filter(post => {
                      const postDate = new Date(date);
                      return postDate >= weekStart && postDate <= weekEnd;
                    })
                  )
                  .sort((a, b) => {
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
                        {formatWeekCommencing(weekStart)}
                        {weekOffset + weekIndex === 0 && ' (Current)'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} - 
                        {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    
                    {/* Horizontal Posts Queue */}
                    <div className="w-full overflow-x-auto">
                      <div className="flex space-x-4 p-4">
                        {weekPosts.length === 0 ? (
                          <div className="text-center text-gray-500 text-sm py-8 w-full">
                            No posts scheduled for this week
                      </div>
                    ) : (
                          weekPosts.map((post) => {
                            // Get the date and day for this post
                            const postDate = new Date(post.scheduled_date + 'T00:00:00');
                            const dayName = postDate.toLocaleDateString('en-NZ', { weekday: 'long' });
                            const dateStr = postDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
                            
                            return (
                        <div
                          key={post.id}
                                className={`flex-shrink-0 w-64 border rounded-lg p-3 hover:shadow-sm transition-shadow ${
                                  post.approval_status === 'approved' ? 'border-green-200 bg-green-50' :
                                  post.approval_status === 'rejected' ? 'border-red-200 bg-red-50' :
                                  post.approval_status === 'needs_attention' ? 'border-orange-200 bg-orange-50' :
                                  'border-gray-200 bg-white'
                                }`}
                              >
                                {/* Post Title - Date and Day */}
                                <div className="mb-3 pb-2 border-b border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="font-semibold text-sm text-gray-700">{dayName}</h4>
                                      <p className="text-xs text-gray-600">{dateStr}</p>
                                    </div>
                                  </div>
                                </div>

                          {/* Post Image */}
                          {post.image_url && (
                                  <div className="w-full mb-2 rounded overflow-hidden">
                                    <LazyImage
                              src={post.image_url}
                                      alt="Post"
                                      className="w-full h-auto object-contain"
                            />
                                  </div>
                          )}
                          
                          {/* Time */}
                                <div className="text-xs text-gray-600 mb-2">
                                  {post.scheduled_time && formatTimeTo12Hour(post.scheduled_time)}
                          </div>
                          
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

                                {/* Post Actions */}
                                <div className="mt-3 pt-2 border-t border-gray-100">
                                  <div className="flex items-center justify-between">
                                    {/* Status and Info */}
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                      {post.late_status && (
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          post.late_status === 'scheduled' ? 'bg-green-100 text-green-700' :
                                          post.late_status === 'published' ? 'bg-blue-100 text-blue-700' :
                                          post.late_status === 'failed' ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {post.late_status === 'scheduled' ? 'Scheduled' : post.late_status}
                                        </span>
                                      )}
          </div>
        </div>
      </div>
                  </div>
                            );
                          })
                        )}
                  </div>
                  </div>
                  </div>
              );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}