'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, Check, Send, Trash2 } from 'lucide-react';

interface Post {
  id: string;
  client_id: string;
  project_id: string;
  caption: string;
  image_url: string;
  status: string;
  created_at: string;
}

interface Account {
  _id: string;
  platform: string;
  username: string;
  displayName: string;
  isActive: boolean;
}

interface ScheduledPost {
  postId: string;
  selectedAccounts: string[];
  scheduledDateTime: string;
}

export default function NewSchedulerPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState<Map<string, ScheduledPost>>(new Map());
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchAccounts();
  }, [clientId]);

  const fetchPosts = async () => {
    try {
      console.log('Fetching posts for client:', clientId);
      const response = await fetch(`/api/posts/${clientId}`);
      const data = await response.json();
      console.log('Fetched posts:', data.posts);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      console.log('Fetching accounts for client:', clientId);
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      const data = await response.json();
      console.log('Fetched accounts:', data.accounts);
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

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
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone and will remove the post from the database completely.')) {
      return;
    }

    try {
      console.log('Deleting post:', postId);
      
      const response = await fetch(`/api/posts/${clientId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Delete failed:', error);
        throw new Error('Failed to delete post');
      }
      
      const result = await response.json();
      console.log('Post deleted successfully:', result);
      
      // Remove the post from the local state
      setPosts(prev => prev.filter(p => p.id !== postId));
      
      // Remove from scheduled posts if it was there
      setScheduledPosts(prev => {
        const map = new Map(prev);
        map.delete(postId);
        return map;
      });
      
      alert('Post deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
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
          imageBlob: post.image_url
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
        const error = await mediaResponse.text();
        console.error('Schedule failed:', error);
        throw new Error('Failed to schedule post');
      }
      
      const result = await scheduleResponse.json();
      console.log('Post scheduled successfully:', result);
      
      alert('Post scheduled successfully!');
      
      // Remove the post from the list
      setPosts(prev => prev.filter(p => p.id !== post.id));
      
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
        <h2 className="text-xl font-semibold mb-4">Ready to Schedule ({posts.length})</h2>
        
        {posts.length === 0 ? (
          <p className="text-gray-500">No posts available. Create some in the Content Suite!</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
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
    </div>
  );
}
