"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Check, X, AlertTriangle, Minus, CheckCircle, XCircle, FileText, Plus, Upload, Image, File, GripVertical, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";
import { Textarea } from "components/ui/textarea";

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
  
  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<{type: 'post' | 'upload', id: string, sourceDate: string} | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [movingItems, setMovingItems] = useState<{[key: string]: boolean}>({});
  
  // Delete states
  const [deletingItems, setDeletingItems] = useState<{[key: string]: boolean}>({});

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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'post' | 'upload', id: string, sourceDate: string) => {
    setDraggedItem({ type, id, sourceDate });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, sourceDate }));
  };

  const handleDragOver = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(targetDate);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    setIsDragging(false);
    
    if (!draggedItem || draggedItem.sourceDate === targetDate) {
      setDraggedItem(null);
      return;
    }

    const itemKey = `${draggedItem.type}-${draggedItem.id}`;
    setMovingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      if (draggedItem.type === 'upload') {
        // Optimistic update for uploads
        const sourceDate = draggedItem.sourceDate;
        const targetDateTime = new Date(targetDate + 'T00:00:00.000Z');
        
        // Update local state immediately
        setUploads(prev => {
          const newUploads = { ...prev };
          if (newUploads[sourceDate]) {
            const uploadToMove = newUploads[sourceDate].find(upload => upload.id === draggedItem.id);
            if (uploadToMove) {
              // Remove from source date
              newUploads[sourceDate] = newUploads[sourceDate].filter(upload => upload.id !== draggedItem.id);
              // Add to target date
              if (!newUploads[targetDate]) {
                newUploads[targetDate] = [];
              }
              newUploads[targetDate] = [...newUploads[targetDate], {
                ...uploadToMove,
                created_at: targetDateTime.toISOString()
              }];
            }
          }
          return newUploads;
        });

        // API call
        const response = await fetch('/api/portal/upload', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            uploadId: draggedItem.id,
            newDate: targetDate
          })
        });

        if (!response.ok) {
          throw new Error('Failed to move upload');
        }
      } else if (draggedItem.type === 'post') {
        // Optimistic update for posts
        const sourceDate = draggedItem.sourceDate;
        
        // Update local state immediately
        setScheduledPosts(prev => {
          const newPosts = { ...prev };
          if (newPosts[sourceDate]) {
            const postToMove = newPosts[sourceDate].find(post => post.id === draggedItem.id);
            if (postToMove) {
              // Remove from source date
              newPosts[sourceDate] = newPosts[sourceDate].filter(post => post.id !== draggedItem.id);
              // Add to target date
              if (!newPosts[targetDate]) {
                newPosts[targetDate] = [];
              }
              newPosts[targetDate] = [...newPosts[targetDate], {
                ...postToMove,
                scheduled_date: targetDate
              }];
            }
          }
          return newPosts;
        });

        // API call
        const response = await fetch('/api/planner/scheduled', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId: draggedItem.id,
            updates: {
              scheduled_date: targetDate
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to move post');
        }
      }
    } catch (err) {
      console.error('Error moving item:', err);
      alert('Failed to move item. Please try again.');
      
      // Revert optimistic update on error
      if (draggedItem.type === 'upload') {
        await fetchUploads();
      } else if (draggedItem.type === 'post') {
        await fetchScheduledPosts(0, true);
      }
    } finally {
      setMovingItems(prev => ({ ...prev, [itemKey]: false }));
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverDate(null);
    setIsDragging(false);
  };

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

  const handleDeletePost = async (postId: string, postDate: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    const itemKey = `post-${postId}`;
    setDeletingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch('/api/planner/scheduled', {
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

  // Debounced effect to prevent rapid API calls
  useEffect(() => {
    if (!token) return;
    
    const timeoutId = setTimeout(() => {
      fetchScheduledPosts(0, true);
      fetchUploads();
    }, 100); // Small delay to debounce rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [token, weekOffset]); // Remove function dependencies to prevent infinite loops

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
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
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
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <Minus className="w-4 h-4 text-yellow-600 mr-2" />
                      <span className="text-sm font-medium text-yellow-800">Pending</span>
                    </div>
                    <div className="text-lg font-bold text-yellow-900 mt-1">{pending}</div>
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
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Week
            </button>
            <h2 className="text-lg font-semibold">
              Content Calendar - 4 Week View
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
              >
                Next Week
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-center mb-4 pb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Current Week
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
                  
                  <div className="p-2 flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex space-x-1 min-w-max">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIndex) => {
                        const dayDate = new Date(weekStart);
                        dayDate.setDate(weekStart.getDate() + dayIndex);
                        const isToday = dayDate.toDateString() === new Date().toDateString();
                        const dateKey = dayDate.toLocaleDateString('en-CA');
                        
                        return (
                          <div
                            key={day}
                            className={`p-2 rounded border-2 border-transparent transition-all duration-200 min-w-[200px] min-h-[160px] flex-shrink-0 ${
                              isToday 
                                ? 'bg-blue-50 border-blue-300' 
                                : 'bg-gray-50 hover:bg-gray-100'
                            } ${
                              dragOverDate === dateKey 
                                ? 'border-blue-400 bg-blue-100 border-dashed' 
                                : ''
                            }`}
                            onDragOver={(e) => handleDragOver(e, dateKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, dateKey)}
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
                            
                            {/* Drop Zone Indicator */}
                            {isDragging && dragOverDate === dateKey && (
                              <div className="mb-3 p-4 border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg text-center">
                                <div className="text-blue-600 font-medium text-sm">
                                  Drop here to move to {day} {dayDate.getDate()}
                                </div>
                              </div>
                            )}

                            {/* Upload Button */}
                            <div className="mb-3">
                              <Button
                                onClick={() => fileInputRefs.current[dateKey]?.click()}
                                disabled={uploading}
                                className="w-full h-12 bg-gray-800/20 backdrop-blur-md border border-gray-700/30 text-white hover:bg-gray-800/30 hover:border-gray-700/40 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all duration-200"
                                size="lg"
                              >
                                {uploading ? (
                                  <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-5 w-5" />
                                    Upload
                                  </>
                                )}
                              </Button>
                              <input
                                ref={(el) => {
                                  fileInputRefs.current[dateKey] = el;
                                }}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                onChange={(e) => e.target.files && handleFileUpload(e.target.files, dateKey)}
                                className="hidden"
                              />
                            </div>

                            {/* Display uploaded content */}
                            {isLoadingUploads && (
                              <div className="flex items-center justify-center py-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-xs text-gray-500">Loading uploads...</span>
                              </div>
                            )}
                            {!isLoadingUploads && uploads[dayDate.toLocaleDateString('en-CA')]?.map((upload: Upload, idx: number) => {
                              const itemKey = `upload-${upload.id}`;
                              const isMoving = movingItems[itemKey];
                              
                              return (
                                <div key={`upload-${idx}`} className="mt-2">
                                  <div 
                                    className={`flex-shrink-0 w-64 border rounded-lg p-3 hover:shadow-sm transition-shadow border-blue-200 bg-blue-50 cursor-move ${
                                      draggedItem?.type === 'upload' && draggedItem?.id === upload.id 
                                        ? 'opacity-50 scale-95' 
                                        : ''
                                    } ${isMoving ? 'opacity-75' : ''}`}
                                    draggable={!isMoving}
                                    onDragStart={(e) => !isMoving && handleDragStart(e, 'upload', upload.id, dayDate.toLocaleDateString('en-CA'))}
                                    onDragEnd={handleDragEnd}
                                  >
                                    {/* Loading indicator for moving items */}
                                    {isMoving && (
                                      <div className="absolute inset-0 bg-blue-100 bg-opacity-75 flex items-center justify-center rounded-lg">
                                        <div className="flex items-center gap-2 text-blue-600">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span className="text-sm font-medium">Moving...</span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Upload Header */}
                                  <div className="mb-3 pb-2 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                        {getFileIcon(upload.file_type)}
                                        <div>
                                          <p className="text-xs text-gray-600">
                                            {formatFileSize(upload.file_size)}
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteUpload(upload.id, dayDate.toLocaleDateString('en-CA'))}
                                        disabled={deletingItems[`upload-${upload.id}`]}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                      >
                                        {deletingItems[`upload-${upload.id}`] ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Upload Image/File Display */}
                                  {upload.file_type.startsWith('image/') ? (
                                    <div className="w-full mb-2 rounded overflow-hidden">
                                      <img 
                                        src={upload.file_url} 
                                        alt={upload.file_name}
                                        className="w-full h-auto object-contain"
                                        onError={(e) => {
                                          console.log('Upload image failed to load, using placeholder for upload:', upload.id);
                                          e.currentTarget.src = '/api/placeholder/100/100';
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-full h-32 bg-gray-100 rounded-lg border flex items-center justify-center mb-2">
                                      <div className="text-center">
                                        {getFileIcon(upload.file_type)}
                                        <p className="text-xs text-gray-400 mt-2">{formatFileSize(upload.file_size)}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes Section */}
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                      Post Notes
                                    </label>
                                    {editingNotes === upload.id ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={tempNotes}
                                          onChange={(e) => setTempNotes(e.target.value)}
                                          placeholder="Add notes about this content..."
                                          className="min-h-[60px] text-xs"
                                        />
                                        <div className="flex space-x-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleSaveNotes(upload.id)}
                                            className="flex-1 text-xs"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancelEdit}
                                            className="flex-1 text-xs"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <div 
                                          className="min-h-[60px] p-2 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                                          onClick={() => handleEditNotes(upload.id, upload.notes || '')}
                                        >
                                          {upload.notes ? (
                                            <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                              {upload.notes}
                                            </p>
                                          ) : (
                                            <p className="text-xs text-gray-400 italic">
                                              Click to add notes about this content...
                                            </p>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditNotes(upload.id, upload.notes || '')}
                                          className="w-full text-xs"
                                        >
                                          {upload.notes ? 'Edit Notes' : 'Add Notes'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                            })}
                            
                            {/* Display scheduled posts */}
                            {!isLoadingScheduledPosts && scheduledPosts[dayDate.toLocaleDateString('en-CA')]?.map((post: Post, idx: number) => {
                              const itemKey = `post-${post.id}`;
                              const isMoving = movingItems[itemKey];
                              
                              return (
                                <div key={idx} className="mt-1">
                                  <div 
                                    className={`flex-shrink-0 w-64 border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-move relative ${
                                      post.approval_status === 'approved' ? 'border-green-200 bg-green-50' :
                                      post.approval_status === 'rejected' ? 'border-red-200 bg-red-50' :
                                      post.approval_status === 'needs_attention' ? 'border-orange-200 bg-orange-50' :
                                      'border-gray-200 bg-white'
                                    } ${
                                      draggedItem?.type === 'post' && draggedItem?.id === post.id 
                                        ? 'opacity-50 scale-95' 
                                        : ''
                                    } ${isMoving ? 'opacity-75' : ''}`}
                                    draggable={!isMoving}
                                    onDragStart={(e) => !isMoving && handleDragStart(e, 'post', post.id, dayDate.toLocaleDateString('en-CA'))}
                                    onDragEnd={handleDragEnd}
                                  >
                                    {/* Loading indicator for moving items */}
                                    {isMoving && (
                                      <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center rounded-lg z-10">
                                        <div className="flex items-center gap-2 text-gray-600">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span className="text-sm font-medium">Moving...</span>
                                        </div>
                                      </div>
                                    )}
                                    {/* Card Title - Day, Date, and Time */}
                                    <div className="mb-3 pb-2 border-b border-gray-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <GripVertical className="h-4 w-4 text-gray-400" />
                                          <div>
                                            <h4 className="font-semibold text-sm text-gray-700">
                                              {day} {dayDate.getDate()}
                                            </h4>
                                            <p className="text-xs text-gray-600">
                                              {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePost(post.id, dayDate.toLocaleDateString('en-CA'))}
                                          disabled={deletingItems[`post-${post.id}`]}
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                        >
                                          {deletingItems[`post-${post.id}`] ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Approval Status Badge */}
                                    <div className="mb-2">
                                      {getApprovalStatusBadge(post)}
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
                                    <div className="mb-2">
                                      <p className="text-sm text-gray-700">
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

                                    {/* Platform Icons */}
                                    {post.platforms_scheduled && post.platforms_scheduled.length > 0 && (
                                      <div className="flex items-center gap-1 mt-2">
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
                                  </div>
                                </div>
                              );
                            })}
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
  );
}