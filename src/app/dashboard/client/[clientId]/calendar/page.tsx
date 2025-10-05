'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, Share2, Loader2, RefreshCw, User, Settings } from 'lucide-react';
import { Check, X, AlertTriangle, Minus } from 'lucide-react';
import { EditIndicators } from 'components/EditIndicators';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Button } from 'components/ui/button';
import { FacebookIcon, InstagramIcon, TwitterIcon, LinkedInIcon } from 'components/social-icons';
import { useAuth } from 'contexts/AuthContext';

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
  project_id: string | null;
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

interface ClientUpload {
  id: string;
  client_id: string;
  project_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
}

export default function CalendarPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  const { user } = useAuth();
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  console.log('📍 CalendarPage render - clientId:', clientId);

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
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all'); // 'all', 'untagged', or project id
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  
  const [projectPosts, setProjectPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [clientUploads, setClientUploads] = useState<{[key: string]: ClientUpload[]}>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedUnscheduledPosts, setSelectedUnscheduledPosts] = useState<Set<string>>(new Set());
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingCaptions, setEditingCaptions] = useState<Record<string, string>>({});

  const updatePostCaption = (postId: string, newCaption: string) => {
    setEditingCaptions(prev => ({
      ...prev,
      [postId]: newCaption
    }));
  };

  const fetchConnectedAccounts = useCallback(async () => {
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
  }, [clientId]); // Removed state dependencies to prevent recreation


  const fetchUnscheduledPosts = useCallback(async (forceRefresh = false) => {
      try {
        setIsLoadingPosts(true);
        setError(null);
        
        // Build query string based on filter
        let queryString = `clientId=${clientId}`;
        if (selectedProjectFilter === 'untagged') {
          queryString += '&filterUntagged=true';
        } else if (selectedProjectFilter !== 'all') {
          queryString += `&projectId=${selectedProjectFilter}`;
        }
        
        console.log('Fetching unscheduled posts with filter:', selectedProjectFilter);
        const response = await fetch(`/api/calendar/unscheduled?${queryString}`);
        
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
      } catch (error) {
        console.error('Error fetching unscheduled posts:', error);
        setError(error instanceof Error ? error.message : 'Failed to load unscheduled posts');
      } finally {
        setIsLoadingPosts(false);
      }
    }, [clientId, selectedProjectFilter]); // Removed state dependencies to prevent recreation

  const fetchScheduledPosts = useCallback(async (retryCount = 0, forceRefresh = false) => {
    const maxRetries = 1; // Reduced retries to prevent loops
    const baseLimit = 20; // Reduced limit to prevent timeouts
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
        setError(null);
      }
      
      // Build query string based on filter
      let queryString = `clientId=${clientId}&limit=${baseLimit}&includeImageData=true`;
      if (selectedProjectFilter === 'untagged') {
        queryString += '&filterUntagged=true';
      } else if (selectedProjectFilter !== 'all') {
        queryString += `&projectId=${selectedProjectFilter}`;
      }
      
      console.log(`🔍 FETCHING - Scheduled posts with filter: ${selectedProjectFilter} (attempt ${retryCount + 1})`);
      
      // Simplified query - always include image data for better UX
      const response = await fetch(`/api/calendar/scheduled?${queryString}`);
      
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
      const uploads = data.uploads || [];
      
      console.log(`✅ Retrieved ${posts.length} scheduled posts and ${uploads.length} client uploads`);
      
      // Map posts by date
      const mapped: {[key: string]: Post[]} = {};
      posts.forEach((post: Post) => {
        const dateKey = post.scheduled_date;
        if (dateKey && !mapped[dateKey]) mapped[dateKey] = [];
        if (dateKey) mapped[dateKey].push(post);
      });
      
      // Map uploads by date (using created_at date)
      const uploadsMapped: {[key: string]: ClientUpload[]} = {};
      uploads.forEach((upload: ClientUpload) => {
        const uploadDate = new Date(upload.created_at).toLocaleDateString('en-CA');
        if (!uploadsMapped[uploadDate]) uploadsMapped[uploadDate] = [];
        uploadsMapped[uploadDate].push(upload);
      });
      
      setScheduledPosts(mapped);
      setClientUploads(uploadsMapped);
      setIsLoadingScheduledPosts(false);
      setRefreshKey(prev => prev + 1); // Force re-render
      console.log('Scheduled posts loaded - dates:', Object.keys(mapped).length, 'Uploads dates:', Object.keys(uploadsMapped).length);
      
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
  }, [clientId, selectedProjectFilter]); // Removed state dependencies to prevent recreation

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

  // Fetch projects for the client
  const fetchProjects = useCallback(async () => {
    try {
      console.log('Fetching projects for client:', clientId);
      const response = await fetch(`/api/projects?clientId=${clientId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Projects response:', data);
      
      if (data.success && data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      // Fetch projects first
      fetchProjects();
      
      // Fetch data
      fetchConnectedAccounts();
      fetchUnscheduledPosts(true); // Force refresh on initial load
      fetchScheduledPosts(0, true); // Force refresh on initial load
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]); // Only clientId to prevent infinite loop - functions are stable via useCallback
  
  // Refetch posts when filter changes
  useEffect(() => {
    if (clientId && selectedProjectFilter !== null) {
      fetchUnscheduledPosts(true);
      fetchScheduledPosts(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectFilter, clientId]); // Only filter and clientId, not the fetch functions

  // Check for refresh flag from content suite
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldRefresh = urlParams.get('refresh') === 'true';
    
    if (shouldRefresh && clientId) {
      console.log('🔄 Refreshing data after returning from content suite');
      fetchUnscheduledPosts(true);
      fetchScheduledPosts(0, true);
      
      // Remove the refresh parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('refresh');
      window.history.replaceState({}, '', newUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]); // Only depend on clientId to prevent infinite loop


  const getWeeksToDisplay = () => {
    const weeks = [];
    for (let i = 0; i < 1; i++) {
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
      
      const response = await fetch('/api/calendar/scheduled', {
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
          project_id: post.project_id, // Preserve the project_id from the unscheduled post
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
      
      console.log('📅 STEP 4 - SENDING REQUEST TO /api/calendar/scheduled:');
      const response = await fetch('/api/calendar/scheduled', {
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
      await fetch('/api/calendar/scheduled', {
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
    if (!confirm(`Delete ${selectedPosts.size} posts?`)) return;
    
    // Set loading state for delete operation
    setIsDeleting(true);
    
    const toDelete = Array.from(selectedPosts);
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
        const dbResponse = await fetch('/api/calendar/scheduled', {
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
      
        const response = await fetch(`/api/calendar/unscheduled?postId=${postId}`, {
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

  // Unified post selection handlers
  const handleTogglePostSelection = (postId: string) => {
    setSelectedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleSelectAllPosts = () => {
    const allPostIds = new Set<string>();
    
    // Add all scheduled posts from calendar
    Object.values(scheduledPosts).forEach(weekPosts => {
      weekPosts.forEach(post => allPostIds.add(post.id));
    });
    
    setSelectedPosts(allPostIds);
  };

  const handleDeselectAllPosts = () => {
    setSelectedPosts(new Set());
  };

  const handleDeleteSelectedPosts = async () => {
    if (selectedPosts.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedPosts.size} post${selectedPosts.size > 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    setDeletingPostIds(new Set(selectedPosts));
    
    try {
      const deletePromises = Array.from(selectedPosts).map(async (postId) => {
        const response = await fetch(`/api/calendar/scheduled/${postId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete post ${postId}`);
        }
        
        return { postId, success: true };
      });
      
      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        // Update scheduled posts locally
        setScheduledPosts(prevScheduled => {
          const updated = { ...prevScheduled };
          Object.keys(updated).forEach(date => {
            updated[date] = updated[date].filter(post => !selectedPosts.has(post.id));
          });
          return updated;
        });
        
        console.log(`✅ Successfully deleted ${successful} post${successful > 1 ? 's' : ''}`);
      }
      
      if (failed > 0) {
        console.error(`❌ Failed to delete ${failed} post${failed > 1 ? 's' : ''}`);
        alert(`Failed to delete ${failed} post${failed > 1 ? 's' : ''}. Please try again.`);
      }
      
    } catch (error) {
      console.error('Error deleting posts:', error);
      alert('An error occurred while deleting posts. Please try again.');
    } finally {
      setDeletingPostIds(new Set());
      setSelectedPosts(new Set());
    }
  };

  const handleCreateShareLink = async () => {
    if (selectedPosts.size === 0) {
      alert('Please select at least one post to share for approval');
      return;
    }

    setIsCreatingSession(true);
    try {
      // Determine project_id: use filter if it's a specific project, otherwise null for client-wide
      const projectId = selectedProjectFilter !== 'all' && selectedProjectFilter !== 'untagged' 
        ? selectedProjectFilter 
        : null;
      
      const response = await fetch('/api/approval-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          client_id: clientId,
          selected_post_ids: Array.from(selectedPosts)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const { session, share_url } = await response.json();
      
      // For now, just copy to clipboard and show alert
      await navigator.clipboard.writeText(share_url);
      alert(`Share link copied to clipboard!\n\nLink: ${share_url}\nExpires: ${new Date(session.expires_at).toLocaleDateString()}\n\nSelected ${selectedPosts.size} posts for approval`);
      
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
            .from('calendar_scheduled_posts')
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
    
    // Show results
    if (failCount === 0) {
      alert(`Successfully scheduled ${successCount} posts to ${account.platform}!`);
    } else {
      alert(`Scheduled ${successCount} posts to ${account.platform}.\n\nFailed: ${failCount}`);
    }
  };




  return (
    <div className="min-h-screen bg-background">
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


      {/* Merged Header - Single Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          {/* Left Section - Back Button + Title */}
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/client/${clientId}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-2xl font-bold text-gray-700">
                Content Calendar
              </h1>
            </div>
          </div>
          
          {/* Right Section - Dropdown + Create Button + User Profile */}
          <div className="flex items-center space-x-4">
            {/* Project Filter Dropdown */}
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="all">All Projects</option>
              <option value="untagged">Untagged</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            
            {/* Create Content Button */}
            <Link
              href={`/dashboard/client/${clientId}/content-suite`}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-300 via-purple-500 to-purple-700 hover:from-pink-400 hover:via-purple-600 hover:to-purple-800 text-white rounded-md shadow-sm hover:shadow-md transition-all duration-300"
            >
              <Plus className="w-5 h-5 mr-2 stroke-[2.5]" />
              Create Content
            </Link>
            
            {/* User Profile Info */}
            <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-700" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              
              {/* Profile Settings Button */}
              <Link href="/profile">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Profile Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </div>
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
        

        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-4">
          {/* Left side - Delete button */}
          {selectedPosts.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className={`px-4 py-2 text-white rounded flex items-center gap-2 ${
                isDeleting ? 'opacity-50 cursor-not-allowed bg-red-500' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isDeleting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isDeleting ? 'Deleting...' : `Delete ${selectedPosts.size} Selected Posts`}
            </button>
          )}
          
          {/* Right side - Schedule buttons */}
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
                    {isScheduling ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {account.platform === 'facebook' && <FacebookIcon size={16} />}
                        {account.platform === 'instagram' && <InstagramIcon size={16} />}
                        {account.platform === 'twitter' && <TwitterIcon size={16} />}
                        {account.platform === 'linkedin' && <LinkedInIcon size={16} />}
                        <span>Schedule</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Week
            </button>
            <div className="flex items-center justify-center">
              <h2 className="text-lg font-semibold">
                {selectedProjectFilter === 'all' 
                  ? 'All Projects - Week View' 
                  : selectedProjectFilter === 'untagged' 
                    ? 'Untagged Posts - Week View'
                    : `${projects.find(p => p.id === selectedProjectFilter)?.name || 'Project'} - Week View`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              
              {/* Share Button */}
              <button
                onClick={handleCreateShareLink}
                disabled={isCreatingSession || selectedPosts.size === 0}
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
              
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
              >
                Next Week
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>


            <div className="p-4 space-y-4">
            <div className="">
              <div className="space-y-4" style={{ gap: '16px' }}>
                {getWeeksToDisplay().map((weekStart, weekIndex) => (
                  <div key={weekIndex} className="border rounded-lg bg-white min-h-32 flex-1">
                    {/* Week Header - Above the days */}
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
                    
                    <div className="p-2 flex-1 overflow-x-auto">
                      <div className="flex space-x-1 min-w-max">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIndex) => {
                        const dayDate = new Date(weekStart);
                        dayDate.setDate(weekStart.getDate() + dayIndex);
                        const isToday = dayDate.toDateString() === new Date().toDateString();
                        
                        const dateKey = dayDate.toLocaleDateString('en-CA');
                        const isDragOver = dragOverDate === dateKey;
                        
                        return (
                          <div
                            key={day}
                            className={`p-2 rounded border-2 border-transparent transition-all duration-200 min-w-[200px] min-h-[160px] flex-shrink-0 ${
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
                            {/* Day Header */}
                            <div className="mb-2 pb-2 border-b border-gray-200">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{day}</span>
                                <span className="text-gray-500">{dayDate.getDate()}</span>
                              </div>
                            </div>
                            
                            {/* Loading state for scheduled posts */}
                            {isLoadingScheduledPosts && (
                              <div className="flex items-center justify-center py-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-xs text-gray-500">Loading...</span>
                              </div>
                            )}
                            
                            {/* Display scheduled posts */}
                            {!isLoadingScheduledPosts && scheduledPosts[dayDate.toLocaleDateString('en-CA')] && (
                              <div className="flex gap-1">
                                {scheduledPosts[dayDate.toLocaleDateString('en-CA')].map((post: Post, idx: number) => {
                                  const isDeleting = deletingPostIds.has(post.id);
                                  const isScheduling = schedulingPostIds.has(post.id);
                                  const isEditingTime = editingTimePostIds.has(post.id);
                                  const isMoving = movingPostId === post.id;
                                  return (
                                    <div key={idx} className="flex-1 w-[260px] min-h-[390px]">
                                  {editingPostId === post.id ? (
                                    <div className="relative">
                                      {/* Time input overlay */}
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
                                        className="absolute top-2 left-2 z-10 text-xs p-1 rounded border bg-white shadow-lg"
                                        autoFocus
                                      />
                                      {/* Full card content below - same as normal card but with opacity */}
                                      <div className="opacity-50">
                                        <div 
                                          draggable={!isDeleting && !isScheduling && !isEditingTime && !isMoving}
                                          onDragStart={(e) => !isDeleting && !isScheduling && !isEditingTime && !isMoving && (() => {
                                            e.dataTransfer.setData('scheduledPost', JSON.stringify(post));
                                            e.dataTransfer.setData('originalDate', dayDate.toLocaleDateString('en-CA')); // Keeps local timezone
                                          })()}
                                          className={`border rounded-lg p-2 hover:shadow-sm transition-shadow w-full flex flex-col ${
                                            isDeleting 
                                              ? 'cursor-not-allowed opacity-50 bg-red-50 border-red-300' 
                                              : isScheduling
                                                ? 'cursor-not-allowed opacity-50 bg-yellow-50 border-yellow-300'
                                                : isEditingTime
                                                  ? 'cursor-not-allowed opacity-50 bg-purple-50 border-purple-300'
                                                  : isMoving
                                                    ? 'cursor-not-allowed opacity-50 bg-orange-50 border-orange-300'
                                                  : `cursor-move ${
                                                      post.approval_status === 'approved' ? 'border-green-200 bg-green-50' :
                                                      post.approval_status === 'rejected' ? 'border-red-200 bg-red-50' :
                                                      post.approval_status === 'needs_attention' ? 'border-orange-200 bg-orange-50' :
                                                      'border-gray-200 bg-white'
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
                                              {/* Card Title - Day, Date, and Time */}
                                              <div className="mb-2 pb-1 border-b border-gray-200">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <div className="flex gap-0.5">
                                                      <div className="flex flex-col gap-0.5">
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                      </div>
                                                      <div className="flex flex-col gap-0.5">
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                      </div>
                                                    </div>
                                                    <div>
                                                      <h4 className="font-semibold text-xs text-gray-700">
                                                        {day} {dayDate.getDate()}
                                                      </h4>
                                                      <p className="text-xs text-gray-600">
                                                        <span 
                                                          className="cursor-pointer hover:text-gray-800"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingPostId(post.id);
                                                          }}
                                                          title="Click to edit time"
                                                        >
                                                          {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                                        </span>
                                                      </p>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Post Selection Checkbox */}
                                                  <div className="flex items-center">
                                                    <input
                                                      type="checkbox"
                                                      checked={selectedPosts.has(post.id)}
                                                      onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleTogglePostSelection(post.id);
                                                      }}
                                                      className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                                      title="Select post for sharing or deletion"
                                                    />
                                                  </div>
                                                </div>
                                                
                                                {/* Project Badge - Full width below header */}
                                                {post.project_id && projects.find(p => p.id === post.project_id) && (
                                                  <div className="mt-1">
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                      {projects.find(p => p.id === post.project_id)?.name}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Edit Indicators, Approval Status, and Edit Button */}
                                              <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1">
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
                                                
                                                {/* Edit Button */}
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Navigate to content suite with editPostId parameter in same tab
                                                    window.location.href = `/dashboard/client/${clientId}/content-suite?editPostId=${post.id}`;
                                                  }}
                                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                                  title="Edit content"
                                                >
                                                  Edit
                                                </button>
                                              </div>

                                              {/* Post Image */}
                                              {post.image_url && (
                                                <div className="w-full mb-2 rounded overflow-hidden">
                                                  <img 
                                                    src={post.image_url || '/api/placeholder/100/100'} 
                                                    alt="Post"
                                                    className="w-full h-auto object-contain"
                                                    onError={(e) => {
                                                      console.log('Scheduled post image failed to load, using placeholder for post:', post.id);
                                                      e.currentTarget.src = '/api/placeholder/100/100';
                                                    }}
                                                  />
                                                </div>
                                              )}
                                              
                                              {/* Caption */}
                                              <div className="mb-2 flex-1 overflow-hidden">
                                                <p className="text-xs text-gray-700 line-clamp-3">
                                                  {post.caption}
                                                </p>
                                              </div>
                                              
                                              {/* Client Feedback */}
                                              {post.client_feedback && (
                                                <div className="mt-1 p-1 bg-gray-50 rounded text-xs flex-shrink-0">
                                                  <span className="font-medium text-gray-700">Feedback:</span>
                                                  <p className="mt-1 text-gray-600 line-clamp-2">{post.client_feedback}</p>
                                                </div>
                                              )}

                                              {/* Platform Icons */}
                                              {post.platforms_scheduled && post.platforms_scheduled.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                                                  {post.platforms_scheduled.map((platform, platformIdx) => (
                                                    <div key={platformIdx} className="w-3 h-3 flex items-center justify-center" title={`Scheduled to ${platform}`}>
                                                      {platform === 'facebook' && <FacebookIcon size={10} className="text-blue-600" />}
                                                      {platform === 'instagram' && <InstagramIcon size={10} className="text-pink-600" />}
                                                      {platform === 'twitter' && <TwitterIcon size={10} className="text-sky-500" />}
                                                      {platform === 'linkedin' && <LinkedInIcon size={10} className="text-blue-700" />}
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div 
                                      draggable={!isDeleting && !isScheduling && !isEditingTime && !isMoving}
                                      onDragStart={(e) => !isDeleting && !isScheduling && !isEditingTime && !isMoving && (() => {
                                        e.dataTransfer.setData('scheduledPost', JSON.stringify(post));
                                        e.dataTransfer.setData('originalDate', dayDate.toLocaleDateString('en-CA')); // Keeps local timezone
                                      })()}
                                      className={`border rounded-lg p-2 hover:shadow-sm transition-shadow w-full flex flex-col ${
                                        isDeleting 
                                          ? 'cursor-not-allowed opacity-50 bg-red-50 border-red-300' 
                                          : isScheduling
                                            ? 'cursor-not-allowed opacity-50 bg-yellow-50 border-yellow-300'
                                            : isEditingTime
                                              ? 'cursor-not-allowed opacity-50 bg-purple-50 border-purple-300'
                                              : isMoving
                                                ? 'cursor-not-allowed opacity-50 bg-orange-50 border-orange-300'
                                              : `cursor-move ${
                                                  post.approval_status === 'approved' ? 'border-green-200 bg-green-50' :
                                                  post.approval_status === 'rejected' ? 'border-red-200 bg-red-50' :
                                                  post.approval_status === 'needs_attention' ? 'border-orange-200 bg-orange-50' :
                                                  'border-gray-200 bg-white'
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
                                        {/* Card Title - Day, Date, and Time */}
                                        <div className="mb-2 pb-1 border-b border-gray-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="flex gap-0.5">
                                                <div className="flex flex-col gap-0.5">
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                                </div>
                                              </div>
                                              <div>
                                                <h4 className="font-semibold text-xs text-gray-700">
                                                  {day} {dayDate.getDate()}
                                                </h4>
                                                <p className="text-xs text-gray-600">
                                                  <span 
                                                    className="cursor-pointer hover:text-gray-800"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingPostId(post.id);
                                                    }}
                                                    title="Click to edit time"
                                                  >
                                                    {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                                  </span>
                                                </p>
                                              </div>
                                            </div>
                                            
                                            {/* Post Selection Checkbox */}
                                            <div className="flex items-center">
                                              <input
                                                type="checkbox"
                                                checked={selectedPosts.has(post.id)}
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  handleTogglePostSelection(post.id);
                                                }}
                                                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                                title="Select post for sharing or deletion"
                                              />
                                            </div>
                                          </div>
                                          
                                          {/* Project Badge - Full width below header */}
                                          {post.project_id && projects.find(p => p.id === post.project_id) && (
                                            <div className="mt-1">
                                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                {projects.find(p => p.id === post.project_id)?.name}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Edit Indicators, Approval Status, and Edit Button */}
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-1">
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
                                          
                                          {/* Edit Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // Navigate to content suite with editPostId parameter in same tab
                                              window.location.href = `/dashboard/client/${clientId}/content-suite?editPostId=${post.id}`;
                                            }}
                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                            title="Edit content"
                                          >
                                            Edit
                                          </button>
                                        </div>

                                        {/* Post Image */}
                                        {post.image_url && (
                                          <div className="w-full mb-2 rounded overflow-hidden">
                                            <img 
                                              src={post.image_url || '/api/placeholder/100/100'} 
                                              alt="Post"
                                              className="w-full h-auto object-contain"
                                              onError={(e) => {
                                                console.log('Scheduled post image failed to load, using placeholder for post:', post.id);
                                                e.currentTarget.src = '/api/placeholder/100/100';
                                              }}
                                            />
                                          </div>
                                        )}
                                        
                                        {/* Caption */}
                                        <div className="mb-2 flex-1 overflow-hidden">
                                          <p className="text-xs text-gray-700 line-clamp-3">
                                            {post.caption}
                                          </p>
                                        </div>
                                        
                                        {/* Client Feedback */}
                                        {post.client_feedback && (
                                          <div className="mt-1 p-1 bg-gray-50 rounded text-xs flex-shrink-0">
                                            <span className="font-medium text-gray-700">Feedback:</span>
                                            <p className="mt-1 text-gray-600 line-clamp-2">{post.client_feedback}</p>
                                          </div>
                                        )}

                                        {/* Platform Icons */}
                                        {post.platforms_scheduled && post.platforms_scheduled.length > 0 && (
                                          <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                                            {post.platforms_scheduled.map((platform, platformIdx) => (
                                              <div key={platformIdx} className="w-3 h-3 flex items-center justify-center" title={`Scheduled to ${platform}`}>
                                                {platform === 'facebook' && <FacebookIcon size={10} className="text-blue-600" />}
                                                {platform === 'instagram' && <InstagramIcon size={10} className="text-pink-600" />}
                                                {platform === 'twitter' && <TwitterIcon size={10} className="text-sky-500" />}
                                                {platform === 'linkedin' && <LinkedInIcon size={10} className="text-blue-700" />}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              );
                                })}
                              </div>
                            )}

                            {/* Display client uploads */}
                            {!isLoadingScheduledPosts && clientUploads[dayDate.toLocaleDateString('en-CA')]?.map((upload: ClientUpload, idx: number) => (
                              <div key={`upload-${idx}`} className="mt-2">
                                <div className="flex-shrink-0 w-64 border-2 border-blue-300 rounded-lg p-3 bg-blue-50 hover:shadow-md transition-shadow">
                                  {/* Upload Header */}
                                  <div className="mb-2 pb-2 border-b border-blue-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="text-xs font-semibold text-blue-700">Client Upload</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Upload Image */}
                                  {upload.file_type?.startsWith('image/') ? (
                                    <div className="w-full mb-2 rounded overflow-hidden border border-blue-200">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img 
                                        src={upload.file_url || '/api/placeholder/100/100'} 
                                        alt={upload.file_name}
                                        className="w-full h-auto object-contain"
                                        onError={(e) => {
                                          console.log('Upload image failed to load, using placeholder for upload:', upload.id);
                                          e.currentTarget.src = '/api/placeholder/100/100';
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-full h-32 bg-blue-100 rounded-lg border border-blue-200 flex items-center justify-center mb-2">
                                      <div className="text-center">
                                        <svg className="w-8 h-8 text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-xs text-blue-600 mt-2">{upload.file_name}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {upload.notes && (
                                    <div className="mb-2 p-2 bg-white rounded border border-blue-200">
                                      <span className="text-xs font-medium text-blue-700">Notes:</span>
                                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                        {upload.notes}
                                      </p>
                                    </div>
                                  )}

                                  {/* File info and Edit button */}
                                  <div className="flex items-center justify-between text-xs text-blue-600 mb-2">
                                    <span>{new Date(upload.created_at).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="bg-blue-200 px-2 py-0.5 rounded">{upload.status}</span>
                                  </div>

                                  {/* Edit Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Store upload data in sessionStorage to pre-fill content suite
                                      const uploadData = {
                                        image: upload.file_url,
                                        notes: upload.notes || '',
                                        fileName: upload.file_name,
                                        uploadId: upload.id,
                                        scheduledDate: dayDate.toLocaleDateString('en-CA'), // Store the date this upload was on
                                        scheduledTime: '12:00:00' // Default time for the new post
                                      };
                                      sessionStorage.setItem('preloadedContent', JSON.stringify(uploadData));
                                      
                                      // Navigate to content suite with uploadId parameter
                                      window.location.href = `/dashboard/client/${clientId}/content-suite?uploadId=${upload.id}`;
                                    }}
                                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors font-medium"
                                    title="Edit in Content Suite"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            ))}

                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          
        </div>
      </div>
    </div>
  );
}

