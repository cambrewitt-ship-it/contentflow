'use client';

import { create } from 'zustand';
import logger from '@/lib/logger';

export type Post = {
  id: string;
  clientId: string;
  projectId: string;
  imageUrl: string; // Original blob URL for preview
  caption: string;
  lateMediaUrl?: string; // LATE API media URL for posting
  mediaType: 'image' | 'video';
  originalCaption?: string; // Selected caption from content suite
  notes?: string;
  createdAt: string; // ISO string
  status: 'draft' | 'ready' | 'scheduled' | 'published';
};

export type ScheduledPost = {
  id: string;
  clientId: string;
  projectId: string;
  postId: string;
  scheduledTime: string; // ISO string
  accountIds: string[]; // Array of account IDs to post to
  status: 'scheduled' | 'pending' | 'failed' | 'published';
};

type State = {
  posts: Record<string, Post[]>;           // key = `${clientId}:${projectId}`
  scheduled: Record<string, ScheduledPost[]>;

  getPostsByProjectAndClient: (projectId: string, clientId: string) => Post[];
  getScheduledPosts: (projectId: string, clientId: string) => ScheduledPost[];
  addScheduledPost: (sp: ScheduledPost) => void;
  addPost: (post: Post) => void;
  addPostFromContentSuite: (imageUrl: string, caption: string, projectId: string, clientId: string, notes?: string) => void;
  sendToScheduler: (imageUrl: string, caption: string, projectId: string, clientId: string, notes?: string) => Promise<Post>;
  schedulePost: (postId: string, scheduledDateTime: Date, accountIds: string[], projectId: string, clientId: string) => Promise<void>;
};

// Create the store ONCE at module scope
export const usePostStore = create<State>((set, get) => ({
  posts: {},
  scheduled: {},

  getPostsByProjectAndClient: (projectId, clientId) => {
    const key = `${clientId}:${projectId}`;
    return get().posts[key] ?? [];
  },

  getScheduledPosts: (projectId, clientId) => {
    const key = `${clientId}:${projectId}`;
    return get().scheduled[key] ?? [];
  },

                addScheduledPost: async (sp) => {

                try {
                  const response = await fetch('/api/schedulePost', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      client_id: sp.clientId,
                      project_id: sp.projectId,
                      post_id: sp.postId,
                      scheduled_time: sp.scheduledTime,
                      account_ids: sp.accountIds, // Updated to use accountIds
                    }),
                  });

                  const result = await response.json();

                  if (result.success) {
                    // Update local state with the response from the API
                    const key = `${sp.clientId}:${sp.projectId}`;
                    const newScheduledPost = {
                      ...sp,
                      id: result.id, // Use the ID returned from the API
                    };
                    
                    set((state) => ({
                      scheduled: {
                        ...state.scheduled,
                        [key]: [...(state.scheduled[key] ?? []), newScheduledPost],
                      },
                    }));

                  } else {
                    logger.error('❌ Failed to add scheduled post:', result.error);
                  }
                } catch (error) {
                  logger.error('❌ Error adding scheduled post:', error);
                }
              },

  addPostFromContentSuite: (imageUrl, caption, projectId, clientId, notes) => {
    const key = `${clientId}:${projectId}`;
    const newPost: Post = {
      id: Date.now().toString(), // Simple ID generation
      clientId,
      projectId,
      imageUrl,
      caption,
      mediaType: 'image', // Default to image for now
      createdAt: new Date().toISOString(),
      status: 'draft',
      notes: notes || '',
    };
    
    set((state) => ({
      posts: {
        ...state.posts,
        [key]: [...(state.posts[key] ?? []), newPost],
      },
    }));
  },

  // Add a simple post to the store
  addPost: (post: Post) => {
    const key = `${post.clientId}:${post.projectId}`;

    // Get current state before modification
    const currentState = get();
    
    set((state) => {
      const newState = {
        posts: {
          ...state.posts,
          [key]: [...(state.posts[key] ?? []), post],
        },
      };
      
      return newState;
    });

  },

  // New function for LATE API integration
  sendToScheduler: async (imageUrl: string, caption: string, projectId: string, clientId: string, notes?: string) => {
    try {

      // Step 1: Upload media to LATE API
      const mediaFormData = new FormData();
      // Convert blob URL to File object for upload
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'content-image.jpg', { type: blob.type });
      mediaFormData.append('media', file);

      const mediaResponse = await fetch('/api/late/upload-media', {
        method: 'POST',
        body: mediaFormData,
      });
      
      if (!mediaResponse.ok) {
        throw new Error(`LATE media upload failed: ${mediaResponse.statusText}`);
      }
      
      const mediaData = await mediaResponse.json();

      // Step 2: Create post object with LATE media URL
      const newPost: Post = {
        id: Date.now().toString(),
        clientId,
        projectId,
        imageUrl, // Keep original for preview
        caption,
        lateMediaUrl: mediaData.mediaUrl, // LATE API media URL
        mediaType: 'image',
        originalCaption: caption,
        createdAt: new Date().toISOString(),
        status: 'ready', // Mark as ready for scheduling
        notes: notes || '',
      };
      
      // Step 3: Save to store
      const key = `${clientId}:${projectId}`;
      set((state) => ({
        posts: {
          ...state.posts,
          [key]: [...(state.posts[key] ?? []), newPost],
        },
      }));

      return newPost;
      
    } catch (error) {
      logger.error('❌ Error sending to scheduler:', error);
      throw error;
    }
  },

                schedulePost: async (postId, scheduledDateTime, accountIds, projectId, clientId) => {

                const key = `${clientId}:${projectId}`;

                // Find the post to get its details
                const post = get().posts[key]?.find(p => p.id === postId);
                if (!post) {
                  logger.error('❌ Post not found in store:', { postId, key });
                  throw new Error('Post not found');
                }

                // Create only one scheduled post with the specified platform
                // This prevents double-posting when platform is 'both'
                const scheduledPost: ScheduledPost = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  clientId,
                  projectId,
                  postId,
                  scheduledTime: scheduledDateTime.toISOString(),
                  accountIds: accountIds,
                  status: 'scheduled',
                };

                // Use the new API-integrated addScheduledPost method
                await get().addScheduledPost(scheduledPost);

              },
}));
