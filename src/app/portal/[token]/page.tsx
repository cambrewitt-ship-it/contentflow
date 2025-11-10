"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Check, X, AlertTriangle, Minus, CheckCircle, XCircle, FileText, Calendar, Columns } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MonthViewCalendar } from '@/components/MonthViewCalendar';
import { PortalColumnViewCalendar } from '@/components/PortalColumnViewCalendar';

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

interface Upload {
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

export default function PortalCalendarPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [uploads, setUploads] = useState<{[key: string]: Upload[]}>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingScheduledPosts, setIsLoadingScheduledPosts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [isLoadingUploads, setIsLoadingUploads] = useState(false);
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const columnUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingColumnUploadDate, setPendingColumnUploadDate] = useState<string | null>(null);
  
  // Drag and drop state for column view
  const [movingItems, setMovingItems] = useState<{[key: string]: boolean}>({});
  
  // Delete states
  const [deletingItems, setDeletingItems] = useState<{[key: string]: boolean}>({});
  const deletingUploadIds = useMemo(() => {
    const ids = new Set<string>();
    Object.entries(deletingItems).forEach(([key, value]) => {
      if (value && key.startsWith('upload-') && value) {
        ids.add(key.slice('upload-'.length));
      }
    });
    return ids;
  }, [deletingItems]);
  
  // Approval states
  const [selectedPosts, setSelectedPosts] = useState<{[key: string]: 'approved' | 'rejected' | 'needs_attention'}>({});
  const [comments, setComments] = useState<{[key: string]: string}>({});
  const [editedCaptions, setEditedCaptions] = useState<{[key: string]: string}>({});
  const [isSubmittingApprovals, setIsSubmittingApprovals] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // View mode state
  const [viewMode, setViewMode] = useState<'column' | 'month'>('column');

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

  // Calculate week offset for a given date
  const getWeekOffsetForDate = (date: Date) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = targetStart.getTime() - todayStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate week offset (positive for future weeks, negative for past weeks)
    return Math.floor(diffDays / 7);
  };

  // Handle date click from month view
  const handleDateClick = (date: Date) => {
    const weekOffset = getWeekOffsetForDate(date);
    setWeekOffset(weekOffset);
    setViewMode('column');
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
      
      // Calculate date range for calendar views (3 weeks to support column layout)
      const weeksToFetch = 3;
      const startOfWeek = getStartOfWeek(weekOffset);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + (weeksToFetch * 7) - 1);

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
  }, [token, weekOffset]); // Remove problematic dependencies that cause infinite loops

  // Fetch uploads for the current date range
  const fetchUploads = useCallback(async () => {
    if (!token || isLoadingUploads) return; // Prevent multiple simultaneous calls
    
    setIsLoadingUploads(true);
    try {
      const response = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch uploads');
      }

      const data = await response.json();
      const uploadsList = data.uploads || [];
      
      // Group uploads by date
      const uploadsByDate: {[key: string]: Upload[]} = {};
      uploadsList.forEach((upload: Upload) => {
        const uploadDate = new Date(upload.created_at).toLocaleDateString('en-CA');
        if (!uploadsByDate[uploadDate]) {
          uploadsByDate[uploadDate] = [];
        }
        uploadsByDate[uploadDate].push(upload);
      });
      
      setUploads(uploadsByDate);
    } catch (err) {
      console.error('Error fetching uploads:', err);
    } finally {
      setIsLoadingUploads(false);
    }
  }, [token, isLoadingUploads]);

  // Handle file upload
  const handleFileUpload = async (files: FileList, targetDate: string) => {
    if (files.length === 0) return;

    setUploading(true);
    console.log(`📤 Uploading files to date: ${targetDate}`);

    try {
      for (const file of Array.from(files)) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to portal
        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: base64,
            notes: '',
            targetDate: targetDate // Pass the target date
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // Refresh uploads list
      await fetchUploads();
    } catch (err) {
      console.error('Error uploading files:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleColumnAddUpload = (dateKey: string) => {
    setPendingColumnUploadDate(dateKey);
    if (columnUploadInputRef.current) {
      columnUploadInputRef.current.value = '';
    }
    requestAnimationFrame(() => {
      columnUploadInputRef.current?.click();
    });
  };

  const handleColumnUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const targetDate = pendingColumnUploadDate;

    if (!files || files.length === 0 || !targetDate) {
      setPendingColumnUploadDate(null);
      event.target.value = '';
      return;
    }

    try {
      await handleFileUpload(files, targetDate);
    } finally {
      setPendingColumnUploadDate(null);
      event.target.value = '';
    }
  };

  // Handle notes editing
  const handleEditNotes = (uploadId: string, currentNotes: string) => {
    setEditingNotes(uploadId);
    setTempNotes(currentNotes || '');
  };

  const handleSaveNotes = async (uploadId: string) => {
    try {
      const response = await fetch('/api/portal/upload', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          uploadId,
          notes: tempNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update notes');
      }

      // Update local state
      setUploads(prev => {
        const newUploads = { ...prev };
        Object.keys(newUploads).forEach(date => {
          newUploads[date] = newUploads[date].map(upload => 
            upload.id === uploadId 
              ? { ...upload, notes: tempNotes }
              : upload
          );
        });
        return newUploads;
      });

      setEditingNotes(null);
      setTempNotes('');
    } catch (err) {
      console.error('Error updating notes:', err);
      alert('Failed to update notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setTempNotes('');
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-600" />;
    }
    return <File className="h-8 w-8 text-gray-600" />;
  };

  // Drag and drop handlers removed with week view; column view handles its own interactions

  // Delete handlers
  const handleDeleteUpload = async (uploadId: string, uploadDate: string) => {
    if (!confirm('Are you sure you want to delete this upload? This action cannot be undone.')) {
      return;
    }

    const itemKey = `upload-${uploadId}`;
    setDeletingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch('/api/portal/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          uploadId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      // Remove from local state
      setUploads(prev => {
        const newUploads = { ...prev };
        if (newUploads[uploadDate]) {
          newUploads[uploadDate] = newUploads[uploadDate].filter(upload => upload.id !== uploadId);
          if (newUploads[uploadDate].length === 0) {
            delete newUploads[uploadDate];
          }
        }
        return newUploads;
      });
    } catch (err) {
      console.error('Error deleting upload:', err);
      alert('Failed to delete upload. Please try again.');
    } finally {
      setDeletingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const handleDeleteUploadFromCalendar = (upload: Upload) => {
    const existingEntry = Object.entries(uploads).find(([, items]) =>
      items.some(item => item.id === upload.id)
    );
    const uploadDateKey =
      existingEntry?.[0] ||
      (upload.created_at ? new Date(upload.created_at).toLocaleDateString('en-CA') : null);

    if (!uploadDateKey) {
      console.warn('Unable to determine upload date for deletion', upload);
      return;
    }

    void handleDeleteUpload(upload.id, uploadDateKey);
  };

  const handleDeletePost = async (postId: string, postDate: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    const itemKey = `post-${postId}`;
    setDeletingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch('/api/calendar/scheduled', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Remove from local state
      setScheduledPosts(prev => {
        const newPosts = { ...prev };
        if (newPosts[postDate]) {
          newPosts[postDate] = newPosts[postDate].filter(post => post.id !== postId);
          if (newPosts[postDate].length === 0) {
            delete newPosts[postDate];
          }
        }
        return newPosts;
      });
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeletingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  // Approval handlers
  const handlePostSelection = (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => {
    setSelectedPosts(prev => {
      const newSelected = { ...prev };
      if (status === null) {
        delete newSelected[postKey];
      } else {
        newSelected[postKey] = status;
      }
      return newSelected;
    });
  };

  const handleCommentChange = (postKey: string, comment: string) => {
    setComments(prev => ({
      ...prev,
      [postKey]: comment
    }));
  };

  const handleCaptionChange = (postKey: string, caption: string) => {
    setEditedCaptions(prev => ({
      ...prev,
      [postKey]: caption
    }));
  };

  const handleSubmitApprovals = async () => {
    if (Object.keys(selectedPosts).length === 0) {
      alert('Please select at least one post to approve or reject');
      return;
    }

    console.log('🚀 Starting approval submission:', selectedPosts);
    setIsSubmittingApprovals(true);
    setError(null);

    try {
      const promises = Object.entries(selectedPosts).map(async ([postKey, approvalStatus]) => {
        console.log(`📝 Processing post ${postKey} with status ${approvalStatus}`);
        
        // Split on the first hyphen only (UUIDs contain hyphens)
        const firstHyphenIndex = postKey.indexOf('-');
        const postId = postKey.substring(firstHyphenIndex + 1);
        
        // Portal calendar posts come from calendar_scheduled_posts table, so use 'planner_scheduled' type
        const postType = 'planner_scheduled';
        
        console.log(`🔍 Parsed key "${postKey}" -> postType: "${postType}", postId: "${postId}"`);
        
        const editedCaption = editedCaptions[postKey];
        const post = Object.values(scheduledPosts)
          .flat()
          .find(p => p.id === postId);
        
        if (!post) {
          console.error(`❌ Post not found for key ${postKey}`);
          throw new Error(`Post not found for key ${postKey}`);
        }

        const hasEditedCaption = editedCaption && editedCaption !== post.caption;
        
        console.log(`🔄 Making API call for post ${postId}:`, {
          token: token.substring(0, 8) + '...',
          post_id: post.id,
          post_type: postType,
          approval_status: approvalStatus,
          has_comments: !!comments[postKey],
          has_edited_caption: hasEditedCaption
        });
        
        const response = await fetch('/api/portal/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            post_id: post.id,
            post_type: postType,
            approval_status: approvalStatus,
            client_comments: comments[postKey] || '',
            edited_caption: hasEditedCaption ? editedCaption : undefined
          })
        });
        
        console.log(`📡 API response for ${postId}:`, response.status, response.statusText);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`❌ API error for ${postId}:`, errorData);
          throw new Error(errorData.error || `Failed to submit approval for post ${postId}`);
        }
        
        const result = await response.json();
        console.log(`✅ API success for ${postId}:`, result);
        
        return { postKey, success: true, result };
      });

      const results = await Promise.allSettled(promises);
      console.log('✅ Approval submission results:', results);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error('❌ Some submissions failed:', failures);
        const errorMessages = failures.map(f => f.reason?.message || 'Unknown error');
        throw new Error(`Some submissions failed: ${errorMessages.join(', ')}`);
      }
      
      const successes = results.filter(result => result.status === 'fulfilled');
      console.log(`✅ Successfully submitted ${successes.length} approvals`);
      
      // Clear selections and refresh data
      setSelectedPosts({});
      setComments({});
      setEditedCaptions({});
      
      console.log('🔄 Refreshing calendar data...');
      await fetchScheduledPosts(0, true);
      console.log('✅ Calendar data refreshed');
      
      // Show success message
      const count = Object.keys(selectedPosts).length;
      setSuccessMessage(`Successfully submitted ${count} approval(s)! Your feedback has been sent to the team.`);
      setTimeout(() => setSuccessMessage(null), 8000);
      
    } catch (error) {
      console.error('Error submitting approvals:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit approvals');
    } finally {
      setIsSubmittingApprovals(false);
    }
  };

  // Debounced effect to prevent rapid API calls
  useEffect(() => {
    if (!token) return;
    
    const timeoutId = setTimeout(() => {
      fetchScheduledPosts(0, true);
      fetchUploads();
    }, 100); // Small delay to debounce rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [token, weekOffset]); // Remove function dependencies to prevent infinite loops

  const getWeeksToDisplay = (count: number = 2) => {
    const weeks = [];
    for (let i = 0; i < count; i++) {
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

  const handleColumnPostMove = async (postKey: string, newDate: string) => {
    const firstHyphenIndex = postKey.indexOf('-');
    const postId = firstHyphenIndex >= 0 ? postKey.substring(firstHyphenIndex + 1) : postKey;

    let sourceDate: string | null = null;
    let movingPost: Post | undefined;

    for (const [dateKey, posts] of Object.entries(scheduledPosts)) {
      const foundPost = posts.find((post) => post.id === postId);
      if (foundPost) {
        sourceDate = dateKey;
        movingPost = foundPost;
        break;
      }
    }

    if (!movingPost || !sourceDate || sourceDate === newDate) {
      return;
    }

    const itemKey = `post-${postId}`;
    const previousState: {[key: string]: Post[]} = JSON.parse(JSON.stringify(scheduledPosts));

    setMovingItems((prev) => ({ ...prev, [itemKey]: true }));

    setScheduledPosts((prev) => {
      const updated = { ...prev };

      if (updated[sourceDate]) {
        updated[sourceDate] = updated[sourceDate].filter((post) => post.id !== postId);
        if (updated[sourceDate].length === 0) {
          delete updated[sourceDate];
        }
      }

      const updatedPost = { ...movingPost, scheduled_date: newDate };
      const targetPosts = updated[newDate] ? [...updated[newDate], updatedPost] : [updatedPost];

      targetPosts.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));

      updated[newDate] = targetPosts;

      return updated;
    });

    try {
      const response = await fetch('/api/calendar/scheduled', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: movingPost.id,
          updates: {
            scheduled_date: newDate,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to move post');
      }
    } catch (err) {
      console.error('Error moving post in column view:', err);
      setScheduledPosts(previousState);
      await fetchScheduledPosts(0, true);
      alert('Failed to move post. Please try again.');
    } finally {
      setMovingItems((prev) => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
    }
  };

  // Helper function to get approval status badge
  const getApprovalStatusBadge = (post: Post) => {
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
            <FileText className="w-3 h-3 mr-1" />
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
            View your scheduled posts, upload content, and manage your content calendar
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => {
              if (!isLoadingScheduledPosts && !isLoadingUploads) {
                fetchScheduledPosts(0, true);
                fetchUploads();
              }
            }} 
            disabled={isLoadingScheduledPosts || isLoadingUploads}
            variant="outline" 
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingScheduledPosts || isLoadingUploads) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Submit Approvals Section */}
      {Object.keys(selectedPosts).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Submit Your Approvals</h3>
              <p className="text-sm text-gray-600 mt-1">
                {Object.keys(selectedPosts).length} post{Object.keys(selectedPosts).length !== 1 ? 's' : ''} selected for approval
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setSelectedPosts({});
                  setComments({});
                  setEditedCaptions({});
                }}
                variant="outline"
                disabled={isSubmittingApprovals}
              >
                Clear All
              </Button>
              
              <Button
                onClick={handleSubmitApprovals}
                disabled={isSubmittingApprovals || Object.keys(selectedPosts).length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmittingApprovals ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  `Submit ${Object.keys(selectedPosts).length} Approval${Object.keys(selectedPosts).length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
          
          {Object.keys(selectedPosts).length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium text-gray-900 mb-2">Selected posts:</div>
              <div className="space-y-1">
                {Object.entries(selectedPosts).map(([postKey, status]) => {
                  const postId = postKey.replace('post-', '');
                  const post = Object.values(scheduledPosts)
                    .flat()
                    .find(p => p.id === postId);
                  
                  if (!post) return null;
                  
                  return (
                    <div key={postKey} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded text-white ${
                        status === 'approved' ? 'bg-green-600' :
                        status === 'rejected' ? 'bg-red-600' :
                        'bg-orange-600'
                      }`}>
                        {status === 'approved' ? '✓ Approved' :
                         status === 'rejected' ? '✗ Rejected' :
                         '⚠ Improve'}
                      </span>
                      <span className="text-gray-600">
                        {post.scheduled_date && new Date(post.scheduled_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        })} - {post.caption.substring(0, 50)}...
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approval Status Summary */}
      {Object.keys(scheduledPosts).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Approval Status Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            {(() => {
              const allPosts = Object.values(scheduledPosts).flat();
              const approved = allPosts.filter(p => p.approval_status === 'approved').length;
              const rejected = allPosts.filter(p => p.approval_status === 'rejected').length;
              const needsAttention = allPosts.filter(p => p.approval_status === 'needs_attention').length;
              const pending = allPosts.filter(p => p.approval_status === 'pending' || !p.approval_status).length;
              
              return (
                <>
                  <div className="bg-green-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center mb-2">
                      <Check className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-green-800">Approved</span>
                    </div>
                    <div className="text-lg font-bold text-green-900">{approved}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center mb-2">
                      <X className="w-4 h-4 text-red-600 mr-2" />
                      <span className="text-sm font-medium text-red-800">Rejected</span>
                    </div>
                    <div className="text-lg font-bold text-red-900">{rejected}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                      <span className="text-sm font-medium text-orange-800">Needs Attention</span>
                    </div>
                    <div className="text-lg font-bold text-orange-900">{needsAttention}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center mb-2">
                      <Minus className="w-4 h-4 text-gray-600 mr-2" />
                      <span className="text-sm font-medium text-gray-800">Pending</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{pending}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-center mb-4 gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">
                Content Calendar - {viewMode === 'column' ? 'Column' : 'Month'} View
              </h2>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('column')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${
                    viewMode === 'column' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Columns className="w-4 h-4" />
                  Column
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${
                    viewMode === 'month' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Month
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="">
            {viewMode === 'column' && (
              <div className="bg-white rounded-lg shadow p-4">
                <PortalColumnViewCalendar
                  weeks={getWeeksToDisplay(3)}
                  scheduledPosts={scheduledPosts}
                  clientUploads={uploads}
                  loading={isLoadingScheduledPosts}
                  onPostMove={handleColumnPostMove}
                  formatWeekCommencing={formatWeekCommencing}
                  formatTimeTo12Hour={formatTimeTo12Hour}
                  onAddUploadClick={handleColumnAddUpload}
                  selectedPosts={selectedPosts}
                  onPostSelection={handlePostSelection}
                  comments={comments}
                  onCommentChange={handleCommentChange}
                  editedCaptions={editedCaptions}
                  onCaptionChange={handleCaptionChange}
                  onDeleteClientUpload={handleDeleteUploadFromCalendar}
                  deletingUploadIds={deletingUploadIds}
                />
                              </div>
                            )}

            {viewMode === 'month' && (
              <div className="bg-white rounded-lg shadow">
                <MonthViewCalendar 
                  posts={Object.values(scheduledPosts).flat()} 
                  uploads={uploads}
                  loading={isLoadingScheduledPosts}
                  onDateClick={handleDateClick}
                />
              </div>
            )}
          </div>
        </div>

      </div>

      <input
        ref={columnUploadInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleColumnUploadChange}
      />

      {/* Success Message */}
      {successMessage && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">{successMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}