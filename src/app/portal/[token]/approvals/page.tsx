'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Loader2, AlertCircle, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import { PortalTrelloBoard } from 'components/PortalTrelloBoard';

// Temporary inline types to resolve import issue
interface WeekData {
  weekStart: Date;
  weekLabel: string;
  posts: any[];
}


export default function PortalApprovalsPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [client, setClient] = useState<any>(null);
  const [submittingApprovals, setSubmittingApprovals] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<{[key: string]: string}>({});
  const [editedCaptions, setEditedCaptions] = useState<{[key: string]: string}>({});
  const [selectedPosts, setSelectedPosts] = useState<{[key: string]: 'approved' | 'rejected' | 'needs_attention'}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch approval data using the portal token
  const fetchApprovalData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching portal approval data...');
      const response = await fetch(`/api/portal/approvals?token=${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch approval data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load approval data');
      }
      
      setClient(data.client);
      setWeeks(data.weeks || []);
      
    } catch (err) {
      console.error('❌ Error fetching portal approval data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approval data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (token) {
      fetchApprovalData();
    }
  }, [token]);

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

  const handlePostMove = async (postKey: string, newWeekIndex: number) => {
    console.log('🔄 Post moved:', postKey, 'to week index:', newWeekIndex);
    
    // For now, we'll just refresh the data to show the current state
    // In the future, this could be used to move posts between weeks
    console.log('📅 Post moved to different week - refreshing data');
    
    // Refresh data to reflect the current state
    await fetchApprovalData();
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
          token: token.substring(0, 8) + '...',
          post_id: post.id,
          post_type: post.post_type,
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
      setSuccessMessage(`Successfully submitted ${count} approval(s)! Your feedback has been sent to the team.`);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Approvals</h2>
          <p className="text-muted-foreground">Please wait while we fetch your content for review...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-destructive">Failed to Load Approvals</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={fetchApprovalData} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border shadow-sm px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-card-foreground">Content Approval Board</h1>
              <p className="text-muted-foreground">
                Review and approve your scheduled content organized by week
                {client && ` • ${client.name}`}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {totalPosts} post{totalPosts !== 1 ? 's' : ''} total
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Current & future weeks only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto py-6 px-4">
        {/* Submit Section - Moved to top */}
        {weeks.length > 0 && (
          <div className="mb-8 p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Submit Your Approvals</h3>
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

        {weeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No scheduled posts found for review.</p>
              <p className="text-xs text-muted-foreground mt-2">
                Only current and future weeks are shown. Past weeks have been automatically filtered out.
              </p>
            </CardContent>
          </Card>
        ) : (
          <PortalTrelloBoard
            weeks={weeks}
            selectedPosts={selectedPosts}
            comments={comments}
            editedCaptions={editedCaptions}
            onPostSelection={handlePostSelection}
            onCommentChange={(postKey, comment) => setComments(prev => ({
              ...prev,
              [postKey]: comment
            }))}
            onCaptionChange={(postKey, caption) => setEditedCaptions(prev => ({
              ...prev,
              [postKey]: caption
            }))}
            onPostMove={handlePostMove}
          />
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