import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// GET - Fetch all scheduled posts for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from('calendar_scheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: true });
    
    if (error) {
      logger.error('Database error:', error);
      throw error;
    }

    if (data && data.length > 0) {

    }
    return NextResponse.json({ posts: data });
  } catch (error) {
    logger.error('Error fetching scheduled posts:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 });
  }
}

// POST - Create a new scheduled post (move from unscheduled to scheduled)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Ensure image_url is preserved when moving from unscheduled to scheduled
    const scheduledPostData = {
      project_id: projectId,
      calendar_unscheduled_post_id: body.unscheduledPostId,
      post_data: body.postData,
      scheduled_date: body.scheduledDate,
      scheduled_time: body.scheduledTime,
      // Note: week_index and day_index columns don't exist in the actual table schema
      image_url: body.postData?.image_url || null // Extract image_url from postData
    };
    
    // Start a transaction
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from('calendar_scheduled_posts')
      .insert(scheduledPostData)
      .select()
      .single();
    
    if (scheduleError) {
      logger.error('Error scheduling post:', scheduleError);
      throw scheduleError;
    }
    
    // Delete the unscheduled post
    if (body.unscheduledPostId) {
      const { error: deleteError } = await supabase
        .from('calendar_unscheduled_posts')
        .delete()
        .eq('id', body.unscheduledPostId);
      
      if (deleteError) {
        logger.error('Error deleting unscheduled post:', deleteError);
        // Don't throw here, the post was scheduled successfully
      }
    }

    return NextResponse.json({ post: scheduledPost });
  } catch (error) {
    logger.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}

// PATCH - Update scheduled post (e.g., change time)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // First check if the post exists
    const { data: existingPost, error: checkError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, image_url') // Include image_url to preserve it
      .eq('id', body.postId)
      .eq('project_id', projectId)
      .single();
    
    if (checkError) {
      logger.error('Post not found:', checkError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    
    // Update the post while preserving image_url
    const updateData = {
      scheduled_time: body.scheduledTime,
      updated_at: new Date().toISOString(),
      image_url: existingPost.image_url // Preserve the existing image_url
    };
    
    const { data, error } = await supabase
      .from('calendar_scheduled_posts')
      .update(updateData)
      .eq('id', body.postId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logger.error('Error updating scheduled post:', error);
    return NextResponse.json({ error: 'Failed to update scheduled post' }, { status: 500 });
  }
}

// DELETE - Remove scheduled post (move back to unscheduled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const url = new URL(request.url);
    const postId = url.searchParams.get('postId');
    
    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the post data before deleting to preserve image_url
    const { data: postToDelete, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('*')
      .eq('id', postId)
      .eq('project_id', projectId)
      .single();
    
    if (fetchError) {
      logger.error('Error fetching post to delete:', fetchError);
      throw fetchError;
    }
    
    // Delete the scheduled post
    const { error } = await supabase
      .from('calendar_scheduled_posts')
      .delete()
      .eq('id', postId)
      .eq('project_id', projectId);
    
    if (error) {
      logger.error('Database error:', error);
      throw error;
    }
    
    // Move back to unscheduled posts table with image_url preserved
    if (postToDelete) {
      const { error: moveError } = await supabase
        .from('calendar_unscheduled_posts')
        .insert({
          project_id: projectId,
          post_data: postToDelete.post_data,
          image_url: postToDelete.image_url, // Preserve image_url
          status: 'draft'
        });
      
      if (moveError) {
        logger.error('Error moving post back to unscheduled:', moveError);
        // Don't throw here, the post was deleted successfully
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled post' }, { status: 500 });
  }
}
