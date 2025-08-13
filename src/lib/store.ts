'use client';

import { create } from 'zustand';

export type Post = {
  id: string;
  clientId: string;
  projectId: string;
  imageUrl: string;
  caption: string;
};

export type ScheduledPost = {
  id: string;
  clientId: string;
  projectId: string;
  postId: string;
  scheduledTime: string; // ISO string
  platform: 'facebook' | 'instagram' | 'linkedin';
  status: 'scheduled' | 'pending' | 'failed' | 'published';
};

type State = {
  posts: Record<string, Post[]>;           // key = `${clientId}:${projectId}`
  scheduled: Record<string, ScheduledPost[]>;

  getPostsByProjectAndClient: (projectId: string, clientId: string) => Post[];
  getScheduledPosts: (projectId: string, clientId: string) => ScheduledPost[];
  addScheduledPost: (sp: ScheduledPost) => void;
  addPostFromContentSuite: (imageUrl: string, caption: string, projectId: string, clientId: string, notes?: string) => void;
  schedulePost: (postId: string, scheduledDateTime: Date, platform: 'facebook' | 'instagram' | 'both', projectId: string, clientId: string) => Promise<void>;
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
                console.log('🔄 addScheduledPost called with:', sp);
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
                      platform: sp.platform,
                    }),
                  });

                  const result = await response.json();
                  console.log('📡 API response:', result);

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
                    console.log('✅ Local state updated successfully');
                  } else {
                    console.error('❌ Failed to add scheduled post:', result.error);
                  }
                } catch (error) {
                  console.error('❌ Error adding scheduled post:', error);
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
    };
    
    set((state) => ({
      posts: {
        ...state.posts,
        [key]: [...(state.posts[key] ?? []), newPost],
      },
    }));
  },

                schedulePost: async (postId, scheduledDateTime, platform, projectId, clientId) => {
                console.log('🔄 Zustand store schedulePost called with:', { 
                  postId, 
                  scheduledDateTime, 
                  platform, 
                  projectId, 
                  clientId 
                });
                
                const key = `${clientId}:${projectId}`;

                // Find the post to get its details
                const post = get().posts[key]?.find(p => p.id === postId);
                if (!post) {
                  console.error('❌ Post not found in store:', { postId, key });
                  throw new Error('Post not found');
                }

                console.log('✅ Found post in store:', post);

                // Create scheduled post entries
                const platforms = platform === 'both' ? ['facebook', 'instagram'] : [platform];

                for (const platformType of platforms) {
                  const scheduledPost: ScheduledPost = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    clientId,
                    projectId,
                    postId,
                    scheduledTime: scheduledDateTime.toISOString(),
                    platform: platformType as 'facebook' | 'instagram' | 'linkedin',
                    status: 'scheduled',
                  };

                  console.log('🔄 Creating scheduled post for platform:', platformType, scheduledPost);

                  // Use the new API-integrated addScheduledPost method
                  await get().addScheduledPost(scheduledPost);
                }
                
                console.log('✅ schedulePost completed successfully');
              },
}));
