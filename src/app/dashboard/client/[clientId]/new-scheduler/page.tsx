'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePostStore } from 'lib/store';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Input } from 'components/ui/input';
import { Calendar, Clock, Image as ImageIcon, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

interface ConnectedAccount {
  _id: string;
  platform: string;
  username: string;
}

// Hardcoded connected accounts to bypass broken API
const MOCK_CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  { _id: 'test-instagram', platform: 'instagram', username: 'Connected Instagram' },
  { _id: 'test-facebook', platform: 'facebook', username: 'Connected Facebook' },
  { _id: 'test-linkedin', platform: 'linkedin', username: 'Connected LinkedIn' },
];

export default function NewSchedulerPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  
  // Get posts from Zustand store
  const { posts, scheduled, getPostsByProjectAndClient, addScheduledPost } = usePostStore();
  
  // Local state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string[]>>({});
  const [schedulingPost, setSchedulingPost] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get posts for current client (using 'default' project for now)
  const projectId = 'default';
  const key = `${clientId}:${projectId}`;
  const unscheduledPosts = getPostsByProjectAndClient(projectId, clientId).filter(post => !post.scheduledTime);
  const scheduledPosts = getPostsByProjectAndClient(projectId, clientId).filter(post => post.scheduledTime);

  // Generate time options (hourly slots)
  const timeOptions = Array.from({ length: 24 }, (_, i) => 
    `${i.toString().padStart(2, '0')}:00`
  );

  // Handle account selection for a post
  const handleAccountSelection = (postId: string, accountId: string, checked: boolean) => {
    setSelectedAccounts(prev => {
      const current = prev[postId] || [];
      if (checked) {
        return { ...prev, [postId]: [...current, accountId] };
      } else {
        return { ...prev, [postId]: current.filter(id => id !== accountId) };
      }
    });
  };

  // Schedule a post
  const handleSchedulePost = async (postId: string) => {
    if (!selectedDate || !selectedTime) {
      setMessage({ type: 'error', text: 'Please select both date and time' });
      return;
    }

    const accounts = selectedAccounts[postId] || [];
    if (accounts.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one account' });
      return;
    }

    setSchedulingPost(postId);
    setMessage(null);

    try {
      const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}:00.000Z`);
      
      // Call the existing schedulePost API
      const response = await fetch('/api/schedulePost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          project_id: projectId,
          post_id: postId,
          scheduled_time: scheduledDateTime.toISOString(),
          account_ids: accounts,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local Zustand store
        const scheduledPost = {
          id: result.id,
          clientId,
          projectId,
          postId,
          scheduledTime: scheduledDateTime.toISOString(),
          accountIds: accounts,
          status: 'scheduled' as const,
        };

        addScheduledPost(scheduledPost);
        
        setMessage({ type: 'success', text: 'Post scheduled successfully!' });
        
        // Clear form
        setSelectedDate('');
        setSelectedTime('09:00');
        setSelectedAccounts(prev => {
          const newState = { ...prev };
          delete newState[postId];
          return newState;
        });
      } else {
        setMessage({ type: 'error', text: `Failed to schedule post: ${result.error}` });
      }
    } catch (error) {
      console.error('Error scheduling post:', error);
      setMessage({ type: 'error', text: `Error scheduling post: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setSchedulingPost(null);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('🆕 New Scheduler Page Debug:', {
      clientId,
      projectId,
      key,
      posts,
      scheduled,
      unscheduledPosts: unscheduledPosts.length,
      scheduledPosts: scheduledPosts.length,
      postsMapKeys: Object.keys(posts || {}),
      scheduledMapKeys: Object.keys(scheduled || {})
    });
  }, [clientId, projectId, key, posts, scheduled, unscheduledPosts.length, scheduledPosts.length]);

  if (!clientId) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h1 className="text-2xl font-bold mb-2">Client ID Not Found</h1>
            <p className="text-muted-foreground">Unable to load scheduler without client ID.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Content Scheduler</h1>
          <p className="text-muted-foreground">
            Schedule your content for {clientId} • Project: {projectId}
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Unscheduled Posts */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Unscheduled Posts ({unscheduledPosts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {unscheduledPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No unscheduled posts found.</p>
                    <p className="text-sm">Create content in the Content Suite first.</p>
                  </div>
                ) : (
                  unscheduledPosts.map((post) => (
                    <Card key={post.id} className="border-2">
                      <CardContent className="p-4">
                        {/* Post Image */}
                        <div className="mb-3">
                          <img 
                            src={post.imageUrl} 
                            alt="Post content" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        </div>

                        {/* Post Caption */}
                        <div className="mb-3">
                          <label className="text-sm font-medium">Caption:</label>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {post.caption}
                          </p>
                        </div>

                        {/* Account Selection */}
                        <div className="mb-3">
                          <label className="text-sm font-medium">Select Accounts:</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {MOCK_CONNECTED_ACCOUNTS.map((account) => (
                              <div key={account._id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${post.id}-${account._id}`}
                                  checked={selectedAccounts[post.id]?.includes(account._id) || false}
                                  onChange={(e) => 
                                    handleAccountSelection(post.id, account._id, e.target.checked)
                                  }
                                  className="rounded border-gray-300"
                                />
                                <label 
                                  htmlFor={`${post.id}-${account._id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {account.platform} ({account.username})
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Date and Time Selection */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label htmlFor={`date-${post.id}`} className="text-sm font-medium">Date:</label>
                            <Input
                              id={`date-${post.id}`}
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div>
                            <label htmlFor={`time-${post.id}`} className="text-sm font-medium">Time:</label>
                            <select 
                              value={selectedTime} 
                              onChange={(e) => setSelectedTime(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Schedule Button */}
                        <Button
                          onClick={() => handleSchedulePost(post.id)}
                          disabled={schedulingPost === post.id}
                          className="w-full"
                        >
                          {schedulingPost === post.id ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Scheduling...
                            </>
                          ) : (
                            <>
                              <Calendar className="h-4 w-4 mr-2" />
                              Schedule Post
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Scheduled Posts */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Scheduled Posts ({scheduledPosts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduledPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scheduled posts yet.</p>
                    <p className="text-sm">Schedule posts from the left column.</p>
                  </div>
                ) : (
                  scheduledPosts.map((post) => (
                    <Card key={post.id} className="border-2 border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        {/* Post Image */}
                        <div className="mb-3">
                          <img 
                            src={post.imageUrl} 
                            alt="Post content" 
                            className="w-full h-24 object-cover rounded-lg"
                          />
                        </div>

                        {/* Post Details */}
                        <div className="space-y-2">
                          <div>
                            <label className="text-sm font-medium">Caption:</label>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {post.caption}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">Scheduled:</label>
                            <p className="text-sm text-muted-foreground">
                              {post.scheduledTime ? new Date(post.scheduledTime).toLocaleString() : 'Not set'}
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Status:</label>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Scheduled
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">Debug Information:</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Client ID: {clientId}</p>
            <p>Project ID: {projectId}</p>
            <p>Store Key: {key}</p>
            <p>Unscheduled Posts: {unscheduledPosts.length}</p>
            <p>Scheduled Posts: {scheduledPosts.length}</p>
            <p>Total Posts in Store: {Object.keys(posts || {}).length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
