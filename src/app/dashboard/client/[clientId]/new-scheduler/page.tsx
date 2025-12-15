'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Check, Send, Trash2, AlertCircle } from 'lucide-react'
import { Post, LateAccount } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'

interface Account {
  _id: string;
  platform: string;
  username?: string;
  accountId?: string;
  status?: string;
}

interface LocalScheduledPost {
  postId: string;
  selectedAccounts: string[];
  scheduledDateTime: string;
}

export default function NewScheduler({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();
  const [readyPosts, setReadyPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState<Map<string, LocalScheduledPost>>(new Map());
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPlanRestrictionDialog, setShowPlanRestrictionDialog] = useState(false);
  const [planRestrictionMessage, setPlanRestrictionMessage] = useState(
    'Social media posting is not available on the free plan. Please upgrade to post to social media.'
  );

  const fetchPosts = useCallback(async () => {
    try {
      console.log('Fetching posts for client:', clientId);
      const accessToken = getAccessToken();
      
      const response = await fetch(`/api/posts/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      console.log('Fetched posts:', data.posts);
      setReadyPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, getAccessToken]);

  const fetchAccounts = useCallback(async () => {
    try {
      console.log('Fetching accounts for client:', clientId);
      const accessToken = getAccessToken();
      
      const response = await fetch(`/api/late/get-accounts/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      console.log('Fetched accounts:', data.accounts);
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [clientId, getAccessToken]);

  useEffect(() => {
    fetchPosts();
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fetchPosts, fetchAccounts]);

  const toggleAccountForPost = (postId: string, accountId: string) => {
    setScheduledPosts(prev => {
      const map = new Map(prev);
      const current = map.get(postId) || { 
        postId, 
        selectedAccounts: [], 
        scheduledDateTime: new Date().toISOString().slice(0, 16) 
      };
      
      const accounts = current.selectedAccounts.includes(accountId)
        ? current.selectedAccounts.filter(id => id !== accountId)
        : [...current.selectedAccounts, accountId];
      
      map.set(postId, { ...current, selectedAccounts: accounts });
      return map;
    });
  };

  const updateScheduledDateTime = (postId: string, dateTime: string) => {
    setScheduledPosts(prev => {
      const map = new Map(prev);
      const current = map.get(postId) || { 
        postId, 
        selectedAccounts: [], 
        scheduledDateTime: dateTime 
      };
      
      map.set(postId, { ...current, scheduledDateTime: dateTime });
      return map;
    });
  };

  const deletePost = async (postId: string) => {
    try {
      console.log('🗑️ Attempting to delete post:', postId);
      
      const response = await fetch(`/api/posts/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      });

      console.log('Delete response status:', response.status);
      
      const responseText = await response.text();
      console.log('Delete response text:', responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response:', e);
        data = { error: responseText };
      }

      if (!response.ok) {
        console.error('Delete failed:', JSON.stringify(data));
        throw new Error(data.error || 'Failed to delete post');
      }

      // Remove the post from state
      setReadyPosts(prev => prev.filter(p => p.id !== postId));
      console.log('✅ Post deleted successfully');
      
    } catch (error) {
      console.error('Error in deletePost:', error);
      alert(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const schedulePost = async (post: Post) => {
    const scheduled = scheduledPosts.get(post.id);
    if (!scheduled || scheduled.selectedAccounts.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    if (!scheduled.scheduledDateTime) {
      alert('Please select a date and time');
      return;
    }

    try {
      setLoadingPostId(post.id);
      console.log('Starting scheduling process for post:', post.id);
      
      // Step 1: Upload media to LATE (image is already base64)
      console.log('Uploading media to LATE...');
      const mediaResponse = await fetch('/api/late/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBlob: post.image_url  // ✅ This parameter name matches the API expectation
        })
      });
      
      if (!mediaResponse.ok) {
        const error = await mediaResponse.text();
        console.error('Media upload failed:', error);
        throw new Error('Failed to upload media');
      }
      
      const { lateMediaUrl } = await mediaResponse.json();
      console.log('Media uploaded:', lateMediaUrl);
      
      // Step 2: Get full account details
      const selectedAccountDetails = accounts.filter(
        account => scheduled.selectedAccounts.includes(account._id)
      );
      
      // Step 3: Schedule the post
      console.log('Scheduling post on LATE...');
      const scheduleResponse = await fetch('/api/late/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          caption: post.caption,
          lateMediaUrl: lateMediaUrl,
          scheduledDateTime: scheduled.scheduledDateTime,
          selectedAccounts: selectedAccountDetails,
          clientId: clientId
        })
      });
      
      if (!scheduleResponse.ok) {
        if (scheduleResponse.status === 403) {
          const errorBody = await scheduleResponse.json().catch(() => null);
          const errorMessage =
            errorBody?.error ||
            'Social media posting is not available on the free plan. Please upgrade to post to social media.';
          setPlanRestrictionMessage(errorMessage);
          setShowPlanRestrictionDialog(true);
          setLoadingPostId(null);
          return;
        }

        const errorText = await scheduleResponse.text();
        console.error('Schedule failed:', errorText);
        throw new Error('Failed to schedule post');
      }
      
      const result = await scheduleResponse.json();
      console.log('Post scheduled successfully:', result);
      
      alert('Post scheduled successfully!');
      
      // Remove the post from the list
      setReadyPosts(prev => prev.filter(p => p.id !== post.id));
      
      setLoadingPostId(null);
      
    } catch (error) {
      console.error('Error scheduling post:', error);
      alert('Failed to schedule post. Please try again.');
      setLoadingPostId(null);
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      instagram: 'bg-gradient-to-br from-purple-600 to-pink-500',
      facebook: 'bg-blue-600',
      twitter: 'bg-sky-500',
      linkedin: 'bg-blue-700',
      tiktok: 'bg-black',
      youtube: 'bg-red-600',
      threads: 'bg-gray-900'
    };
    return colors[platform] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a 
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </a>
          <span>&gt;</span>
          <a 
            href={`/dashboard/client/${clientId}`}
            className="hover:text-foreground transition-colors"
          >
            Client Dashboard
          </a>
          <span>&gt;</span>
          <a 
            href={`/dashboard/client/${clientId}/project/default`}
            className="hover:text-foreground transition-colors"
          >
            Project Default
          </a>
          <span>&gt;</span>
          <a 
            href={`/dashboard/client/${clientId}/project/default`}
            className="hover:text-foreground transition-colors"
          >
            Content Suite
          </a>
          <span>&gt;</span>
          <span className="text-foreground font-medium">Scheduler</span>
        </div>
      </div>
      
      <h1 className="text-3xl font-bold mb-6">Schedule Your Posts</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Ready to Schedule ({readyPosts.length})</h2>
        
        {readyPosts.length === 0 ? (
          <p className="text-gray-500">No posts available. Create some in the Content Suite!</p>
        ) : (
          <div className="space-y-6">
            {readyPosts.map((post) => {
              const scheduled = scheduledPosts.get(post.id);
              return (
                <div key={post.id} className="border rounded-lg p-6 shadow-sm bg-white">
                  <div className="flex gap-6">
                    {/* Image Preview */}
                    <div className="w-48 h-48 flex-shrink-0">
                      <img 
                        src={post.image_url} 
                        alt="Post" 
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    
                    {/* Content and Controls */}
                    <div className="flex-1 space-y-4">
                      {/* Caption */}
                      <div>
                        <p className="text-sm text-gray-700 line-clamp-3">{post.caption}</p>
                      </div>
                      
                      {/* Platform Selection */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Select Platforms:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {accounts.map((account) => {
                            const isSelected = scheduled?.selectedAccounts.includes(account._id);
                            return (
                              <button
                                key={account._id}
                                type="button"
                                onClick={() => toggleAccountForPost(post.id, account._id)}
                                className={`
                                  px-3 py-2 rounded-lg flex items-center gap-2 transition-all
                                  ${isSelected 
                                    ? `${getPlatformColor(account.platform)} text-white` 
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }
                                `}
                              >
                                {isSelected && <Check className="w-4 h-4" />}
                                <span className="text-sm font-medium">
                                  {account.platform}
                                </span>
                                <span className="text-xs opacity-75">
                                  @{account.username}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {accounts.length === 0 && (
                          <p className="text-sm text-gray-500">
                            No platforms connected. Connect social accounts in the client dashboard.
                          </p>
                        )}
                      </div>
                      
                      {/* Date/Time Selection */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Schedule Date & Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={scheduled?.scheduledDateTime || ''}
                            onChange={(e) => updateScheduledDateTime(post.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                          {/* Schedule Button */}
                          <button
                            type="button"
                            onClick={() => schedulePost(post)}
                            disabled={!scheduled?.selectedAccounts.length || loadingPostId === post.id}
                            className={`
                              px-6 py-2 rounded-lg font-medium flex items-center gap-2
                              ${scheduled?.selectedAccounts.length && loadingPostId !== post.id
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }
                            `}
                          >
                            {loadingPostId === post.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Scheduling...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Schedule Post
                              </>
                            )}
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => deletePost(post.id)}
                            className="px-6 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Post
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Dialog open={showPlanRestrictionDialog} onOpenChange={setShowPlanRestrictionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Upgrade Required
            </DialogTitle>
            <DialogDescription>
              {planRestrictionMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPlanRestrictionDialog(false)}
            >
              Close
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                window.location.href = '/pricing';
              }}
            >
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
