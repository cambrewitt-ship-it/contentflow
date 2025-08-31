'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  content_metadata?: {
    posts?: Array<{
      id: string;
      images?: Array<{
        id: string;
        notes?: string;
        preview: string;
      }>;
      captions?: Array<{
        id: string;
        text: string;
        isSelected: boolean;
      }>;
      selectedCaption?: string;
      postNotes?: string;
      activeImageId?: string;
      createdAt?: string;
    }>;
  };
}

interface Post {
  id: string;
  project_id: string;
  caption: string;
  image_url: string;
  scheduled_time: string | null;
  scheduled_date?: string;
  status: 'draft' | 'scheduled' | 'published';
  late_post_id?: string;
  platforms_scheduled?: string[];
  late_status?: string;
}

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
}

export default function PlannerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params?.clientId as string;
  const projectId = searchParams?.get('projectId');
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  console.log('📍 PlannerPage render - clientId:', clientId, 'projectId:', projectId);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId || null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  
  const [projectPosts, setProjectPosts] = useState<Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);

  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      const data = await response.json();
      setConnectedAccounts(data.accounts || []);
      console.log('Connected accounts:', data.accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchUnscheduledPosts = async () => {
      try {
        console.log('Fetching unscheduled posts for project:', projectId);
        const response = await fetch(`/api/planner/unscheduled?projectId=${projectId}`);
        const data = await response.json();
        console.log('Unscheduled posts response:', data);
        setProjectPosts(data.posts || []);
      } catch (error) {
        console.error('Error fetching unscheduled posts:', error);
      }
    };

  const fetchScheduledPosts = async () => {
    try {
      const response = await fetch(`/api/planner/scheduled?projectId=${projectId}`);
      const data = await response.json();
      
      // Map posts by date
      const mapped: {[key: string]: Post[]} = {};
      data.posts?.forEach((post: Post) => {
        const dateKey = post.scheduled_date;
        if (dateKey && !mapped[dateKey]) mapped[dateKey] = [];
        if (dateKey) mapped[dateKey].push(post);
      });
      
      setScheduledPosts(mapped);
      console.log('Scheduled posts loaded:', mapped);
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
    }
  };

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

  useEffect(() => {
    if (projectId && clientId) {
      fetchUnscheduledPosts();
      fetchScheduledPosts();
      fetchConnectedAccounts();
    }
  }, [projectId, clientId]);

  useEffect(() => {
    console.log('🔄 useEffect triggered - projectId:', projectId, 'projects.length:', projects.length);
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      console.log('🔍 Found project:', project);
      if (project) {
        setCurrentProject(project);
        setSelectedProject(projectId);
        // Fetch posts after project is loaded
        fetchUnscheduledPosts();
        fetchScheduledPosts();
      }
    }
  }, [projectId, projects]);

  const fetchProjects = async () => {
    if (!clientId) return;
    
    try {
      const response = await fetch(`/api/projects?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeeksToDisplay = () => {
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      weeks.push(getStartOfWeek(weekOffset + i));
    }
    return weeks;
  };



  const handleDragStart = (e: React.DragEvent, post: Post) => {
    e.dataTransfer.setData('post', JSON.stringify(post));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-300');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-500', 'ring-2', 'ring-blue-300');
  };

  // Helper function to convert 24-hour time to 12-hour format
  const formatTimeTo12Hour = (time24: string) => {
    if (!time24) return '';
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleEditScheduledPost = async (post: Post, newTime: string) => {
    if (!newTime || newTime === post.scheduled_time?.slice(0, 5)) return;
    
    try {
      console.log('Updating post time to:', newTime);
      
      const response = await fetch('/api/planner/scheduled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            scheduled_time: newTime + ':00'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update');
      }
      
      fetchScheduledPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update time');
    }
  };

  const handleDrop = async (e: React.DragEvent, weekIndex: number, dayIndex: number) => {
    e.preventDefault();
    const postData = e.dataTransfer.getData('post');
    if (!postData) return;
    
    const post = JSON.parse(postData);
    const weekStart = getWeeksToDisplay()[weekIndex];
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayIndex);
    
    const time = '12:00'; // Default to noon, will add proper time picker later
    
    try {
      // Just move to scheduled table for planning
      await fetch('/api/planner/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unscheduledId: post.id,
          scheduledPost: {
            project_id: projectId,
            client_id: clientId,
            caption: post.caption,
            image_url: post.image_url,
            post_notes: post.post_notes,
            scheduled_date: targetDate.toISOString().split('T')[0],
            scheduled_time: time + ':00'
          }
        })
      });
      
      // Refresh both lists
      fetchUnscheduledPosts();
      fetchScheduledPosts();
      
    } catch (error) {
      console.error('Error planning post:', error);
      alert('Failed to plan post');
    }
  };

  const handleMovePost = async (e: React.DragEvent, weekIndex: number, dayIndex: number) => {
    e.preventDefault();
    const postData = e.dataTransfer.getData('scheduledPost');
    if (!postData) return;
    
    const post: Post = JSON.parse(postData);
    
    const weekStart = getWeeksToDisplay()[weekIndex];
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + dayIndex);
    
    try {
      await fetch('/api/planner/scheduled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          updates: {
            scheduled_date: newDate.toISOString().split('T')[0]
          }
        })
      });
      
      fetchScheduledPosts();
    } catch (error) {
      console.error('Error moving post:', error);
    }
  };



  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedForDelete.size} posts?`)) return;
    
    const errors = [];
    const toDelete = Array.from(selectedForDelete);
    const allPosts = Object.values(scheduledPosts).flat();
    
    // Process all deletions with Promise.all for better handling
    const deletePromises = toDelete.map(async (postId) => {
      try {
        const post = allPosts.find(p => p.id === postId);
        
        // Delete from LATE if applicable
        if (post?.late_post_id) {
          await fetch(`/api/late/delete-post?latePostId=${post.late_post_id}`, {
            method: 'DELETE'
          });
        }
        
        // Delete from database
        const dbResponse = await fetch('/api/planner/scheduled', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: postId })
        });
        
        if (!dbResponse.ok) {
          throw new Error(`Failed to delete ${postId}`);
        }
        
        return { success: true, postId };
      } catch (error) {
        console.error(`Error deleting ${postId}:`, error);
        return { success: false, postId, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    
    // Wait for all deletions to complete
    const results = await Promise.all(deletePromises);
    
    const failed = results.filter(r => !r.success);
    const succeeded = results.filter(r => r.success);
    
    // Clear selection and refresh AFTER all deletions complete
    setSelectedForDelete(new Set());
    await fetchScheduledPosts();
    
    if (failed.length > 0) {
      alert(`Deleted ${succeeded.length} posts. Failed to delete ${failed.length} posts.`);
    } else {
      alert(`Successfully deleted ${succeeded.length} posts`);
    }
  };

  const handleScheduleToPlatform = async (account: ConnectedAccount) => {
    if (selectedPosts.size === 0) return;
    
    const confirmed = confirm(`Schedule ${selectedPosts.size} posts to ${account.platform}?`);
    if (!confirmed) return;
    
    const allScheduledPosts = Object.values(scheduledPosts).flat();
    const postsToSchedule = allScheduledPosts.filter(p => selectedPosts.has(p.id));
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const post of postsToSchedule) {
      try {
        console.log(`Scheduling post ${successCount + failCount + 1} of ${postsToSchedule.length}`);
        
        // Step 1: Upload image to LATE
        const mediaResponse = await fetch('/api/late/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBlob: post.image_url })
        });
        
        if (!mediaResponse.ok) {
          throw new Error(`Media upload failed for post: ${post.caption.slice(0, 30)}...`);
        }
        
        const { lateMediaUrl } = await mediaResponse.json();
        
        // Step 2: Schedule via LATE
        const scheduledDateTime = `${post.scheduled_date}T${post.scheduled_time}`;
        
        const response = await fetch('/api/late/schedule-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post.id,
            caption: post.caption,
            lateMediaUrl: lateMediaUrl,
            scheduledDateTime: scheduledDateTime,
            selectedAccounts: [account],
            clientId: clientId
          })
        });
        
        if (!response.ok) {
          throw new Error(`Schedule failed for post: ${post.caption.slice(0, 30)}...`);
        }
        
        const result = await response.json();
        const latePostId = result.latePostId || result.late_post_id || result.id;
        
        if (latePostId) {
          // Update database with LATE post ID
          await supabase
            .from('planner_scheduled_posts')
            .update({
              late_status: 'scheduled',
              late_post_id: latePostId,
              platforms_scheduled: [...(post.platforms_scheduled || []), account.platform]
            })
            .eq('id', post.id);
        }
        
        successCount++;
        
        // Small delay between posts to avoid rate limiting
        if (postsToSchedule.length > 1 && successCount < postsToSchedule.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to schedule post:`, error);
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        failCount++;
      }
    }
    
    // Clear selection and refresh
    setSelectedPosts(new Set());
    setSelectedForDelete(new Set());
    fetchScheduledPosts();
    
    // Show results
    if (failCount === 0) {
      alert(`Successfully scheduled ${successCount} posts to ${account.platform}!`);
    } else {
      alert(`Scheduled ${successCount} posts to ${account.platform}.\n\nFailed: ${failCount}\nErrors:\n${errors.join('\n')}`);
    }
  };




  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 pb-8">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/client/${clientId}`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentProject ? `${currentProject.name} Planner` : 'Content Planner'}
                </h1>
                {currentProject && (
                  <p className="text-sm text-gray-500 mt-1">
                    Planning content for {currentProject.name}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Link
                href={`/dashboard/client/${clientId}/content-suite`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Content
              </Link>
            </div>
          </div>
        </div>



        {/* Posts Queue */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Posts in Project</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {projectPosts.length === 0 ? (
              <div className="text-gray-400 text-sm py-4">
                No posts added yet. Add posts from Content Suite.
              </div>
            ) : (
              projectPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 cursor-move hover:border-blue-400"
                  draggable
                  onDragStart={(e) => handleDragStart(e, post)}
                >
                  <img
                    src={post.image_url || '/api/placeholder/100/100'}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Schedule Buttons */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            {/* Navigation buttons can go here if needed */}
          </div>
          
          {selectedPosts.size > 0 && connectedAccounts.length > 0 && (
            <div className="flex gap-2">
              <span className="text-sm text-gray-600 py-2">
                {selectedPosts.size} selected:
              </span>
              {connectedAccounts.map((account) => (
                <button
                  key={account._id}
                  onClick={() => handleScheduleToPlatform(account)}
                  className={`px-3 py-1.5 text-white rounded text-sm ${
                    account.platform === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' :
                    account.platform === 'twitter' ? 'bg-sky-500 hover:bg-sky-600' :
                    account.platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                    account.platform === 'linkedin' ? 'bg-blue-700 hover:bg-blue-800' :
                    'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  Schedule to {account.platform}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Bulk Delete Button */}
        {selectedForDelete.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mb-4"
          >
            Delete {selectedForDelete.size} Selected Posts
          </button>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {currentProject ? `${currentProject.name} - 4 Week View` : 'All Projects - 4 Week View'}
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  className="p-2 rounded-md border hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Week {weekOffset + 1} - {weekOffset + 4}
                </span>
                <button
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-2 rounded-md border hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4 pb-2">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  {getStartOfWeek(weekOffset).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' })} - 
                  {getStartOfWeek(weekOffset + 3).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Current Week
                </button>
              </div>
              
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] p-4">
              <div className="grid grid-cols-4 gap-4">
                {getWeeksToDisplay().map((weekStart, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col border rounded-lg bg-white w-64">
                    <div className="bg-gray-50 p-3 border-b">
                      <h3 className="font-semibold text-sm">
                        Week {weekOffset + weekIndex + 1}
                        {weekOffset + weekIndex === 0 && ' (Current)'}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} - 
                        {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIndex) => {
                        const dayDate = new Date(weekStart);
                        dayDate.setDate(weekStart.getDate() + dayIndex);
                        const isToday = dayDate.toDateString() === new Date().toDateString();
                        
                        return (
                          <div
                            key={day}
                            className={`p-2 rounded min-h-[80px] border-2 border-transparent transition-all duration-200 ${
                              isToday ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              if (e.dataTransfer.getData('scheduledPost')) {
                                handleMovePost(e, weekIndex, dayIndex);
                              } else {
                                handleDrop(e, weekIndex, dayIndex);
                              }
                            }}
                          >
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{day}</span>
                              <span className="text-gray-500">{dayDate.getDate()}</span>
                            </div>
                            
                                                        {/* Display scheduled posts */}
                            {scheduledPosts[dayDate.toISOString().split('T')[0]]?.map((post: Post, idx: number) => (
                              <div key={idx} className="mt-1">
                                {editingPostId === post.id ? (
                                  <input
                                    type="time"
                                    defaultValue={post.scheduled_time?.slice(0, 5)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleEditScheduledPost(post, e.currentTarget.value);
                                        setEditingPostId(null);
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingPostId(null);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      handleEditScheduledPost(post, e.target.value);
                                      setEditingPostId(null);
                                    }}
                                    className="text-xs p-1 rounded border"
                                    autoFocus
                                  />
                                ) : (
                                  <div 
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('scheduledPost', JSON.stringify(post));
                                      e.dataTransfer.setData('originalDate', dayDate.toISOString().split('T')[0]);
                                    }}
                                    className={`flex items-center gap-1 rounded p-1 cursor-move hover:opacity-80 ${
                                      post.late_status === 'scheduled' 
                                        ? 'bg-green-100 border border-green-300' 
                                        : 'bg-blue-100 border border-blue-300'
                                    }`}
                                    onClick={() => setEditingPostId(post.id)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPosts.has(post.id) || selectedForDelete.has(post.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        
                                        // Update both selection sets
                                        const newSelectedPosts = new Set(selectedPosts);
                                        const newSelectedDelete = new Set(selectedForDelete);
                                        
                                        if (e.target.checked) {
                                          newSelectedPosts.add(post.id);
                                          newSelectedDelete.add(post.id);
                                        } else {
                                          newSelectedPosts.delete(post.id);
                                          newSelectedDelete.delete(post.id);
                                        }
                                        
                                        setSelectedPosts(newSelectedPosts);
                                        setSelectedForDelete(newSelectedDelete);
                                      }}
                                      className="w-3 h-3"
                                    />
                                    
                                    {/* LATE Status Indicator */}
                                    {post.late_status && (
                                      <div className={`w-2 h-2 rounded-full ${
                                        post.late_status === 'scheduled' ? 'bg-green-500' :
                                        post.late_status === 'published' ? 'bg-green-600' :
                                        post.late_status === 'failed' ? 'bg-red-500' :
                                        'bg-gray-400'
                                      }`} title={`LATE Status: ${post.late_status}`} />
                                    )}
                                    <img 
                                      src={post.image_url || '/api/placeholder/100/100'} 
                                      alt="Post"
                                      className="w-8 h-8 object-cover rounded"
                                    />
                                    <span className="text-xs">
                                      {post.scheduled_time ? formatTimeTo12Hour(post.scheduled_time) : '12:00 PM'}
                                    </span>
                                    
                                    {/* Delete Button - Only show for confirmed scheduled posts */}
                                    {post.late_status === 'scheduled' && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!confirm('Delete this scheduled post?')) return;
                                          
                                          try {
                                            // Only try to delete from LATE if we have a valid LATE post ID
                                            if (post.late_post_id) {
                                              console.log('Deleting from LATE:', post.late_post_id);
                                              const lateResponse = await fetch(`/api/late/delete-post?latePostId=${post.late_post_id}`, {
                                                method: 'DELETE'
                                              });
                                              
                                              if (!lateResponse.ok) {
                                                console.error('Failed to delete from LATE');
                                              }
                                            } else {
                                              console.log('No LATE ID - this post was scheduled before LATE integration');
                                            }
                                            
                                            // Delete from your local database
                                            const dbResponse = await fetch('/api/planner/scheduled', {
                                              method: 'DELETE',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ postId: post.id })
                                            });
                                            
                                            if (!dbResponse.ok) {
                                              throw new Error('Failed to delete from database');
                                            }
                                            
                                            // Refresh the list
                                            fetchScheduledPosts();
                                            
                                          } catch (error) {
                                            console.error('Delete error:', error);
                                            alert('Failed to delete post');
                                          }
                                        }}
                                        className="ml-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                                        title="Delete scheduled post"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

