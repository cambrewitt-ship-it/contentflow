'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
// Temporary inline types to resolve import issue
interface WeekData {
  weekStart: Date;
  weekLabel: string;
  posts: any[];
}

// Lazy loading image component for approval page
const LazyApprovalImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
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
            className={`w-full h-auto max-h-96 object-contain rounded-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isLoaded && (
            <div className="w-full h-48 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </>
      )}
      {!isInView && (
        <div className="w-full h-48 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default function PublicApprovalPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [session, setSession] = useState<any>(null);
  const [submittingApprovals, setSubmittingApprovals] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<{[key: string]: string}>({});
  const [editedCaptions, setEditedCaptions] = useState<{[key: string]: string}>({});
  const [selectedPosts, setSelectedPosts] = useState<{[key: string]: 'approved' | 'rejected' | 'needs_attention'}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch approval data using the token
  const fetchApprovalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching approval data...');
      const response = await fetch(`/api/approval-sessions/temp-session-id/posts?token=${token}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch approval data: ${response.statusText}`);
      }
      
      const { session: sessionData, weeks: weeksData } = await response.json();
      
      setSession(sessionData);
      setWeeks(weeksData || []);
      
    } catch (err) {
      console.error('❌ Error fetching approval data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approval data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load data on mount
  useEffect(() => {
    if (token) {
      fetchApprovalData();
    }
  }, [token, fetchApprovalData]);

  // Memoize expensive calculations
  const totalPosts = useMemo(() => {
    return weeks.reduce((total, week) => total + week.posts.length, 0);
  }, [weeks]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedPosts).length;
  }, [selectedPosts]);

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
        // Split on the first hyphen only (UUIDs contain hyphens)
        // Key format: "calendar_scheduled-a77281ae-f505-4b56-8b9a-22c48435407d"
        const firstHyphenIndex = postKey.indexOf('-');
        const postType = postKey.substring(0, firstHyphenIndex);
        const postId = postKey.substring(firstHyphenIndex + 1);
        
        console.log(`🔍 Parsed key "${postKey}" -> postType: "${postType}", postId: "${postId}"`);
        
        const editedCaption = editedCaptions[postKey];
        const post = weeks
          .flatMap(week => week.posts)
          .find(p => p.id === postId && p.post_type === postType);
        
        if (!post) {
          console.error(`❌ Post not found for key ${postKey}`);
          throw new Error(`Post not found for key ${postKey}`);
        }

        const hasEditedCaption = editedCaption && editedCaption !== post.caption;
        
        console.log(`🔄 Making API call for post ${postId}:`, {
          session_id: session.id,
          post_id: post.id,
          post_type: post.post_type,
          approval_status: approvalStatus,
          has_comments: !!comments[postKey],
          has_edited_caption: hasEditedCaption
        });
        
        const response = await fetch('/api/post-approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            post_id: post.id,
            post_type: post.post_type,
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
      
      console.log('🔄 Refreshing approval data...');
      await fetchApprovalData();
      console.log('✅ Approval data refreshed');
      
      // Show success message
      const count = Object.keys(selectedPosts).length;
      setSuccessMessage(`Successfully submitted ${count} approval(s)! The main calendar page will show updated statuses.`);
      setTimeout(() => setSuccessMessage(null), 8000);
      
    } catch (error) {
      console.error('Error submitting batch approvals:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit approvals');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Failed to Load Approval Board
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchApprovalData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center">
            <img 
              src="/cm-logo.png" 
              alt="CM Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Submit Section - Moved to top */}
        {weeks.length > 0 && (
          <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Submit Your Approvals</h3>
                     <p className="text-sm text-gray-600 mt-1">
                       {selectedCount} post(s) selected for approval
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    `Submit ${Object.keys(selectedPosts).length} Approval(s)`
                  )}
                </Button>
              </div>
            </div>
            
            {Object.keys(selectedPosts).length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <div className="font-medium text-gray-700 mb-2">Selected posts:</div>
                <div className="space-y-1">
                  {Object.entries(selectedPosts).map(([postKey, status]) => {
                    const [postType, postId] = postKey.split('-');
                    const post = weeks
                      .flatMap(week => week.posts)
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

        {weeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No scheduled posts found for this project.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {weeks.map((week, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {week.weekLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {week.posts.map((post) => {
                      const postKey = `${post.post_type}-${post.id}`;
                      const selectedStatus = selectedPosts[postKey];
                      
                      // Determine card styling based on selected status or existing approval status
                      const getCardStyling = () => {
                        // Priority: selected status (current session) > existing approval status
                        const statusToUse = selectedStatus || post.approval?.approval_status;
                        
                        if (statusToUse === 'approved') {
                          return 'border-2 border-green-500 bg-green-50';
                        } else if (statusToUse === 'needs_attention') {
                          return 'border-2 border-yellow-500 bg-yellow-50';
                        } else if (statusToUse === 'rejected') {
                          return 'border-2 border-red-500 bg-red-50';
                        } else {
                          return 'border border-gray-200 bg-white';
                        }
                      };
                      
                      return (
                      <div key={postKey} className={`rounded-lg p-4 transition-all duration-200 ${getCardStyling()}`}>
                        {/* Card Title - Date and Time */}
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {new Date(post.scheduled_date).toLocaleDateString('en-GB', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'short'
                            })}
                            {post.scheduled_time && (
                              <span className="text-gray-600 font-normal"> - {post.scheduled_time.slice(0, 5)}</span>
                            )}
                          </h3>
                        </div>

                        {/* Approval Buttons */}
                        <div className="mb-4">
                          <div className="text-xs font-medium text-gray-700 mb-2">Select approval:</div>
                          <div className="flex gap-1 w-full">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePostSelection(postKey, 'approved')}
                              className={`flex items-center justify-center gap-1 text-xs flex-1 ${
                                (selectedStatus || post.approval?.approval_status) === 'approved' 
                                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-600 ring-2 ring-green-300 ring-offset-1' 
                                  : 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                              }`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approve
                            </Button>
                            
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePostSelection(postKey, 'needs_attention')}
                              className={`flex items-center justify-center gap-1 text-xs flex-1 ${
                                (selectedStatus || post.approval?.approval_status) === 'needs_attention' 
                                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600 ring-2 ring-yellow-300 ring-offset-1' 
                                  : 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600'
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Improve
                            </Button>
                            
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePostSelection(postKey, 'rejected')}
                              className={`flex items-center justify-center text-xs w-8 h-8 p-0 ${
                                (selectedStatus || post.approval?.approval_status) === 'rejected' 
                                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 ring-2 ring-red-300 ring-offset-1' 
                                  : 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                              }`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Comment Input - Moved to be right after approval buttons */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Comments or feedback:
                          </label>
                          <textarea
                            placeholder="Let us know what changes you'd like to see..."
                            value={comments[`${post.post_type}-${post.id}`] || ''}
                            onChange={(e) => setComments(prev => ({
                              ...prev,
                              [`${post.post_type}-${post.id}`]: e.target.value
                            }))}
                            className="w-full p-2 text-xs border border-gray-300 rounded resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Image */}
                        {post.image_url && (
                          <div className="relative w-full mb-3">
                            <LazyApprovalImage
                              src={post.image_url}
                              alt="Post"
                              className="w-full h-auto max-h-96 object-contain"
                            />
                          </div>
                        )}

                        {/* Editable Caption */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Caption (you can edit this):
                          </label>
                          <textarea
                            value={editedCaptions[`${post.post_type}-${post.id}`] || post.caption}
                            onChange={(e) => setEditedCaptions(prev => ({
                              ...prev,
                              [`${post.post_type}-${post.id}`]: e.target.value
                            }))}
                            className="w-full p-2 text-sm border border-gray-300 rounded resize-none"
                            rows={3}
                          />
                          {editedCaptions[`${post.post_type}-${post.id}`] && 
                           editedCaptions[`${post.post_type}-${post.id}`] !== post.caption && (
                            <p className="text-xs text-blue-600 mt-1">Caption has been edited</p>
                          )}
                        </div>

                        {/* Approval Status */}
                        <div className="flex items-center justify-end mb-3 mr-2">
                          <div className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                            post.approval?.approval_status === 'approved' 
                              ? 'bg-green-100 text-green-700'
                              : post.approval?.approval_status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {post.approval?.approval_status === 'approved' && <CheckCircle className="w-3 h-3" />}
                            {post.approval?.approval_status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {(!post.approval?.approval_status || post.approval?.approval_status === 'pending') && <Minus className="w-3 h-3" />}
                            {post.approval?.approval_status || 'pending'}
                          </div>
                        </div>

                        {/* Client Comments */}
                        {post.approval?.client_comments && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">Your comment:</span> {post.approval.client_comments}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
    </div>
  );
}
