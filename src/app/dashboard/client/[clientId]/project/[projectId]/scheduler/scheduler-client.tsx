'use client';

import { usePostStore } from 'lib/store';
import { useParams } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Instagram, Facebook, Linkedin, GripVertical, Clock, Plus, AlertCircle } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button } from 'components/ui/button';
import { Card, CardContent } from 'components/ui/card';

// Import the Post type from the store
import type { Post, ScheduledPost as StoreScheduledPost } from 'lib/store';

interface ConnectedAccount {
  id: string;
  platform: string;
  username: string;
  accountId: string;
  profilePicture?: string;
  isActive: boolean;
  connectedAt: string;
  permissions: string[];
  // Platform-specific fields
  followers?: number;
  isBusiness?: boolean;
  isVerified?: boolean;
  pageName?: string;
  pageId?: string;
  pageCategory?: string;
  pageFollowers?: number;
  companyName?: string;
  companyId?: string;
  connectionCount?: number;
}

// Updated to use the store's Post type
interface PostInQueue extends Post {
  selectedAccounts: string[]; // Array of selected account IDs
}

// Use the store's ScheduledPost type
type SchedulerScheduledPost = StoreScheduledPost;

interface SchedulerClientProps {
  clientId: string;
  projectId: string;
}

// Sample data for platforms (you can make this configurable later)
const defaultPlatforms = ['instagram', 'facebook'];

function DraggablePost({ 
  post, 
  isDragging, 
  onSchedule,
  onAccountSelection,
  connectedAccounts
}: { 
  post: PostInQueue; 
  isDragging?: boolean;
  onSchedule: (postId: string, accountIds: string[]) => void;
  onAccountSelection: (postId: string, accountIds: string[]) => void;
  connectedAccounts: ConnectedAccount[];
}) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    post.selectedAccounts || []
  );
  
  // Sync local state with parent state when post.selectedAccounts changes
  useEffect(() => {
    setSelectedAccounts(post.selectedAccounts || []);
  }, [post.selectedAccounts]);
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: post.id,
    data: post,
    disabled: selectedAccounts.length === 0 // Disable dragging if no accounts are selected
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleAccountToggle = (accountId: string) => {
    const newSelectedAccounts = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    
    setSelectedAccounts(newSelectedAccounts);
    post.selectedAccounts = newSelectedAccounts;
    onAccountSelection(post.id, newSelectedAccounts);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg border-2 border-gray-200 p-4 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      } ${selectedAccounts.length === 0 ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <img 
            src={post.imageUrl} 
            alt="Post content" 
            className="w-16 h-16 object-cover rounded-lg"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 line-clamp-2 mb-2">
            {post.caption}
          </p>
          
          {/* Account Selection */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Select accounts:</div>
            <div className="grid grid-cols-2 gap-1">
              {connectedAccounts.map((account) => (
                <label
                  key={account.id}
                  className={`flex items-center space-x-1 p-1 rounded text-xs cursor-pointer transition-colors ${
                    selectedAccounts.includes(account.id)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{account.username}</span>
                </label>
              ))}
            </div>
          </div>
          
          {selectedAccounts.length === 0 && (
            <div className="text-xs text-red-500 mt-1">
              Account selection required
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableCalendarCell({ 
  date, 
  posts, 
  isToday, 
  isCurrentMonth,
  onTimeChange,
  generateTimeOptions,
  globalScheduleTime,
  individualPostTimes,
  globalTimeApplied
}: { 
  date: string; 
  posts: SchedulerScheduledPost[]; 
  isToday: boolean; 
  isCurrentMonth: boolean;
  onTimeChange: (postId: string, newTime: string) => void;
  generateTimeOptions: () => string[];
  globalScheduleTime: string | null;
  individualPostTimes: Record<string, string>;
  globalTimeApplied: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `date-${date}`,
    data: { date }
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 p-2 border border-border transition-all ${
        isOver ? 'bg-primary/10 border-primary/50' : ''
      } ${isToday ? 'bg-primary/5 border-primary/30' : ''} ${
        !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
      }`}
    >
      <div className={`text-sm font-medium mb-1 ${
        isToday ? 'text-primary' : 'text-foreground'
      }`}>
        {new Date(date).getDate()}
      </div>
      
      <div className="space-y-1">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-background border rounded p-2 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                {post.platforms.map((platform) => (
                  <div key={platform} className="w-3 h-3 bg-muted rounded-full flex items-center justify-center">
                    {platform === 'instagram' && <Instagram className="h-2 w-2 text-pink-500" />}
                    {platform === 'facebook' && <Facebook className="h-2 w-2 text-blue-600" />}
                    {platform === 'linkedin' && <Linkedin className="h-2 w-2 text-blue-700" />}
                  </div>
                ))}
              </div>
              {/* Status Badge */}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                post.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                post.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                post.status === 'failed' ? 'bg-red-100 text-red-800' :
                post.status === 'published' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {post.status || 'scheduled'}
              </span>
            </div>
            
            {/* Time and Platform Info */}
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <select 
                className={`px-2 py-1 border rounded text-xs ${
                  globalTimeApplied 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-background border-border'
                }`}
                value={globalTimeApplied ? (globalScheduleTime || '09:00') : (individualPostTimes[post.id] || '09:00')}
                onChange={(e) => onTimeChange(post.id, e.target.value)}
                disabled={globalTimeApplied}
              >
                {generateTimeOptions().map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              {globalTimeApplied && (
                <span className="text-xs text-muted-foreground">(Applied)</span>
              )}
              <span className="text-xs opacity-75">•</span>
              <span className="capitalize">{post.platforms.join(', ')}</span>
            </div>
            
            <p className="line-clamp-2 text-muted-foreground">
              {post.caption}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SchedulerClient({ clientId, projectId }: SchedulerClientProps) {
  console.log('🎯 SchedulerClient rendered with:', { clientId, projectId });
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<SchedulerScheduledPost[]>([]);
  const [draggedPost, setDraggedPost] = useState<PostInQueue | null>(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [selectedPostForScheduling, setSelectedPostForScheduling] = useState<PostInQueue | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string[]>>({}); // Track selected accounts per post
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalScheduleTime, setGlobalScheduleTime] = useState<string>('');
  const [globalTimeApplied, setGlobalTimeApplied] = useState(false);
  const [individualPostTimes, setIndividualPostTimes] = useState<Record<string, string>>({});
  
  // Get posts from Zustand store
  const key = `${clientId}:${projectId}`;
const postsMap = usePostStore(s => s.posts);
const scheduledMap = usePostStore(s => s.scheduled);

const posts = useMemo(() => postsMap?.[key] ?? [], [postsMap, key]);
const scheduledPostsFromStore = useMemo(() => scheduledMap?.[key] ?? [], [scheduledMap, key]);

// Get the schedule action from the store
const schedulePostAction = usePostStore(s => s.schedulePost);
  
  // Convert posts from store to scheduler format
  const postsInQueue: PostInQueue[] = useMemo(() => {
    return posts.map(post => ({
      ...post, // Include all Post properties
      selectedAccounts: [], // Initialize with no accounts selected
    }));
  }, [posts]);

  // Convert scheduled posts from store to display format
  const scheduledPostsForDisplay = useMemo(() => {
    return scheduledPostsFromStore.map(scheduledPost => {
      const post = posts.find(p => p.id === scheduledPost.postId);
      if (!post) return null;
      
      return {
        id: scheduledPost.id,
        caption: post.caption,
        imageUrl: post.imageUrl,
        date: new Date(scheduledPost.scheduledTime).toDateString(),
        status: scheduledPost.status,
        scheduledTime: scheduledPost.scheduledTime,
        accountIds: scheduledPost.accountIds,
      };
    }).filter(Boolean);
  }, [scheduledPostsFromStore, posts]);

  const handleSchedulePost = (post: PostInQueue) => {
    setSelectedPostForScheduling(post);
    setIsSchedulingModalOpen(true);
  };

  const handleCloseSchedulingModal = () => {
    setIsSchedulingModalOpen(false);
    setSelectedPostForScheduling(null);
  };

  const handleQuickSchedule = async (postId: string, accountIds: string[]) => {
    try {
      console.log('🔄 Quick scheduling post:', { postId, accountIds, projectId, clientId });
      // Schedule the post immediately for the current date
      await schedulePostAction(postId, new Date(), accountIds, projectId, clientId);
      console.log('✅ Quick schedule completed successfully');
    } catch (error) {
      console.error('❌ Failed to quick schedule post:', error);
    }
  };

  const handleAccountSelection = (postId: string, accountIds: string[]) => {
    setSelectedAccounts(prev => ({
      ...prev,
      [postId]: accountIds
    }));
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const handleApplyToAll = () => {
    if (!globalScheduleTime) return;
    
    // Update all scheduled posts to use the global time
    const updatedPosts = scheduledPostsFromStore.map(post => ({
      ...post,
      scheduledTime: `${post.scheduledTime.split('T')[0]}T${globalScheduleTime}:00.000Z`
    }));
    
    // Update individual post times to match global time
    const newIndividualTimes: Record<string, string> = {};
    updatedPosts.forEach(post => {
      newIndividualTimes[post.id] = globalScheduleTime;
    });
    setIndividualPostTimes(newIndividualTimes);
    
    // Mark that global time has been applied
    setGlobalTimeApplied(true);
    
    console.log('🕐 Global time override applied:', globalScheduleTime, 'to all posts');
  };

  // Test LATE API function
  const testLateAPI = async () => {
    try {
      console.log('🧪 Testing LATE API...');
      
      const testPayload = {
        content: "Test post from my app",
        platforms: ["facebook"],
        profileId: "test_profile_id",
        publishNow: true
      };
      
      console.log('📤 Sending test payload:', testPayload);
      
      const response = await fetch('/api/publishViaLate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const result = await response.json();
      console.log('📄 Parsed response result:', result);
      
      if (response.ok) {
        console.log('✅ LATE API test successful:', result);
        alert(`✅ LATE API test successful!\n\nResponse: ${JSON.stringify(result, null, 2)}`);
      } else {
        console.error('❌ LATE API test failed:', {
          status: response.status,
          statusText: response.statusText,
          result: result,
          error: result.error,
          debug: result.debug
        });
        alert(`❌ LATE API test failed!\n\nStatus: ${response.status} ${response.statusText}\n\nError: ${JSON.stringify(result, null, 2)}`);
      }
      
      return result;
    } catch (error) {
      console.error('💥 Error testing LATE API:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`💥 Error testing LATE API!\n\nError: ${errorMessage}`);
      throw error;
    }
  };

  const handleIndividualTimeChange = (postId: string, newTime: string) => {
    // Always allow individual time changes - global time is just a selection until applied
    setIndividualPostTimes(prev => ({
      ...prev,
      [postId]: newTime
    }));
    
    console.log('🕐 Updated post time:', postId, 'to', newTime);
  };

  const handleGlobalTimeChange = (newTime: string | null) => {
    setGlobalScheduleTime(newTime || '');
    
    // Reset the applied flag when global time changes
    setGlobalTimeApplied(false);
    
    if (newTime) {
      console.log('🕐 Global time selected:', newTime, '- waiting for Apply to All');
    } else {
      console.log('🕐 Global time cleared');
    }
  };



  const publishAllForPlatform = async (platform: string) => {
    try {
      console.log(`🔄 Publishing all posts for ${platform}`);
      const postsToPublish = scheduledPostsFromStore.filter(post => 
        post.accountIds && post.accountIds.length > 0
      );
      
      for (const post of postsToPublish) {
        // Update status to published
        console.log(`📤 Publishing post ${post.id} for ${platform}`);
        // Here you would call your actual publish API
        // For now, we'll just log it
      }
      
      console.log(`✅ Published ${postsToPublish.length} posts for ${platform}`);
    } catch (error) {
      console.error(`❌ Failed to publish posts for ${platform}:`, error);
    }
  };

  // Fetch connected accounts from LATE API
  const fetchConnectedAccounts = async () => {
    try {
      console.log('🔄 Fetching connected accounts...');
      console.log('🔍 Using clientId:', clientId);
      console.log('🔍 clientId type:', typeof clientId);
      console.log('🔍 clientId length:', clientId?.length);
      console.log('🔍 clientId value:', JSON.stringify(clientId));
      console.log('🔍 clientId from props:', clientId);
      console.log('🔍 clientId from useParams:', useParams());
      
      const apiUrl = `/api/late/get-accounts/${clientId}`;
      console.log('🌐 API URL:', apiUrl);
      console.log('🌐 Full API URL:', `${window.location.origin}${apiUrl}`);
      console.log('🌐 Current window location:', window.location.href);
      console.log('🌐 Current pathname:', window.location.pathname);
      
      const response = await fetch(apiUrl);
      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error response:', errorText);
        throw new Error(`Failed to fetch connected accounts: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📄 Response data:', data);
      
      if (data.success) {
        setConnectedAccounts(data.accounts);
        console.log('✅ Connected accounts fetched:', data.accounts);
      } else {
        throw new Error(data.error || 'Failed to fetch connected accounts');
      }
    } catch (error) {
      console.error('❌ Failed to fetch connected accounts:', error);
      // Don't show alert, just log the error
    }
  };

  useEffect(() => {
    fetchConnectedAccounts();
  }, [clientId, projectId]);


  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const post = postsInQueue.find(p => p.id === active.id);
    if (post) {
      setDraggedPost(post);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.data.current) {
      const post = active.data.current as PostInQueue;
      const targetDate = over.data.current?.date;
      
      if (targetDate) {
        // Use the post's selected accounts, or default to all connected accounts
        const accountIds = selectedAccounts[post.id]?.length > 0 ? selectedAccounts[post.id] : connectedAccounts.map(acc => acc.id);
        
        console.log('🔄 Drag-and-drop scheduling post:', { 
          postId: post.id, 
          targetDate, 
          accountIds, 
          projectId, 
          clientId,
          selectedAccounts: selectedAccounts[post.id]
        });
        
        try {
          await schedulePostAction(post.id, new Date(targetDate), accountIds, projectId, clientId);
          
          // If global time is set, use it; otherwise use default time
          const scheduleTime = globalScheduleTime || '09:00';
          
          // Set the individual post time (either global time or default)
          setIndividualPostTimes(prev => ({
            ...prev,
            [post.id]: scheduleTime
          }));
          
          console.log('✅ Drag-and-drop schedule completed successfully');
        } catch (error) {
          console.error('❌ Failed to schedule post via drag-and-drop:', error);
        }
      }
    }
    
    setDraggedPost(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getPostsForDate = (date: string) => {
    // Convert scheduled posts from store to the format expected by the calendar
    return scheduledPostsFromStore
      .filter(scheduledPost => {
        const scheduledDate = new Date(scheduledPost.scheduledTime).toISOString().split('T')[0];
        return scheduledDate === date;
      })
      .map(scheduledPost => {
        const post = posts.find(p => p.id === scheduledPost.postId);
        if (!post) return null;
        
        // Get the platforms from the connected accounts
        const platforms = scheduledPost.accountIds.map(accountId => {
          const account = connectedAccounts.find(acc => acc.id === accountId);
          return account ? account.platform : 'unknown';
        });
        
        return {
          id: scheduledPost.id,
          caption: post.caption,
          imageUrl: post.imageUrl,
          platforms: platforms,
          date: date,
          status: scheduledPost.status,
          scheduledTime: scheduledPost.scheduledTime // Include the actual scheduled time
        };
      })
      .filter(Boolean) as SchedulerScheduledPost[];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb and Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link 
              href={`/dashboard/client/${clientId}`}
              className="hover:text-foreground transition-colors"
            >
              Client
            </Link>
            <span>&gt;</span>
            <Link 
              href={`/dashboard/client/${clientId}/project/${projectId}`}
              className="hover:text-foreground transition-colors"
            >
              Project
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-medium">Scheduler</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href={`/dashboard/client/${clientId}/project/${projectId}`}
              className="p-2 hover:bg-accent rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">Content Scheduler</h1>
              <p className="text-muted-foreground mt-2">
                Schedule your social media posts with our intuitive drag-and-drop calendar.
              </p>
            </div>
          </div>
        </div>

        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Post Queue Section */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-card-foreground">Posts Ready to Schedule</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSchedulingModalOpen(true)}
                  disabled={postsInQueue.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Post
                </Button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {postsInQueue.map((post) => (
                  <div key={post.id} className="relative">
                    <DraggablePost
                      post={post}
                      isDragging={draggedPost?.id === post.id}
                      onSchedule={handleQuickSchedule}
                      onAccountSelection={handleAccountSelection}
                      connectedAccounts={connectedAccounts}
                    />
                    <Button
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => handleSchedulePost(post)}
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Posts Section */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-card-foreground mb-4">Scheduled Posts</h2>
              {scheduledPostsForDisplay.length === 0 ? (
                                  <p className="text-muted-foreground text-center py-8">
                    No posts scheduled yet. Use the calendar below or click &apos;Schedule Post&apos; above.
                  </p>
              ) : (
                <div className="space-y-3">
                  {scheduledPostsForDisplay.map((scheduledPost) => {
                    const post = posts.find(p => p.id === scheduledPost.id);
                    if (!post) return null;
                    
                    return (
                      <div key={scheduledPost.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <img 
                          src={post.imageUrl} 
                          alt="Post" 
                          className="w-12 h-12 object-cover rounded-md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{post.caption}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(scheduledPost.scheduledTime).toLocaleString()}
                            <span className="px-2 py-1 rounded-full text-xs bg-muted">
                              {scheduledPost.accountIds.length > 0 
                                ? `${scheduledPost.accountIds.length} account(s)`
                                : 'No accounts selected'
                              }
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              scheduledPost.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                              scheduledPost.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              scheduledPost.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {scheduledPost.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>



          {/* Test LATE API Section */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-2">Test LATE API Integration</h2>
                  <p className="text-sm text-muted-foreground">
                    Test the LATE API endpoint with a sample post to Facebook
                  </p>
                </div>
                <Button
                  onClick={testLateAPI}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  🧪 Test LATE API
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Section */}
          <Card>
            <CardContent className="p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                
                <h2 className="text-2xl font-bold text-card-foreground">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Schedule All Section */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                <span className="text-sm font-medium text-card-foreground">Schedule all at:</span>
                <select 
                  className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                  value={globalScheduleTime || ''}
                  onChange={(e) => handleGlobalTimeChange(e.target.value || null)}
                >
                  <option value="">Select time...</option>
                  {generateTimeOptions().map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleApplyToAll}
                  disabled={scheduledPostsFromStore.length === 0 || !globalScheduleTime}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Apply to All
                </Button>
                {globalScheduleTime && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGlobalTimeChange(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear Global Time
                  </Button>
                )}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="bg-muted p-3 text-center font-medium text-sm">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {calendarDays.map((date) => (
                  <DroppableCalendarCell
                    key={date.toISOString()}
                    date={date.toISOString().split('T')[0]}
                    posts={getPostsForDate(date.toISOString().split('T')[0])}
                    isToday={isToday(date)}
                    isCurrentMonth={isCurrentMonth(date)}
                    onTimeChange={handleIndividualTimeChange}
                    generateTimeOptions={generateTimeOptions}
                    globalScheduleTime={globalScheduleTime}
                    individualPostTimes={individualPostTimes}
                    globalTimeApplied={globalTimeApplied}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Drag Overlay */}
          <DragOverlay>
            {draggedPost ? (
              <div className="w-80 bg-card border rounded-lg p-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-card-foreground line-clamp-2 mb-2">
                      {draggedPost.caption}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      {draggedPost.platforms.map((platform) => (
                        <div key={platform} className="w-5 h-5 bg-muted rounded-full flex items-center justify-center">
                          {platform === 'instagram' && <Instagram className="h-3 w-3 text-pink-500" />}
                          {platform === 'facebook' && <Facebook className="h-3 w-3 text-blue-600" />}
                          {platform === 'linkedin' && <Linkedin className="h-3 w-3 text-blue-700" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Publish Buttons */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-card-foreground">Publish All Posts:</span>
                <div className="flex gap-3">
                  <Button
                    onClick={() => publishAllForPlatform('instagram')}
                    className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700"
                    disabled={scheduledPostsFromStore.filter(post => post.accountIds && post.accountIds.length > 0).length === 0}
                  >
                    <Instagram className="h-4 w-4" />
                    Publish Instagram ({scheduledPostsFromStore.filter(post => post.accountIds && post.accountIds.length > 0).length})
                  </Button>
                  <Button
                    onClick={() => publishAllForPlatform('facebook')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={scheduledPostsFromStore.filter(post => post.accountIds && post.accountIds.length > 0).length === 0}
                  >
                    <Facebook className="h-4 w-4" />
                    Publish Facebook ({scheduledPostsFromStore.filter(post => post.accountIds && post.accountIds.length > 0).length})
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Total Scheduled: {scheduledPostsFromStore.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Modal */}
        {selectedPostForScheduling && (
          <SchedulingModal
            isOpen={isSchedulingModalOpen}
            onClose={handleCloseSchedulingModal}
            postId={selectedPostForScheduling.id}
            projectId={projectId}
            clientId={clientId}
            postCaption={selectedPostForScheduling.caption}
            postImageUrl={selectedPostForScheduling.imageUrl}
          />
        )}
      </div>
    </div>
  );
}
