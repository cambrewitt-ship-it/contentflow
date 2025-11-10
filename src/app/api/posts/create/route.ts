import { NextRequest, NextResponse } from 'next/server';
import { isValidMediaData } from '../../../../lib/blobUpload';
import { withPostLimitCheck, trackPostCreation } from '../../../../lib/subscriptionMiddleware';
import logger from '@/lib/logger';
import { requireClientOwnership, requireProjectOwnership } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // SUBSCRIPTION: Check post limits
    const subscriptionCheck = await withPostLimitCheck(request);
    
    // Check if subscription check failed
    if (!subscriptionCheck.allowed) {
      logger.error('Subscription check failed:', subscriptionCheck.error);
      return NextResponse.json({ 
        error: subscriptionCheck.error || 'Post limit reached',
        details: subscriptionCheck.error
      }, { status: 403 });
    }
    
    // Validate that userId exists
    if (!subscriptionCheck.userId) {
      logger.error('User ID not found in subscription check');
      return NextResponse.json({ 
        error: 'User identification failed',
        details: 'Could not identify user for post creation'
      }, { status: 401 });
    }
    
    const userId = subscriptionCheck.userId;

    const body = await request.json();

    // Handle both array format and individual post format
    let posts, clientId, projectId, status = 'draft';

    if (body.posts && Array.isArray(body.posts)) {
      // Array format: { posts: [...], clientId, projectId }
      posts = body.posts;
      clientId = body.clientId;
      projectId = body.projectId;
      status = body.status || 'draft';
    } else if (body.caption && body.image_url) {
      // Individual post format: { caption, image_url, client_id, project_id, ... }
      posts = [body];
      clientId = body.client_id;
      projectId = body.project_id;
      status = body.status || 'draft';
    } else {
      throw new Error('Invalid request format - expected either posts array or individual post data');
    }

    // Validate media URLs in posts and detect media type
    for (const post of posts) {
      if (post.image_url) {
        const validation = isValidMediaData(post.image_url);
        if (!validation.isValid) {
          logger.error('Invalid media URL in post');
          return NextResponse.json(
            { error: `Invalid media URL: ${post.image_url}` },
            { status: 400 }
          );
        }
        // Store the detected media type in the post object for use below
        post._detected_media_type = validation.mediaType;
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required for post creation' },
        { status: 400 }
      );
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    let supabase = auth.supabase;

    if (projectId && projectId !== 'default') {
      const projectAuth = await requireProjectOwnership(request, projectId);
      if (projectAuth.error) return projectAuth.error;
      supabase = projectAuth.supabase;
    }

    // Create posts in the main posts table
    const postsToInsert = posts.map((post: {
      caption: string;
      image_url: string;
      notes?: string;
      edit_reason?: string;
      media_type?: string;
      _detected_media_type?: 'image' | 'video' | 'unknown';
    }) => {
      // Determine media type: use explicit media_type from post, or use detected type, or default to 'image'
      const finalMediaType = post.media_type ||
        (post._detected_media_type === 'video' ? 'video' : 'image');

      return {
        client_id: clientId,
        project_id: projectId || 'default',
        caption: post.caption,
        image_url: post.image_url,
        media_type: finalMediaType,
        status: status,
        notes: post.notes || '',
        // New editing fields
        original_caption: post.caption, // Set original caption on creation
        edit_count: 0, // Start with 0 edits
        needs_reapproval: false, // New posts don't need reapproval
        approval_status: 'pending', // Default approval status
        edit_reason: post.edit_reason || null,
      };
    });

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .insert(postsToInsert)
      .select();

    if (postsError) {
      logger.error('Supabase error creating posts:', {
        code: postsError.code,
        message: postsError.message
      });
      throw postsError;
    }

    // Track post creation for subscription usage
    await trackPostCreation(userId);

    // CRITICAL STEP: Also create entries in calendar_unscheduled_posts table to ensure they appear in the calendar
    if (postsData && postsData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calendarPosts = postsData.map((post: any) => ({
        project_id: projectId || 'default',
        client_id: clientId,
        caption: post.caption,
        image_url: post.image_url, // Use the image_url from the posts table
        post_notes: post.notes || '',
        status: 'draft'
      }));

      const { data: calendarData, error: calendarError } = await supabase
        .from('calendar_unscheduled_posts')
        .insert(calendarPosts)
        .select();

      if (calendarError) {
        logger.error('Error creating calendar posts:', { message: calendarError.message });
        logger.warn('Posts created but failed to sync to calendar system');
      }
    }

    return NextResponse.json({ success: true, posts: postsData });
  } catch (error) {
    logger.error('Error creating posts:', error);
    return NextResponse.json({
      error: 'Failed to create posts',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
