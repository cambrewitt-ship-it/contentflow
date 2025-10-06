'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Check, X, AlertTriangle, Minus, CheckCircle, XCircle, FileText, Plus, Upload, Image, File, GripVertical, Trash2, Edit3, MessageSquare } from 'lucide-react';
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
  post_type?: string;
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

export default function CalendarApprovalsPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [weekOffset, setWeekOffset] = useState(0);
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

  // Approval states
  const [selectedPosts, setSelectedPosts] = useState<{[key: string]: 'approved' | 'rejected' | 'needs_attention'}>({});
  const [comments, setComments] = useState<{[key: string]: string}>({});
  const [editedCaptions, setEditedCaptions] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [tempCaption, setTempCaption] = useState<string>('');

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
    
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < 30000 && Object.keys(scheduledPosts).length > 0) {
      console.log('📦 Using cached scheduled posts data');
      return;
    }
    
    const maxRetries = 1;
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
        setError(null);
      }
      console.log(`🔍 FETCHING - Scheduled posts for portal (attempt ${retryCount + 1})`);
      
      const startOfWeek = getStartOfWeek(weekOffset);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + (2 * 7) - 1);

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
  }, [token, weekOffset]);

  // Fetch uploads for the current date range
  const fetchUploads = useCallback(async () => {
    if (!token || isLoadingUploads) return;
    
    setIsLoadingUploads(true);
    try {
      const response = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch uploads');
      }

      const data = await response.json();
      const uploadsList = data.uploads || [];
      
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

  // Approval functionality
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

  const handleBatchSubmit = async () => {
    if (Object.keys(selectedPosts).length === 0) {
      setError('Please select at least one post to approve or reject');
      return;
    }

    console.log('🚀 Starting batch submission:', selectedPosts);
    setIsSubmitting(true);
    setError(null);

    try {
      const promises = Object.entries(selectedPosts).map(async ([postKey, approvalStatus]) => {
        console.log(`📝 Processing post ${postKey} with status ${approvalStatus}`);
        
        const firstHyphenIndex = postKey.indexOf('-');
        const postType = postKey.substring(0, firstHyphenIndex);
        const postId = postKey.substring(firstHyphenIndex + 1);
        
        console.log(`🔍 Parsed key "${postKey}" -> postType: "${postType}", postId: "${postId}"`);
        
        // Debug: Log all available posts
        const allPosts = Object.values(scheduledPosts).flat();
        console.log('🔍 All available posts:', allPosts.map(p => ({ id: p.id, post_type: p.post_type })));
        console.log('🔍 Looking for postId:', postId);
        
        const editedCaption = editedCaptions[postKey];
        const post = allPosts.find(p => p.id === postId);
        
        if (!post) {
          console.error(`❌ Post not found for key ${postKey}`);
          throw new Error(`Post not found for key ${postKey}`);
        }

        const hasEditedCaption = editedCaption && editedCaption !== post.caption;
        
        console.log(`🔄 Making API call for post ${postId}:`, {
          token: token.substring(0, 8) + '...',
          post_id: post.id,
          post_type: post.post_type || 'planner_scheduled',
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
            post_type: post.post_type || 'planner_scheduled',
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
      console.log('✅ Batch submission results:', results);
      
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error('❌ Some submissions failed:', failures);
        const errorMessages = failures.map(f => f.reason?.message || 'Unknown error');
        throw new Error(`Some submissions failed: ${errorMessages.join(', ')}`);
      }
      
      const successes = results.filter(result => result.status === 'fulfilled');
      console.log(`✅ Successfully submitted ${successes.length} approvals`);
      
      setSelectedPosts({});
      setComments({});
      setEditedCaptions({});
      
      console.log('🔄 Refreshing approval data...');
      await fetchScheduledPosts(0, true);
      console.log('✅ Approval data refreshed');
      
      const count = Object.keys(selectedPosts).length;
      setSuccessMessage(`Successfully submitted ${count} approval(s)! Your feedback has been sent to the team.`);
      setTimeout(() => setSuccessMessage(null), 8000);
      
    } catch (error) {
      console.error('Error submitting batch approvals:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit approvals');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Caption editing
  const handleEditCaption = (postId: string, currentCaption: string) => {
    setEditingCaption(postId);
    setTempCaption(currentCaption);
  };

  const handleSaveCaption = (postId: string) => {
    const postKey = `planner_scheduled-${postId}`;
    setEditedCaptions(prev => ({
      ...prev,
      [postKey]: tempCaption
    }));
    setEditingCaption(null);
    setTempCaption('');
  };

  const handleCancelEditCaption = () => {
    setEditingCaption(null);
    setTempCaption('');
  };

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
            targetDate: targetDate
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

  // Debounced effect to prevent rapid API calls
  useEffect(() => {
    if (!token) return;
    
    const timeoutId = setTimeout(() => {
      fetchScheduledPosts(0, true);
      fetchUploads();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [token, weekOffset]);

  const getWeeksToDisplay = () => {
    const weeks = [];
    for (let i = 0; i < 2; i++) {
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

  // Memoize expensive calculations
  const totalPosts = useMemo(() => {
    return Object.values(scheduledPosts).flat().length;
  }, [scheduledPosts]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedPosts).length;
  }, [selectedPosts]);

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
          <h2 className="text-2xl font-semibold text-card-foreground">Calendar & Approvals</h2>
          <p className="text-muted-foreground">
            View your scheduled posts, manage approvals, and upload content in one unified interface
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
                  <div className="bg-yellow-50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center mb-2">
                      <Minus className="w-4 h-4 text-yellow-600 mr-2" />
                      <span className="text-sm font-medium text-yellow-800">Pending</span>
                    </div>
                    <div className="text-lg font-bold text-yellow-900">{pending}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Batch Approval Section */}
      {Object.keys(scheduledPosts).length > 0 && (
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Batch Approval Actions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCount} post{selectedCount !== 1 ? 's' : ''} selected for approval
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
                disabled={isSubmitting}
              >
                Clear All
              </Button>
              
              <Button
                onClick={handleBatchSubmit}
                disabled={isSubmitting || Object.keys(selectedPosts).length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
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
            <div className="mt-4 p-3 bg-muted rounded text-sm">
              <div className="font-medium text-card-foreground mb-2">Selected posts:</div>
              <div className="space-y-1">
                {Object.entries(selectedPosts).map(([postKey, status]) => {
                  const [postType, postId] = postKey.split('-');
                  const post = Object.values(scheduledPosts)
                    .flat()
                    .find(p => p.id === postId && p.post_type === postType);
                  
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
                      <span className="text-muted-foreground">
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

      {/* Calendar */}
      <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekOffset(weekOffset - 2)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous 2 Weeks
            </button>
            <div className="flex items-center justify-center">
              <h2 className="text-lg font-semibold">
                Content Calendar - 2 Week View
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekOffset(weekOffset + 2)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-2"
              >
                Next 2 Weeks
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
                  {/* Week Header */}
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
                            className={`p-2 rounded border-2 border-transparent transition-all duration-200 min-w-[280px] min-h-[200px] flex-shrink-0 ${
                              isToday 
                                ? 'bg-blue-50 border-blue-300' 
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            {/* Day Header */}
                            <div className="mb-2 pb-2 border-b border-gray-200">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{day}</span>
                                <span className="text-gray-500">{dayDate.getDate()}</span>
                              </div>
                            </div>

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

                            {/* Display scheduled posts with approval functionality */}
                            {!isLoadingScheduledPosts && scheduledPosts[dayDate.toLocaleDateString('en-CA')]?.map((post: Post, idx: number) => {
                              const postKey = `planner_scheduled-${post.id}`;
                              const isSelected = selectedPosts[postKey];
                              const postComments = comments[postKey] || '';
                              const editedCaption = editedCaptions[postKey] || post.caption;
                              
                              return (
                                <div key={idx} className="mt-1">
                                  <div 
                                    className={`flex-shrink-0 w-full max-w-[260px] border rounded-lg p-3 hover:shadow-sm transition-shadow relative overflow-hidden ${
                                      post.approval_status === 'approved' ? 'border-green-200 bg-green-50' :
                                      post.approval_status === 'rejected' ? 'border-red-200 bg-red-50' :
                                      post.approval_status === 'needs_attention' ? 'border-orange-200 bg-orange-50' :
                                      'border-gray-200 bg-white'
                                    } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                                  >
                                    {/* Card Title */}
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
                                    
                                    {/* Caption with editing */}
                                    <div className="mb-2">
                                      {editingCaption === post.id ? (
                                        <div className="space-y-2">
                                          <Textarea
                                            value={tempCaption}
                                            onChange={(e) => setTempCaption(e.target.value)}
                                            placeholder="Edit caption..."
                                            className="min-h-[60px] text-xs"
                                          />
                                          <div className="flex space-x-2">
                                            <Button
                                              size="sm"
                                              onClick={() => handleSaveCaption(post.id)}
                                              className="flex-1 text-xs"
                                            >
                                              Save
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={handleCancelEditCaption}
                                              className="flex-1 text-xs"
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          <p className="text-sm text-gray-700 mb-2">
                                            {editedCaption}
                                          </p>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEditCaption(post.id, editedCaption)}
                                            className="w-full text-xs"
                                          >
                                            <Edit3 className="w-3 h-3 mr-1" />
                                            Edit Caption
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Comments section */}
                                    <div className="mb-2">
                                      <Textarea
                                        value={postComments}
                                        onChange={(e) => setComments(prev => ({
                                          ...prev,
                                          [postKey]: e.target.value
                                        }))}
                                        placeholder="Add your feedback..."
                                        className="min-h-[60px] text-xs"
                                      />
                                    </div>

                                    {/* Approval Actions */}
                                    <div className="flex space-x-0.5 mb-2 justify-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePostSelection(postKey, isSelected === 'approved' ? null : 'approved')}
                                        className={`flex-1 text-xs px-1 py-1 h-8 ${
                                          isSelected === 'approved' 
                                            ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                                            : 'bg-green-100 hover:bg-green-200 text-green-800 border-green-200'
                                        }`}
                                      >
                                        <Check className="w-3 h-3 mr-1" />
                                        <span className="hidden sm:inline">Approve</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePostSelection(postKey, isSelected === 'needs_attention' ? null : 'needs_attention')}
                                        className={`flex-1 text-xs px-1 py-1 h-8 ${
                                          isSelected === 'needs_attention' 
                                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' 
                                            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-200'
                                        }`}
                                      >
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        <span className="hidden sm:inline">Fix</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePostSelection(postKey, isSelected === 'rejected' ? null : 'rejected')}
                                        className={`w-8 h-8 p-0 ${
                                          isSelected === 'rejected' 
                                            ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' 
                                            : 'bg-red-100 hover:bg-red-200 text-red-800 border-red-200'
                                        }`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>

                                    {/* Client Feedback Display */}
                                    {post.client_feedback && (
                                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                        <span className="font-medium text-gray-700">Previous feedback:</span>
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
