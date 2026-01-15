import { NextRequest, NextResponse } from 'next/server';
import { withPostLimitCheck, trackPostCreation } from '../../../../lib/subscriptionMiddleware';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

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
        details: 'Could not identify user for post duplication'
      }, { status: 401 });
    }
    
    const userId = subscriptionCheck.userId;

    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required for duplication' },
        { status: 400 }
      );
    }

    // Get auth context
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Fetch the original post from calendar_scheduled_posts (where calendar posts live)
    const { data: originalPost, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (fetchError || !originalPost) {
      logger.error('Error fetching original post from calendar_scheduled_posts:', fetchError);
      return NextResponse.json(
        { error: 'Post not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Track post creation for subscription usage
    await trackPostCreation(userId);

    // Create the duplicated post directly in calendar_unscheduled_posts
    const now = new Date().toISOString();
    const newPostId = crypto.randomUUID();
    
    const calendarPost = {
      id: newPostId,
      project_id: originalPost.project_id || null,
      client_id: originalPost.client_id,
      caption: originalPost.caption,
      image_url: originalPost.image_url,
      post_notes: originalPost.post_notes || '',
      created_at: now
    };

    const { data: newPost, error: insertError } = await supabase
      .from('calendar_unscheduled_posts')
      .insert(calendarPost)
      .select()
      .single();

    if (insertError) {
      logger.error('Error creating duplicated post in calendar_unscheduled_posts:', {
        code: insertError.code,
        message: insertError.message
      });
      return NextResponse.json(
        { error: 'Failed to duplicate post', details: insertError.message },
        { status: 500 }
      );
    }

    logger.info('Post duplicated successfully', { 
      originalPostId: postId, 
      newPostId: newPost.id 
    });

    return NextResponse.json({ 
      success: true, 
      post: newPost,
      message: 'Post duplicated successfully. The duplicate has been added to your unscheduled posts.'
    });
  } catch (error) {
    logger.error('Error duplicating post:', error);
    return NextResponse.json({
      error: 'Failed to duplicate post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
