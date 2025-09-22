'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, Share2, Loader2, RefreshCw } from 'lucide-react';
import { Check, X, AlertTriangle, Minus } from 'lucide-react';
import { EditIndicators } from 'components/EditIndicators';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Button } from 'components/ui/button';

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

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  content_metadata?: {
    posts?: Array<{
      id: string;
      images?: Array<{
        id: string;
        notes?: string;
        preview: string;
      }>;
      captions?: Array<{
        id: string;
        text: string;
        isSelected: boolean;
      }>;
      selectedCaption?: string;
      postNotes?: string;
      activeImageId?: string;
      createdAt?: string;
    }>;
  };
}

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
  // New editing fields
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

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
}

export default function PlannerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params?.clientId as string;
  const projectId = searchParams?.get('projectId');
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  console.log('📍 PlannerPage render - clientId:', clientId, 'projectId:', projectId);

  // Log user's actual timezone
  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const localTime = now.toLocaleString();
    const utcTime = now.toUTCString();
    
    console.log('🌍 USER TIMEZONE DETECTION:');
    console.log('  - Browser timezone:', userTimezone);
    console.log('  - Local time:', localTime);
    console.log('  - UTC time:', utcTime);
    console.log('  - Timezone offset (minutes):', now.getTimezoneOffset());
    console.log('  - Timezone offset (hours):', now.getTimezoneOffset() / 60);
  }, []);
  
  const [projects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId || null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  
  const [projectPosts, setProjectPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingScheduledPosts, setIsLoadingScheduledPosts] = useState(false);
  const [schedulingPlatform, setSchedulingPlatform] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingPostId, setMovingPostId] = useState<string | null>(null);
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(new Set());
  const [deletingUnscheduledPostIds, setDeletingUnscheduledPostIds] = useState<Set<string>>(new Set());
  const [schedulingPostIds, setSchedulingPostIds] = useState<Set<string>>(new Set());
  const [editingTimePostIds, setEditingTimePostIds] = useState<Set<string>>(new Set());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectedPostsForApproval, setSelectedPostsForApproval] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingCaptions, setEditingCaptions] = useState<Record<string, string>>({});

  const updatePostCaption = (postId: string, newCaption: string) => {
    setEditingCaptions(prev => ({
      ...prev,
      [postId]: newCaption
    }));
  };

  const fetchConnectedAccounts = useCallback(async () => {
    // Add caching to prevent excessive calls
    const now = Date.now();
    if (now - lastFetchTime < 30000 && connectedAccounts.length > 0) {
      console.log('📦 Using cached connected accounts data');
      return;
    }
    
    try {
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }
      const data = await response.json();
      setConnectedAccounts(data.accounts || []);
      console.log('Connected accounts count:', data.accounts?.length || 0);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load connected accounts');
    }
  }, [clientId, lastFetchTime, connectedAccounts.length]);

  const fetchPostApprovals = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      // Get all approval sessions for this project
      const sessionsResponse = await fetch(`/api/approval-sessions?project_id=${selectedProject}`);
      if (!sessionsResponse.ok) return;
      
      const { sessions } = await sessionsResponse.json();
      if (!sessions || sessions.length === 0) return;
      
      // Get approvals for the latest session
      const latestSession = sessions[0];
      const approvalsResponse = await fetch(`/api/post-approvals?session_id=${latestSession.id}`);
      if (!approvalsResponse.ok) return;
      
      const { approvals } = await approvalsResponse.json();
      
      // Create a lookup map by post_id and post_type
      const approvalMap: {[key: string]: any} = {};
      approvals.forEach((approval: any) => {
        const key = `${approval.post_type}-${approval.post_id}`;
        approvalMap[key] = approval;
      });
      
      // setPostApprovals(approvalMap);
    } catch (error) {
      console.error('Error fetching post approvals:', error);
    }
  }, [selectedProject]);

  const fetchUnscheduledPosts = useCallback(async (forceRefresh = false) => {
      // Add caching to prevent excessive calls
      const now = Date.now();
      if (!forceRefresh && now - lastFetchTime < 10000 && projectPosts.length > 0) {
        console.log('📦 Using cached unscheduled posts data');
        return;
      }
      
      try {
        setIsLoadingPosts(true);
        setError(null);
        console.log('Fetching unscheduled posts for project:', projectId);
        const response = await fetch(`/api/planner/unscheduled?projectId=${projectId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch unscheduled posts: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Unscheduled posts response - count:', data.posts?.length || 0);
        
        // Debug image data (safe logging)
        if (data.posts && data.posts.length > 0) {
          console.log(`Found ${data.posts.length} unscheduled posts`);
          data.posts.forEach((post: Post, index: number) => {
            console.log(`Post ${index}:`, {
              hasImage: !!post.image_url,
              imageType: typeof post.image_url,
              imageLength: post.image_url?.length || 0
            });
          });
        }
        
        setProjectPosts(data.posts || []);
        setLastFetchTime(now); // Update cache timestamp
      } catch (error) {
        console.error('Error fetching unscheduled posts:', error);
        setError(error instanceof Error ? error.message : 'Failed to load unscheduled posts');
      } finally {
        setIsLoadingPosts(false);
      }
    }, [projectId, lastFetchTime, projectPosts.length]);

  const fetchScheduledPosts = useCallback(async (retryCount = 0, forceRefresh = false) => {
    if (!projectId) return;
    
    // Check cache first (unless force refresh) - use a separate cache timestamp for scheduled posts
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < 30000 && Object.keys(scheduledPosts).length > 0) {
      console.log('📦 Using cached scheduled posts data');
      return;
    }
    
    const maxRetries = 1; // Reduced retries to prevent loops
    const baseLimit = 20; // Reduced limit to prevent timeouts
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
        setError(null);
      }
      console.log(`🔍 FETCHING - Scheduled posts for project: ${projectId} (attempt ${retryCount + 1})`);
      
      // Simplified query - always include image data for better UX
      const response = await fetch(
        `/api/planner/scheduled?projectId=${projectId}&limit=${baseLimit}&includeImageData=true`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 408) {
          // Handle timeout error with retry logic
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
          console.log('📭 No scheduled posts found for this project');
          setScheduledPosts({});
          setIsLoadingScheduledPosts(false);
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      const posts = data.posts || [];
      
      console.log(`✅ Retrieved ${posts.length} scheduled posts`);
      
      // Map posts by date
      const mapped: {[key: string]: Post[]} = {};
      posts.forEach((post: Post) => {
        const dateKey = post.scheduled_date;
        if (dateKey && !mapped[dateKey]) mapped[dateKey] = [];
        if (dateKey) mapped[dateKey].push(post);
      });
      
      setScheduledPosts(mapped);
      setLastFetchTime(Date.now()); // Update cache timestamp
      setIsLoadingScheduledPosts(false);
      setRefreshKey(prev => prev + 1); // Force re-render
      console.log('Scheduled posts loaded - dates:', Object.keys(mapped).length);
      
    } catch (error) {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(false);
      }
      console.error('❌ Error fetching scheduled posts:', error);
      
      // Simplified retry logic
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (retryCount < maxRetries && errorMessage.includes('fetch')) {
        console.log(`🔄 Network error, retrying... (attempt ${retryCount + 1})`);
        setTimeout(() => fetchScheduledPosts(retryCount + 1), 2000); // Longer delay
        return;
      }
      
      // Show user-friendly error message
      setError(`Failed to load scheduled posts: ${errorMessage}`);
      setIsLoadingScheduledPosts(false);
    }
  }, [projectId, lastFetchTime, scheduledPosts]);

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

  useEffect(() => {
    if (projectId && clientId) {
      // Set project info
      setCurrentProject({ id: projectId, name: 'Current Project', description: '', status: 'active', created_at: '', updated_at: '' });
      setSelectedProject(projectId);
      
      // Fetch data
      fetchConnectedAccounts();
      fetchPostApprovals();
      fetchUnscheduledPosts(true); // Force refresh on initial load
      fetchScheduledPosts(0, true); // Force refresh on initial load
    }
  }, [projectId, clientId]); // Removed function dependencies to prevent circular loops

  // Check for refresh flag from content suite
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldRefresh = urlParams.get('refresh') === 'true';
    
    if (shouldRefresh && projectId) {
      console.log('🔄 Refreshing data after returning from content suite');
      fetchUnscheduledPosts(true);
      fetchScheduledPosts(0, true);
      
      // Remove the refresh parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('refresh');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [projectId]);


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



  const handleDragStart = (e: React.DragEvent, post: Post) => {
    e.dataTransfer.setData('post', JSON.stringify(post));
    e.dataTransfer.effectAllowed = 'move';
    
    // Set custom drag image for consistent thumbnail
    try {
      if (post.image_url) {
        // Create a temporary image element to use as drag image
        const dragImage = new Image();
        dragImage.src = post.image_url;
        dragImage.style.width = '60px';
        dragImage.style.height = '60px';
        dragImage.style.objectFit = 'cover';
        dragImage.style.borderRadius = '8px';
        dragImage.style.border = '2px solid #3B82F6';
        
        // Wait for image to load, then set as drag image
        dragImage.onload = () => {
          e.dataTransfer.setDragImage(dragImage, 30, 30); // Center the image
        };
        
        // Fallback: if image doesn't load quickly, use the original element
        setTimeout(() => {
          if (dragImage.complete) {
            e.dataTransfer.setDragImage(dragImage, 30, 30);
          }
        }, 50);
      }
    } catch (error) {
      console.log('Could not set custom drag image:', error);
      // Continue with default drag behavior if custom image fails
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(dateKey);
  };

  const handleDragLeave = (e: React.DragEvent, _dateKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we're actually leaving the date cell (not just moving to a child element)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverDate(null);
    }
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

  const handleEditScheduledPost = async (post: Post, newTime: string) => {
    if (!newTime || newTime === post.scheduled_time?.slice(0, 5)) return;
    
    try {
      // Add to editing time state
      setEditingTimePostIds(prev => new Set([...prev, post.id]));
      
      console.log('Updating post time to:', newTime);
      
      // Convert 12-hour format back to 24-hour format for database storage
      let timeToSave = newTime;
      if (newTime.includes('AM') || newTime.includes('PM')) {
        const [timePart, ampm] = newTime.split(' ');
        const [hours, minutes] = timePart.split(':');
        let hour24 = parseInt(hours);
        
        if (ampm === 'AM' && hour24 === 12) {
          hour24 = 0;
        } else if (ampm === 'PM' && hour24 !== 12) {
          hour24 += 12;
        }
        
        timeToSave = `${hour24.toString().padStart(2, '0')}:${minutes}:00`;
      } else {
        timeToSave = newTime + ':00';
      }
      
      const response = await fetch('/api/planner/scheduled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            scheduled_time: timeToSave
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update');
      }
      
      // Update local state instead of refreshing entire calendar
      setScheduledPosts(prevScheduled => {
        const updated = { ...prevScheduled };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(p => 
            p.id === post.id 
              ? { ...p, scheduled_time: timeToSave }
              : p
          );
        });
        return updated;
      });
      
    } catch (error) {
      console.error('Error updating post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to update time: ${errorMessage}`);
    } finally {
      // Remove from editing time state
      setEditingTimePostIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
    }
  };

  const handleDrop = async (e: React.DragEvent, weekIndex: number, dayIndex: number) => {
    e.preventDefault();
    const postData = e.dataTransfer.getData('post');
    if (!postData) return;
    
    const post = JSON.parse(postData);
    const weekStart = getWeeksToDisplay()[weekIndex];
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayIndex);
    
    const time = '12:00'; // Default to noon, will add proper time picker later
    
    // Set loading state for this specific post
    setMovingPostId(post.id);
    
    // STEP 1: Log what the user actually selected
    console.log('📅 STEP 1 - USER SELECTION:');
    console.log('  - Week index:', weekIndex);
    console.log('  - Day index:', dayIndex);
    console.log('  - Week start:', weekStart);
    console.log('  - Target date object:', targetDate);
    console.log('  - Target date ISO:', targetDate.toISOString());
    console.log('  - Target date local string:', targetDate.toLocaleString());
    console.log('  - Target date local date string:', targetDate.toLocaleDateString());
    console.log('  - Target date local time string:', targetDate.toLocaleTimeString());
    console.log('  - Default time:', time);
    
    const scheduledDate = targetDate.toLocaleDateString('en-CA'); // Keeps local timezone
    const scheduledTime = time + ':00';
    
    console.log('📅 STEP 2 - FORMATTED VALUES:');
    console.log('  - scheduled_date:', scheduledDate);
    console.log('  - scheduled_time:', scheduledTime);
    console.log('  - Combined datetime:', `${scheduledDate}T${scheduledTime}`);
    
    try {
      // Just move to scheduled table for planning
      const requestBody = {
        unscheduledId: post.id,
        scheduledPost: {
          project_id: projectId,
          client_id: clientId,
          caption: post.caption,
          image_url: post.image_url,
          post_notes: post.post_notes,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime
        }
      };
      
      console.log('📅 STEP 3 - API REQUEST BODY:');
      console.log('  - Request body keys:', Object.keys(requestBody));
      
      console.log('📅 STEP 4 - SENDING REQUEST TO /api/planner/scheduled:');
      const response = await fetch('/api/planner/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📅 STEP 5 - API RESPONSE:');
      console.log('  - Response status:', response.status);
      console.log('  - Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ STEP 6 - SUCCESSFUL RESPONSE:');
      console.log('  - Response keys:', Object.keys(responseData));
      
      // Update posts locally instead of refreshing entire calendar
      console.log('📅 STEP 7 - UPDATING POSTS LOCALLY:');
      
      // Remove from unscheduled posts (projectPosts contains the unscheduled posts)
      setProjectPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
      
      // Add to scheduled posts for the target date
      const newScheduledPost = {
        ...post,
        id: responseData.post.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime
      };
      
      setScheduledPosts(prevScheduled => ({
        ...prevScheduled,
        [scheduledDate]: [...(prevScheduled[scheduledDate] || []), newScheduledPost]
      }));
      
    } catch (error) {
      console.error('❌ DRAG & DROP ERROR:');
      console.error('  - Error type:', typeof error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      
      console.error('  - Error message:', errorMessage);
      console.error('  - Error stack:', errorStack);
      
      setError(`Failed to plan post: ${errorMessage}`);
    } finally {
      // Clear loading state for this post
      setMovingPostId(null);
    }
  };

  const handleMovePost = async (e: React.DragEvent, weekIndex: number, dayIndex: number) => {
    e.preventDefault();
    const postData = e.dataTransfer.getData('scheduledPost');
    if (!postData) return;
    
    const post: Post = JSON.parse(postData);
    
    const weekStart = getWeeksToDisplay()[weekIndex];
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + dayIndex);
    
    // Set loading state for this specific post
    setMovingPostId(post.id);
    
    try {
      await fetch('/api/planner/scheduled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            scheduled_date: newDate.toLocaleDateString('en-CA') // Keeps local timezone
          }
        })
      });
      
      // Update the post in local state instead of refetching all posts
      const oldDateKey = post.scheduled_date;
      const newDateKey = newDate.toLocaleDateString('en-CA');
      
      setScheduledPosts(prev => {
        const updated = { ...prev };
        
        // Remove from old date
        if (oldDateKey && updated[oldDateKey]) {
          updated[oldDateKey] = updated[oldDateKey].filter(p => p.id !== post.id);
          if (updated[oldDateKey].length === 0) {
            delete updated[oldDateKey];
          }
        }
        
        // Add to new date
        if (!updated[newDateKey]) {
          updated[newDateKey] = [];
        }
        updated[newDateKey].push({
          ...post,
          scheduled_date: newDateKey
        });
        
        return updated;
      });
      
    } catch (error) {
      console.error('Error moving post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to move post: ${errorMessage}`);
    } finally {
      // Clear loading state for this post
      setMovingPostId(null);
    }
  };



  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedForDelete.size} posts?`)) return;
    
    // Set loading state for delete operation
    setIsDeleting(true);
    
    const toDelete = Array.from(selectedForDelete);
    const allPosts = Object.values(scheduledPosts).flat();
    
    // Set individual loading states for posts being deleted
    setDeletingPostIds(new Set(toDelete));
    
    // Process all deletions with Promise.all for better handling
    const deletePromises = toDelete.map(async (postId) => {
      try {
        const post = allPosts.find(p => p.id === postId);
        
        // Delete from LATE if applicable
        if (post?.late_post_id) {
          await fetch(`/api/late/delete-post?latePostId=${post.late_post_id}`, {
            method: 'DELETE'
          });
        }
        
        // Delete from database
        const dbResponse = await fetch('/api/planner/scheduled', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: postId })
        });
        
        if (!dbResponse.ok) {
          throw new Error(`Failed to delete ${postId}`);
        }
        
        return { success: true, postId };
      } catch (error) {
        console.error(`Error deleting ${postId}:`, error);
        return { success: false, postId, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    
    // Wait for all deletions to complete
    const results = await Promise.all(deletePromises);
    
    const failed = results.filter(r => !r.success);
    const succeeded = results.filter(r => r.success);
    
    // Update scheduled posts locally instead of refreshing entire calendar
    setScheduledPosts(prevScheduled => {
      const updated = { ...prevScheduled };
      Object.keys(updated).forEach(date => {
        updated[date] = updated[date].filter(post => !succeeded.some(s => s.postId === post.id));
      });
      return updated;
    });
    
    // Clear loading states
    setIsDeleting(false);
    setDeletingPostIds(new Set());
    
    // Clear selection
    setSelectedForDelete(new Set());
    
    if (failed.length > 0) {
      alert(`Deleted ${succeeded.length} posts. Failed to delete ${failed.length} posts.`);
    } else {
      alert(`Successfully deleted ${succeeded.length} posts`);
    }
  };

  const handleDeleteUnscheduledPost = async (postId: string) => {
    try {
      // Add to deleting state
      setDeletingUnscheduledPostIds(prev => new Set([...prev, postId]));
      
      console.log(`🗑️ Deleting unscheduled post: ${postId}`);
      
      const response = await fetch(`/api/planner/unscheduled?postId=${postId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete post: ${response.status}`);
      }
      
      // Remove from local state
      setProjectPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
      
      console.log(`✅ Successfully deleted unscheduled post: ${postId}`);
      
    } catch (error) {
      console.error(`❌ Error deleting unscheduled post ${postId}:`, error);
      alert(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Remove from deleting state
      setDeletingUnscheduledPostIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleTogglePostForApproval = (postId: string) => {
    setSelectedPostsForApproval(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleSelectAllPostsForApproval = () => {
    const allPostIds = new Set<string>();
    
    // Add only scheduled posts (approval board should only show scheduled posts)
    Object.values(scheduledPosts).forEach(weekPosts => {
      weekPosts.forEach(post => allPostIds.add(post.id));
    });
    
    setSelectedPostsForApproval(allPostIds);
  };

  const handleDeselectAllPostsForApproval = () => {
    setSelectedPostsForApproval(new Set());
  };

  const handleCreateShareLink = async () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }

    if (selectedPostsForApproval.size === 0) {
      alert('Please select at least one post to share for approval');
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await fetch('/api/approval-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject,
          client_id: clientId,
          selected_post_ids: Array.from(selectedPostsForApproval)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const { session, share_url } = await response.json();
      
      // For now, just copy to clipboard and show alert
      await navigator.clipboard.writeText(share_url);
      alert(`Share link copied to clipboard!\n\nLink: ${share_url}\nExpires: ${new Date(session.expires_at).toLocaleDateString()}\n\nSelected ${selectedPostsForApproval.size} posts for approval`);
      
    } catch (error) {
      console.error('❌ Error creating share link:', error);
      alert('Failed to create share link. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleScheduleToPlatform = async (account: ConnectedAccount) => {
    if (selectedPosts.size === 0) return;
    
    const allScheduledPosts = Object.values(scheduledPosts).flat();
    const postsToSchedule = allScheduledPosts.filter(p => selectedPosts.has(p.id));
    
    // Validate that all posts have captions
    console.log('🔍 Pre-scheduling validation:', {
      postsToScheduleCount: postsToSchedule.length,
      postsToSchedule: postsToSchedule.map(p => ({
        id: p.id,
        caption: p.caption,
        captionType: typeof p.caption,
        captionLength: p.caption?.length,
        trimmedCaption: p.caption?.trim(),
        hasCaption: !!p.caption,
        captionIsEmpty: !p.caption || p.caption.trim() === ''
      }))
    });
    
    const postsWithoutCaptions = postsToSchedule.filter(post => {
      const currentCaption = editingCaptions[post.id] || post.caption || '';
      return currentCaption.trim().length === 0;
    });
    console.log('🔍 Posts without captions:', postsWithoutCaptions.length, postsWithoutCaptions);
    
    if (postsWithoutCaptions.length > 0) {
      alert(`Cannot schedule posts: ${postsWithoutCaptions.length} post(s) are missing captions. Please add captions before scheduling.`);
      return;
    }
    
    const confirmed = confirm(`Schedule ${selectedPosts.size} posts to ${account.platform}?`);
    if (!confirmed) return;
    
    // Set loading state for this specific platform
    setSchedulingPlatform(account.platform);
    
    // Add all posts to scheduling state
    setSchedulingPostIds(new Set(postsToSchedule.map(p => p.id)));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const post of postsToSchedule) {
      try {
        console.log(`Scheduling post ${successCount + failCount + 1} of ${postsToSchedule.length}`);
        
        // Debug the image_url field (safe logging)
        console.log('🔍 DEBUG - Post image_url details:', {
          postId: post.id,
          hasImageUrl: !!post.image_url,
          imageUrlType: typeof post.image_url,
          imageUrlLength: post.image_url?.length || 0,
          isBase64: post.image_url?.startsWith('data:image'),
          isBlob: post.image_url?.startsWith('blob:'),
          isUrl: post.image_url?.startsWith('http')
        });
        
        // Use image_url directly from database - no need for blob URL conversion
        console.log('Using image from database...');
        const base64Image = post.image_url;
        
        if (!base64Image) {
          throw new Error('No image found for post');
        }

        // Check if we still have a blob URL (this shouldn't happen with the updated system)
        if (base64Image.startsWith('blob:')) {
          console.error('❌ ERROR: Found blob URL in database image_url field!');
          console.error('This suggests the post was created before the image_url fix was implemented.');
          throw new Error('Post contains invalid blob URL. Please recreate this post from Content Suite.');
        }

        // Additional debugging for image data
        console.log('🔍 Image data analysis:');
        console.log('  - Type:', typeof base64Image);
        console.log('  - Length:', base64Image.length);
        console.log('  - Starts with data:', base64Image.startsWith('data:'));
        console.log('  - Starts with data:image:', base64Image.startsWith('data:image'));
        console.log('  - First 100 chars:', base64Image.substring(0, 100));
        console.log('  - Last 50 chars:', base64Image.substring(base64Image.length - 50));

        // Step 1: Upload image to LATE
        console.log('Uploading image to LATE...');
        console.log('Image URL type:', typeof base64Image);
        console.log('Image size in bytes:', base64Image?.length || 0);

        const mediaResponse = await fetch('/api/late/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBlob: base64Image })
        });

        console.log('Media upload response status:', mediaResponse.status);

        if (!mediaResponse.ok) {
          const errorText = await mediaResponse.text();
          console.error('Media upload error:', errorText);
          console.error('Media upload status:', mediaResponse.status);
          throw new Error(`Media upload failed for post: ${post.caption.slice(0, 30)}... (${mediaResponse.status}): ${errorText}`);
        }
        
        const mediaResponseData = await mediaResponse.json();
        console.log('🔍 Media upload response data:', JSON.stringify(mediaResponseData, null, 2));
        
        const { lateMediaUrl } = mediaResponseData;
        console.log('🔍 Extracted lateMediaUrl:', lateMediaUrl);
        
        if (!lateMediaUrl) {
          console.error('❌ ERROR: lateMediaUrl is missing or undefined!');
          console.error('Media response data:', mediaResponseData);
          throw new Error('Failed to get media URL from LATE API');
        }
        
        // Step 2: Schedule via LATE
        const scheduledDateTime = `${post.scheduled_date}T${post.scheduled_time}`;
        const finalCaption = editingCaptions[post.id] || post.caption || '';
        
        console.log('🚀 STEP 4 - LATE API SCHEDULING:');
        console.log('  - Post from database:');
        console.log('    - scheduled_date:', post.scheduled_date);
        console.log('    - scheduled_time:', post.scheduled_time);
        console.log('    - original caption:', post.caption);
        console.log('    - edited caption:', editingCaptions[post.id]);
        console.log('    - final caption:', finalCaption);
        console.log('    - caption type:', typeof finalCaption);
        console.log('    - caption length:', finalCaption?.length);
        console.log('  - Combined scheduledDateTime:', scheduledDateTime);
        console.log('  - Post ID:', post.id);
        console.log('  - Account platform:', account.platform);
        console.log('  - Client ID:', clientId);
        const lateRequestBody = {
          postId: post.id,
          caption: finalCaption,
          lateMediaUrl: lateMediaUrl,
          scheduledDateTime: scheduledDateTime,
          selectedAccounts: [account],
          clientId: clientId
        };
        
        console.log('🚀 STEP 5 - LATE API REQUEST BODY:');
        console.log('  - Request body keys:', Object.keys(lateRequestBody));
        
        const response = await fetch('/api/late/schedule-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lateRequestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Schedule API error:', errorText);
          console.error('Schedule API status:', response.status);
          throw new Error(`Schedule failed for post: ${finalCaption.slice(0, 30)}... (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        const latePostId = result.latePostId || result.late_post_id || result.id;
        
        if (latePostId) {
          // Update database with LATE post ID
          await supabase
            .from('planner_scheduled_posts')
            .update({
              late_status: 'scheduled',
              late_post_id: latePostId,
              platforms_scheduled: [...(post.platforms_scheduled || []), account.platform]
            })
            .eq('id', post.id);
          
          // Update local state to show post as scheduled (green)
          setScheduledPosts(prevScheduled => {
            const updated = { ...prevScheduled };
            Object.keys(updated).forEach(date => {
              updated[date] = updated[date].map(p => 
                p.id === post.id 
                  ? { ...p, late_status: 'scheduled', late_post_id: latePostId, platforms_scheduled: [...(p.platforms_scheduled || []), account.platform] }
                  : p
              );
            });
            return updated;
          });
        }
        
        successCount++;
        
        // Remove this post from scheduling state
        setSchedulingPostIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(post.id);
          return newSet;
        });
        
        // Small delay between posts to avoid rate limiting
        if (postsToSchedule.length > 1 && successCount < postsToSchedule.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to schedule post:`, error);
        // errors.push(error instanceof Error ? error.message : 'Unknown error');
        failCount++;
        
        // Remove this post from scheduling state even on error
        setSchedulingPostIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(post.id);
          return newSet;
        });
      }
    }
    
    // Clear loading state (even if there were errors)
    setSchedulingPlatform(null);
    setSchedulingPostIds(new Set()); // Clear any remaining scheduling states
    
    // Clear selection (no need to refresh - posts are already visible)
    setSelectedPosts(new Set());
    setSelectedForDelete(new Set());
    
    // Show results
    if (failCount === 0) {
      alert(`Successfully scheduled ${successCount} posts to ${account.platform}!`);
    } else {
      alert(`Scheduled ${successCount} posts to ${account.platform}.\n\nFailed: ${failCount}`);
    }
  };




  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 pb-8">
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-red-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}


      {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/client/${clientId}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-700">
                {currentProject ? `${currentProject.name} Planner` : 'Content Planner'}
              </h1>
              {currentProject && (
                <p className="text-sm text-gray-500 mt-1">
                  Planning content for {currentProject.name}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href={`/dashboard/client/${clientId}/content-suite`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Content
            </Link>
          </div>
        </div>
      </div>



        {/* Posts Queue */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Posts in Project</h3>
            <button
              onClick={() => fetchUnscheduledPosts(true)}
              disabled={isLoadingPosts}
              className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Refresh unscheduled posts"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingPosts ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          {/* Loading State for Unscheduled Posts - Only show when no posts are loaded yet */}
          {isLoadingPosts && projectPosts.length === 0 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-sm text-blue-800">Loading unscheduled posts...</p>
              </div>
            </div>
          )}
          
          <div className="flex gap-3 overflow-x-auto pb-2">
            {projectPosts.length === 0 && !isLoadingPosts ? (
              <div className="text-gray-400 text-sm py-4">
                No posts added yet. Add posts from Content Suite.
            </div>
            ) : (
              projectPosts.map((post) => {
                const isMoving = movingPostId === post.id;
                const isDeleting = deletingUnscheduledPostIds.has(post.id);
                return (
                  <div
                    key={post.id}
                    className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 relative ${
                      isMoving || isDeleting
                        ? 'border-blue-500 bg-blue-50 cursor-not-allowed opacity-50' 
                        : 'border-gray-200 cursor-move hover:border-blue-400'
                    }`}
                    draggable={!isMoving && !isDeleting}
                    onDragStart={(e) => !isMoving && !isDeleting && handleDragStart(e, post)}
                  >
                    {isMoving ? (
                      <div className="w-full h-full flex items-center justify-center bg-blue-50">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : isDeleting ? (
                      <div className="w-full h-full flex items-center justify-center bg-red-50">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.image_url || '/api/placeholder/100/100'}
                          alt="Post"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Image failed to load, using placeholder for post:', post.id);
                            e.currentTarget.src = '/api/placeholder/100/100';
                          }}
                        />
                        {/* Action buttons - positioned to not interfere with drag */}
                        <div className="absolute top-1 right-1 flex flex-col gap-1">
                          {/* Edit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // Navigate to content suite with editPostId parameter in same tab
                              window.location.href = `/dashboard/client/${clientId}/content-suite?editPostId=${post.id}`;
                            }}
                            className="w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-80 hover:opacity-100 transition-opacity"
                            title="Edit in Content Suite"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (confirm('Are you sure you want to delete this post?')) {
                                handleDeleteUnscheduledPost(post.id);
                              }
                            }}
                            className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-80 hover:opacity-100 transition-opacity"
                            title="Delete post"
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
                    )}
                  </div>
                </div>
        

        {/* Schedule Buttons */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            {/* Navigation buttons can go here if needed */}
          </div>
          
          {selectedPosts.size > 0 && connectedAccounts.length > 0 && (
            <div className="flex gap-2">
              <span className="text-sm text-gray-600 py-2">
                {selectedPosts.size} selected:
              </span>
              {connectedAccounts.map((account) => {
                const isScheduling = schedulingPlatform === account.platform;
                
                // Check if any selected posts have empty captions
                const allScheduledPosts = Object.values(scheduledPosts).flat();
                const postsToSchedule = allScheduledPosts.filter(p => selectedPosts.has(p.id));
                
                // Debug logging for button state
                console.log('🔍 Button enable check for', account.platform, ':', {
                  selectedPostsSize: selectedPosts.size,
                  postsToScheduleLength: postsToSchedule.length,
                  allScheduledPostsCount: allScheduledPosts.length,
                  selectedPostsArray: Array.from(selectedPosts),
                  postsToSchedule: postsToSchedule.map(p => ({
                    id: p.id,
                    caption: p.caption,
                    captionType: typeof p.caption,
                    captionLength: p.caption?.length,
                    trimmedCaption: p.caption?.trim(),
                    hasCaption: !!p.caption,
                    captionIsEmpty: !p.caption || p.caption.trim() === '',
                    fullPost: p // Include full post object for debugging
                  })),
                  hasEmptyCaptions: postsToSchedule.some(p => !p.caption || p.caption.trim() === ''),
                  isScheduling,
                  buttonShouldBeEnabled: !isScheduling && !postsToSchedule.some(p => !p.caption || p.caption.trim() === '')
                });
                
                const hasEmptyCaptions = postsToSchedule.some(post => {
                  const currentCaption = editingCaptions[post.id] || post.caption || '';
                  return currentCaption.trim().length === 0;
                });
                
                return (
                  <button
                    key={account._id}
                    onClick={() => handleScheduleToPlatform(account)}
                    disabled={isScheduling || hasEmptyCaptions}
                    className={`px-3 py-1.5 text-white rounded text-sm flex items-center gap-2 ${
                      isScheduling || hasEmptyCaptions ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      account.platform === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' :
                      account.platform === 'twitter' ? 'bg-sky-500 hover:bg-sky-600' :
                      account.platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                      account.platform === 'linkedin' ? 'bg-blue-700 hover:bg-blue-800' :
                      'bg-gray-600 hover:bg-gray-700'
                    }`}
                    title={hasEmptyCaptions ? 'Add captions to selected posts before scheduling' : ''}
                  >
                    {isScheduling && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    )}
                    {isScheduling ? 'Scheduling...' : `Schedule to ${account.platform}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      
        {/* Bulk Delete Button */}
        {selectedForDelete.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className={`px-4 py-2 text-white rounded mb-4 flex items-center gap-2 ${
              isDeleting ? 'opacity-50 cursor-not-allowed bg-red-500' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isDeleting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isDeleting ? 'Deleting...' : `Delete ${selectedForDelete.size} Selected Posts`}
          </button>
        )}

        {/* Calendar */}
        <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {currentProject ? `${currentProject.name} - 4 Week View` : 'All Projects - 4 Week View'}
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
                        const isDragOver = dragOverDate === dateKey;
                        
                        return (
                          <div
                            key={day}
                            className={`p-2 rounded min-h-[80px] border-2 border-transparent transition-all duration-200 ${
                              isDragOver 
                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' 
                                : isToday 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, dateKey)}
                            onDragLeave={(e) => handleDragLeave(e, dateKey)}
                            onDrop={(e) => {
                              setDragOverDate(null); // Clear drag over state
                              if (e.dataTransfer.getData('scheduledPost')) {
                                handleMovePost(e, weekIndex, dayIndex);
                              } else {
                                handleDrop(e, weekIndex, dayIndex);
                              }
                            }}
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
                              const isDeleting = deletingPostIds.has(post.id);
                              const isScheduling = schedulingPostIds.has(post.id);
                              const isEditingTime = editingTimePostIds.has(post.id);
                              const isMoving = movingPostId === post.id;
                              return (
                                <div key={idx} className="mt-1">
                                  {editingPostId === post.id ? (
                                    <input
                                      type="time"
                                      defaultValue={post.scheduled_time?.slice(0, 5)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleEditScheduledPost(post, e.currentTarget.value);
                                          setEditingPostId(null);
                                        }
                                        if (e.key === 'Escape') {
                                          setEditingPostId(null);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        handleEditScheduledPost(post, e.target.value);
                                        setEditingPostId(null);
                                      }}
                                      className="text-xs p-1 rounded border"
                                    />
                                  ) : (
                                    <div 
                                      draggable={!isDeleting && !isScheduling && !isEditingTime && !isMoving}
                                      onDragStart={(e) => !isDeleting && !isScheduling && !isEditingTime && !isMoving && (() => {
                                        e.dataTransfer.setData('scheduledPost', JSON.stringify(post));
                                        e.dataTransfer.setData('originalDate', dayDate.toLocaleDateString('en-CA')); // Keeps local timezone
                                      })()}
                                      className={`flex items-center gap-1 rounded p-1 ${
                                        isDeleting 
                                          ? 'cursor-not-allowed opacity-50 bg-red-50 border border-red-300' 
                                          : isScheduling
                                            ? 'cursor-not-allowed opacity-50 bg-yellow-50 border border-yellow-300'
                                            : isEditingTime
                                              ? 'cursor-not-allowed opacity-50 bg-purple-50 border border-purple-300'
                                              : isMoving
                                                ? 'cursor-not-allowed opacity-50 bg-orange-50 border border-orange-300'
                                              : `cursor-move hover:opacity-80 ${
                                                  post.late_status === 'scheduled' 
                                                    ? 'bg-green-100 border border-green-300' 
                                                    : 'bg-blue-100 border border-blue-300'
                                                }`
                                      }`}
                                    >
                                    {isDeleting ? (
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                        <span className="text-xs text-red-600">Deleting...</span>
                                      </div>
                                    ) : isScheduling ? (
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                        <span className="text-xs text-yellow-600">Scheduling...</span>
                                      </div>
                                    ) : isEditingTime ? (
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                        <span className="text-xs text-purple-600">Updating time...</span>
                                      </div>
                                    ) : isMoving ? (
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                        <span className="text-xs text-orange-600">Moving...</span>
                                      </div>
                                    ) : (
                                      <>
                                        <input
                                          type="checkbox"
                                          checked={selectedPosts.has(post.id) || selectedForDelete.has(post.id)}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            
                                            // Update both selection sets
                                            const newSelectedPosts = new Set(selectedPosts);
                                            const newSelectedDelete = new Set(selectedForDelete);
                                            
                                            if (e.target.checked) {
                                              newSelectedPosts.add(post.id);
                                              newSelectedDelete.add(post.id);
                                            } else {
                                              newSelectedPosts.delete(post.id);
                                              newSelectedDelete.delete(post.id);
                                            }
                                            
                                            setSelectedPosts(newSelectedPosts);
                                            setSelectedForDelete(newSelectedDelete);
                                          }}
                                          className="w-3 h-3"
                                        />
                                        
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
                                              className="text-xs text-gray-600 cursor-pointer hover:text-gray-800"
                                              style={{ minWidth: '60px', display: 'inline-block' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingPostId(post.id);
                                          }}
                                          title="Click to edit time"
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
                                      </>
                                    )}
                                  </div>
                                )}
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
          
          {/* Scheduled Posts Section - Approval Board */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-700">Scheduled Posts - Approval Board</h2>
                <p className="text-sm text-gray-600 mt-1">Review approval status and client feedback for all scheduled posts</p>
              </div>
              
              {/* Loading State for Scheduled Posts */}
              {isLoadingScheduledPosts && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Loading scheduled posts...
                </div>
              )}
              <Button
                onClick={() => fetchScheduledPosts(0, true)}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
      </div>
            
            {/* Post Selection Controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedPostsForApproval.size} selected
                  </span>
                  <button
                    onClick={handleSelectAllPostsForApproval}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAllPostsForApproval}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Share Button */}
                <button
                  onClick={handleCreateShareLink}
                  disabled={!selectedProject || isCreatingSession || selectedPostsForApproval.size === 0}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </>
                  )}
                </button>
                
              </div>
            </div>
            
            {/* Approval Summary */}
            <div className="mb-6 grid grid-cols-4" style={{ gap: '16px' }}>
              {(() => {
                const allPosts = Object.values(scheduledPosts).flat();
                const approved = allPosts.filter(p => p.approval_status === 'approved').length;
                const rejected = allPosts.filter(p => p.approval_status === 'rejected').length;
                const needsAttention = allPosts.filter(p => p.approval_status === 'needs_attention').length;
                const pending = allPosts.filter(p => p.approval_status === 'pending' || !p.approval_status).length;
                
                return (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Check className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-800">Approved</span>
    </div>
                      <div className="text-lg font-bold text-green-900 mt-1">{approved}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <X className="w-4 h-4 text-red-600 mr-2" />
                        <span className="text-sm font-medium text-red-800">Rejected</span>
                      </div>
                      <div className="text-lg font-bold text-red-900 mt-1">{rejected}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                        <span className="text-sm font-medium text-orange-800">Needs Attention</span>
                      </div>
                      <div className="text-lg font-bold text-orange-900 mt-1">{needsAttention}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gray-400 rounded-full mr-2"></div>
                        <span className="text-sm font-medium text-gray-800">Pending</span>
                      </div>
                      <div className="text-lg font-bold text-gray-700 mt-1">{pending}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Horizontal Kanban Calendar - Weekly Rows with Daily Columns */}
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
                                    {/* Approval Selection Checkbox */}
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedPostsForApproval.has(post.id)}
                                        onChange={() => handleTogglePostForApproval(post.id)}
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Edit Indicators and Approval Status */}
                                <div className="flex items-center justify-between mb-2">
                                  <EditIndicators 
                                    post={post} 
                                    clientId={clientId}
                                    showHistory={true}
                                  />
                                  
                                  {/* Client Feedback Indicator */}
                                  {post.client_feedback && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Has client feedback" />
                                  )}
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navigate to content suite with editPostId parameter in same tab
                                      window.location.href = `/dashboard/client/${clientId}/content-suite?editPostId=${post.id}`;
                                    }}
                                    className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                                    title="Edit content"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
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
                                          {post.late_status}
                                        </span>
                                      )}
                                    </div>

                                    {/* Edit in Content Suite Button */}
                                    {(post as any).status !== 'published' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Navigate to content suite with editPostId parameter in same tab
                                          window.location.href = `/dashboard/client/${clientId}/content-suite?editPostId=${post.id}`;
                                        }}
                                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                        title="Edit in Content Suite"
                                      >
                                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit in Content Suite
                                      </button>
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
                );
              })
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

