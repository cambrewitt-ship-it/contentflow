'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Instagram, Facebook, Linkedin, GripVertical, Clock, Plus } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button } from 'components/ui/button';
import { Card, CardContent } from 'components/ui/card';
import { usePostStore } from 'lib/store';
import SchedulingModal from 'components/scheduling-modal';


interface ScheduledPost {
  id: string;
  caption: string;
  media: string;
  platforms: string[];
  date: string;
  status?: string;
  scheduledTime?: string;
  scheduledTimeString?: string; // For storing the time portion (HH:MM)
}

interface PostInQueue {
  id: string;
  caption: string;
  media: string;
  platforms: string[];
  selectedPlatform?: 'instagram' | 'facebook' | 'both' | null;
}

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
  onPlatformChange
}: { 
  post: PostInQueue; 
  isDragging?: boolean;
  onSchedule: (postId: string, platform: 'instagram' | 'facebook' | 'both') => void;
  onPlatformChange: (postId: string, platform: 'instagram' | 'facebook' | 'both' | null) => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'facebook' | 'both' | null>(
    post.selectedPlatform || null
  );
  
  // Sync local state with parent state when post.selectedPlatform changes
  useEffect(() => {
    setSelectedPlatform(post.selectedPlatform || null);
  }, [post.selectedPlatform]);
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: post.id,
    data: post,
    disabled: !selectedPlatform // Disable dragging if no platform is selected
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handlePlatformToggle = (platform: 'instagram' | 'facebook' | 'both') => {
    if (selectedPlatform === platform) {
      // If clicking the same platform, deselect it
      setSelectedPlatform(null);
      // Update the post's selectedPlatform property
      post.selectedPlatform = null;
      // Notify parent component
      onPlatformChange(post.id, null);
    } else {
      // Otherwise, select the new platform (this will deselect the other one)
      setSelectedPlatform(platform);
      // Update the post's selectedPlatform property
      post.selectedPlatform = platform;
      // Notify parent component
      onPlatformChange(post.id, platform);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(selectedPlatform ? listeners : {})}
      {...(selectedPlatform ? attributes : {})}
      className={`bg-card border rounded-lg p-3 transition-all ${
        selectedPlatform 
          ? 'cursor-grab hover:shadow-md active:cursor-grabbing border-primary/30' 
          : 'cursor-default opacity-75'
      } ${isDragging ? 'opacity-50 scale-95' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <img
            src={post.media}
            alt="Post media"
            className="w-12 h-12 bg-muted rounded-md object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-card-foreground line-clamp-3 mb-2">
            {post.caption}
          </p>
          
          <div className="flex items-center gap-2">
            {/* Show selected platform if one is selected, otherwise show default platforms */}
            {post.selectedPlatform ? (
              <div className="flex items-center gap-1">
                {post.selectedPlatform === 'instagram' && (
                  <div className="w-5 h-5 bg-pink-100 border-2 border-pink-500 rounded-full flex items-center justify-center">
                    <Instagram className="h-3 w-3 text-pink-600" />
                  </div>
                )}
                {post.selectedPlatform === 'facebook' && (
                  <div className="w-5 h-5 bg-blue-100 border-2 border-blue-600 rounded-full flex items-center justify-center">
                    <Facebook className="h-3 w-3 text-blue-700" />
                  </div>
                )}
                {post.selectedPlatform === 'both' && (
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 bg-pink-100 border-2 border-pink-500 rounded-full flex items-center justify-center">
                      <Instagram className="h-3 w-3 text-pink-600" />
                    </div>
                    <div className="w-5 h-5 bg-blue-100 border-2 border-blue-600 rounded-full flex items-center justify-center">
                      <Facebook className="h-3 w-3 text-blue-700" />
                    </div>
                  </div>
                )}
                {/* Drag indicator */}
                <div className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  Ready to drag
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {post.platforms.map((platform) => (
                  <div key={platform} className="w-5 h-5 bg-muted rounded-full flex items-center justify-center">
                    {platform === 'instagram' && <Instagram className="h-3 w-3 text-pink-500" />}
                    {platform === 'facebook' && <Facebook className="h-3 w-3 text-blue-600" />}
                    {platform === 'linkedin' && <Linkedin className="h-3 w-3 text-blue-700" />}
                  </div>
                ))}
                {/* Platform selection required indicator */}
                <div className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                  Select platform to drag
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Scheduling Buttons */}
      <div className="flex gap-1 mt-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant={selectedPlatform === 'instagram' ? "default" : "outline"}
          className={`flex-1 h-7 text-xs px-2 ${
            selectedPlatform === 'instagram' 
              ? 'bg-pink-600 hover:bg-pink-700 text-white border-pink-600' 
              : ''
          }`}
          onClick={() => handlePlatformToggle('instagram')}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Instagram className="h-3 w-3 mr-1 text-pink-500" />
          Instagram
        </Button>
        <Button
          size="sm"
          variant={selectedPlatform === 'facebook' ? "default" : "outline"}
          className={`flex-1 h-7 text-xs px-2 ${
            selectedPlatform === 'facebook' 
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
              : ''
          }`}
          onClick={() => handlePlatformToggle('facebook')}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Facebook className="h-3 w-3 mr-1 text-blue-600" />
          Facebook
        </Button>
        <Button
          size="sm"
          variant={selectedPlatform === 'both' ? "default" : "outline"}
          className={`flex-1 h-7 text-xs px-2 ${
            selectedPlatform === 'both' 
              ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' 
              : ''
          }`}
          onClick={() => handlePlatformToggle('both')}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Calendar className="h-3 w-3 mr-1" />
          Both
        </Button>

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
  posts: ScheduledPost[]; 
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [draggedPost, setDraggedPost] = useState<PostInQueue | null>(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [selectedPostForScheduling, setSelectedPostForScheduling] = useState<PostInQueue | null>(null);
  const [globalScheduleTime, setGlobalScheduleTime] = useState<string | null>(null);
  const [individualPostTimes, setIndividualPostTimes] = useState<Record<string, string>>({});
  const [globalTimeApplied, setGlobalTimeApplied] = useState(false);
  
  // Get posts from Zustand store
  const key = `${clientId}:${projectId}`;
const postsMap = usePostStore(s => s.posts);
const scheduledMap = usePostStore(s => s.scheduled);

const storePosts = useMemo(() => postsMap?.[key] ?? [], [postsMap, key]);
const scheduledPostsFromStore = useMemo(() => scheduledMap?.[key] ?? [], [scheduledMap, key]);

// Get the schedule action from the store
const schedulePostAction = usePostStore(s => s.schedulePost);
  
  // Convert store posts to PostInQueue format for the scheduler
  const [postsReadyToSchedule, setPostsReadyToSchedule] = useState<PostInQueue[]>([]);
  
  // Update postsReadyToSchedule when storePosts changes
  useEffect(() => {
    setPostsReadyToSchedule(storePosts.map(post => ({
      id: post.id,
      caption: post.caption,
      media: post.imageUrl, // Use imageUrl from store
      platforms: defaultPlatforms, // Use default platforms for now (can be enhanced later)
      selectedPlatform: null, // Initialize with no platform selected
    })));
  }, [storePosts]);

  const handleSchedulePost = (post: PostInQueue) => {
    setSelectedPostForScheduling(post);
    setIsSchedulingModalOpen(true);
  };

  const handleCloseSchedulingModal = () => {
    setIsSchedulingModalOpen(false);
    setSelectedPostForScheduling(null);
  };

  const handleQuickSchedule = async (postId: string, platform: 'instagram' | 'facebook' | 'both') => {
    try {
      console.log('🔄 Quick scheduling post:', { postId, platform, projectId, clientId });
      // Schedule the post immediately for the current date
      await schedulePostAction(postId, new Date(), platform, projectId, clientId);
      console.log('✅ Quick schedule completed successfully');
    } catch (error) {
      console.error('❌ Failed to quick schedule post:', error);
    }
  };

  const handlePlatformChange = (postId: string, platform: 'instagram' | 'facebook' | 'both' | null) => {
    // Update the post's selectedPlatform in the postsReadyToSchedule state
    setPostsReadyToSchedule(prev => 
      prev.map(post => 
        post.id === postId 
          ? { ...post, selectedPlatform: platform }
          : post
      )
    );
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

  const handleIndividualTimeChange = (postId: string, newTime: string) => {
    // Always allow individual time changes - global time is just a selection until applied
    setIndividualPostTimes(prev => ({
      ...prev,
      [postId]: newTime
    }));
    
    console.log('🕐 Updated post time:', postId, 'to', newTime);
  };

  const handleGlobalTimeChange = (newTime: string | null) => {
    setGlobalScheduleTime(newTime);
    
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
      const postsToPublish = scheduledPostsFromStore.filter(post => post.platform === platform);
      
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
    const post = postsReadyToSchedule.find(p => p.id === active.id);
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
        // Use the post's selected platform, or default to 'instagram' if none selected
        const platform = (post.selectedPlatform || 'instagram') as 'facebook' | 'instagram' | 'both';
        
        console.log('🔄 Drag-and-drop scheduling post:', { 
          postId: post.id, 
          targetDate, 
          platform, 
          projectId, 
          clientId,
          selectedPlatform: post.selectedPlatform
        });
        
        try {
          await schedulePostAction(post.id, new Date(targetDate), platform, projectId, clientId);
          
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
        const post = storePosts.find(p => p.id === scheduledPost.postId);
        if (!post) return null;
        
        // Handle 'both' platform by showing both Instagram and Facebook icons
        const platforms = scheduledPost.platform === 'both' ? ['instagram', 'facebook'] : [scheduledPost.platform];
        
        return {
          id: scheduledPost.id,
          caption: post.caption,
          media: post.imageUrl,
          platforms: platforms,
          date: date,
          status: scheduledPost.status,
          scheduledTime: scheduledPost.scheduledTime // Include the actual scheduled time
        };
      })
      .filter(Boolean) as ScheduledPost[];
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
                  disabled={postsReadyToSchedule.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Post
                </Button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {postsReadyToSchedule.map((post) => (
                  <div key={post.id} className="relative">
                    <DraggablePost
                      post={post}
                      isDragging={draggedPost?.id === post.id}
                      onSchedule={handleQuickSchedule}
                      onPlatformChange={handlePlatformChange}
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
              {scheduledPostsFromStore.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No posts scheduled yet. Use the calendar below or click "Schedule Post" above.
                </p>
              ) : (
                <div className="space-y-3">
                  {scheduledPostsFromStore.map((scheduledPost) => {
                    const post = storePosts.find(p => p.id === scheduledPost.postId);
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
                              {scheduledPost.platform}
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
                  onChange={(e) => setGlobalScheduleTime(e.target.value || null)}
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
                    onClick={() => setGlobalScheduleTime(null)}
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
                    disabled={scheduledPostsFromStore.filter(post => post.platform === 'instagram').length === 0}
                  >
                    <Instagram className="h-4 w-4" />
                    Publish Instagram ({scheduledPostsFromStore.filter(post => post.platform === 'instagram').length})
                  </Button>
                  <Button
                    onClick={() => publishAllForPlatform('facebook')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={scheduledPostsFromStore.filter(post => post.platform === 'facebook').length === 0}
                  >
                    <Facebook className="h-4 w-4" />
                    Publish Facebook ({scheduledPostsFromStore.filter(post => post.platform === 'facebook').length})
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
            postImageUrl={selectedPostForScheduling.media}
          />
        )}
      </div>
    </div>
  );
}
