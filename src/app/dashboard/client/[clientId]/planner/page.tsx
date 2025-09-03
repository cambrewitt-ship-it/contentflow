'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

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
  status: 'draft' | 'scheduled' | 'published';
  late_post_id?: string;
  platforms_scheduled?: string[];
  late_status?: string;
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
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId || null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  
  const [projectPosts, setProjectPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
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

  const fetchConnectedAccounts = async () => {
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
  };

  const fetchUnscheduledPosts = async () => {
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
      } catch (error) {
        console.error('Error fetching unscheduled posts:', error);
        setError(error instanceof Error ? error.message : 'Failed to load unscheduled posts');
      } finally {
        setIsLoadingPosts(false);
      }
    };

  const fetchScheduledPosts = async (retryCount = 0) => {
    if (!projectId) return;
    
    const maxRetries = 2;
    const baseLimit = 20; // Optimized for faster loading
    const retryLimit = Math.max(10, baseLimit - (retryCount * 5)); // Reduce limit on retries
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
        setError(null);
      }
      console.log(`🔍 OPTIMIZED FETCH - Scheduled posts for project: ${projectId} (attempt ${retryCount + 1}, limit: ${retryLimit})`);
      
      // Use optimized query with conditional image data loading
      const includeImageData = retryCount === 0; // Only load images on first attempt
      const response = await fetch(
        `/api/planner/scheduled?projectId=${projectId}&limit=${retryLimit}&includeImageData=${includeImageData}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 408) {
          // Handle timeout error with retry logic
          console.error('⏰ Query timeout:', errorData);
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying with reduced limit (${retryLimit})...`);
            return fetchScheduledPosts(retryCount + 1);
          } else {
            alert('Query timeout - the database is taking too long to respond. Please try again later or contact support.');
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
      
      // Handle optimized response format
      const posts = data.posts || [];
      const pagination = data.pagination;
      const performance = data.performance;
      
      console.log(`✅ Retrieved ${posts.length} scheduled posts`, pagination ? `(total: ${pagination.total})` : '');
      
      if (performance) {
        console.log(`⏱️ Query performance: ${performance.queryDuration} (optimized: ${performance.optimized})`);
        
        if (!performance.optimized) {
          console.warn('⚠️ Query took longer than expected - consider database optimization');
        }
      }
      
      // Debug image data (safe logging)
      if (posts.length > 0 && includeImageData) {
        console.log(`Found ${posts.length} scheduled posts with image data`);
        posts.forEach((post: Post, index: number) => {
          console.log(`Scheduled Post ${index}:`, {
            hasImage: !!post.image_url,
            imageType: typeof post.image_url,
            imageLength: post.image_url?.length || 0
          });
        });
      }
      
      // Map posts by date
      const mapped: {[key: string]: Post[]} = {};
      posts.forEach((post: Post) => {
        const dateKey = post.scheduled_date;
        if (dateKey && !mapped[dateKey]) mapped[dateKey] = [];
        if (dateKey) mapped[dateKey].push(post);
      });
      
      setScheduledPosts(mapped);
      setIsLoadingScheduledPosts(false);
      console.log('Scheduled posts loaded - dates:', Object.keys(mapped).length);
      
      // Handle pagination warnings
      if (pagination && pagination.hasMore) {
        console.warn(`⚠️ Only showing first ${pagination.limit} posts. There are ${pagination.total} total posts.`);
        
        // Show user notification for large datasets
        if (pagination.total > 100) {
          console.info(`💡 Consider implementing pagination for better performance with ${pagination.total} total posts`);
        }
      }
      
      // Success metrics
      if (retryCount > 0) {
        console.log(`🎉 Successfully loaded posts after ${retryCount + 1} attempts`);
      }
      
    } catch (error) {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(false);
      }
      console.error('❌ Error fetching scheduled posts:', error);
      
      // Retry logic for network errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (retryCount < maxRetries && (
        errorMessage.includes('fetch') || 
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNREFUSED')
      )) {
        console.log(`🔄 Network error, retrying... (attempt ${retryCount + 1})`);
        setTimeout(() => fetchScheduledPosts(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      // Show user-friendly error message
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        setError('Database query timeout. Please try again or contact support if the issue persists.');
      } else if (errorMessage.includes('404')) {
        console.log('No scheduled posts found - this is normal for new projects');
        setScheduledPosts({});
        setIsLoadingScheduledPosts(false);
      } else {
        setError(`Failed to load scheduled posts: ${errorMessage}`);
        setIsLoadingScheduledPosts(false);
      }
    }
  };

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
      fetchUnscheduledPosts();
      fetchScheduledPosts();
      fetchConnectedAccounts();
    }
  }, [projectId, clientId]);

  useEffect(() => {
    console.log('🔄 useEffect triggered - projectId:', projectId, 'projects.length:', projects.length);
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      console.log('🔍 Found project:', project);
      if (project) {
        setCurrentProject(project);
        setSelectedProject(projectId);
        // Fetch posts after project is loaded
        fetchUnscheduledPosts();
        fetchScheduledPosts();
      }
    }
  }, [projectId, projects]);

  const fetchProjects = async () => {
    if (!clientId) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/projects?clientId=${clientId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getWeeksToDisplay = () => {
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      weeks.push(getStartOfWeek(weekOffset + i));
    }
    return weeks;
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

  const handleDragLeave = (e: React.DragEvent, dateKey: string) => {
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
    if (!time24) return '';
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleEditScheduledPost = async (post: Post, newTime: string) => {
    if (!newTime || newTime === post.scheduled_time?.slice(0, 5)) return;
    
    try {
      // Add to editing time state
      setEditingTimePostIds(prev => new Set([...prev, post.id]));
      
      console.log('Updating post time to:', newTime);
      
      const response = await fetch('/api/planner/scheduled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            scheduled_time: newTime + ':00'
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
              ? { ...p, scheduled_time: newTime + ':00' }
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
      
      fetchScheduledPosts();
    } catch (error) {
      console.error('Error moving post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to move post: ${errorMessage}`);
    }
  };



  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedForDelete.size} posts?`)) return;
    
    // Set loading state for delete operation
    setIsDeleting(true);
    
    const errors = [];
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

  const handleScheduleToPlatform = async (account: ConnectedAccount) => {
    if (selectedPosts.size === 0) return;
    
    const confirmed = confirm(`Schedule ${selectedPosts.size} posts to ${account.platform}?`);
    if (!confirmed) return;
    
    // Set loading state for this specific platform
    setSchedulingPlatform(account.platform);
    
    const allScheduledPosts = Object.values(scheduledPosts).flat();
    const postsToSchedule = allScheduledPosts.filter(p => selectedPosts.has(p.id));
    
    // Add all posts to scheduling state
    setSchedulingPostIds(new Set(postsToSchedule.map(p => p.id)));
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
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
          throw new Error(`Media upload failed for post: ${post.caption.slice(0, 30)}...`);
        }
        
        const { lateMediaUrl } = await mediaResponse.json();
        
        // Step 2: Schedule via LATE
        const scheduledDateTime = `${post.scheduled_date}T${post.scheduled_time}`;
        
        console.log('🚀 STEP 4 - LATE API SCHEDULING:');
        console.log('  - Post from database:');
        console.log('    - scheduled_date:', post.scheduled_date);
        console.log('    - scheduled_time:', post.scheduled_time);
        console.log('  - Combined scheduledDateTime:', scheduledDateTime);
        console.log('  - Post ID:', post.id);
        console.log('  - Account platform:', account.platform);
        console.log('  - Client ID:', clientId);
        
        const lateRequestBody = {
          postId: post.id,
          caption: post.caption,
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
          throw new Error(`Schedule failed for post: ${post.caption.slice(0, 30)}...`);
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
        errors.push(error instanceof Error ? error.message : 'Unknown error');
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
      alert(`Scheduled ${successCount} posts to ${account.platform}.\n\nFailed: ${failCount}\nErrors:\n${errors.join('\n')}`);
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

      {/* Loading State */}
      {isLoadingPosts && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-sm text-blue-800">Loading posts...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">
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
          <h3 className="text-sm font-medium text-gray-700 mb-3">Posts in Project</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {projectPosts.length === 0 ? (
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
                        <img
                          src={post.image_url || '/api/placeholder/100/100'}
                          alt="Post"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Image failed to load, using placeholder for post:', post.id);
                            e.currentTarget.src = '/api/placeholder/100/100';
                          }}
                        />
                        {/* Delete button - positioned to not interfere with drag */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (confirm('Are you sure you want to delete this post?')) {
                              handleDeleteUnscheduledPost(post.id);
                            }
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-80 hover:opacity-100 transition-opacity"
                          title="Delete post"
                        >
                          ×
                        </button>
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
                return (
                  <button
                    key={account._id}
                    onClick={() => handleScheduleToPlatform(account)}
                    disabled={isScheduling}
                    className={`px-3 py-1.5 text-white rounded text-sm flex items-center gap-2 ${
                      isScheduling ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      account.platform === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' :
                      account.platform === 'twitter' ? 'bg-sky-500 hover:bg-sky-600' :
                      account.platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                      account.platform === 'linkedin' ? 'bg-blue-700 hover:bg-blue-800' :
                      'bg-gray-600 hover:bg-gray-700'
                    }`}
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
              <div className="grid grid-cols-4 gap-4">
                {getWeeksToDisplay().map((weekStart, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col border rounded-lg bg-white w-64">
                    <div className="bg-gray-50 p-3 border-b">
                      <h3 className="font-semibold text-sm">
                        Week {weekOffset + weekIndex + 1}
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
                                      draggable={!isDeleting && !isScheduling && !isEditingTime}
                                      onDragStart={(e) => !isDeleting && !isScheduling && !isEditingTime && (() => {
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
                                        <img 
                                          src={post.image_url || '/api/placeholder/100/100'} 
                                          alt="Post"
                                          className="w-8 h-8 object-cover rounded"
                                          onError={(e) => {
                                            console.log('Scheduled post image failed to load, using placeholder for post:', post.id);
                                            e.currentTarget.src = '/api/placeholder/100/100';
                                          }}
                                        />
                                        
                                        {/* Time Display - Clickable with more spacing */}
                                        <span 
                                          className="text-xs ml-4 px-2 py-1 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingPostId(post.id);
                                          }}
                                          title="Click to edit time"
                                        >
                                          {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                        </span>
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
        </div>
      </div>
    </div>
  );
}

