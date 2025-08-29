import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// GET - Fetch all scheduled posts for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    console.log('🔍 Fetching scheduled posts for project:', projectId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    console.log('🔍 Querying planner_scheduled_posts table with project_id:', projectId);
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: true });
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('🔍 Scheduled posts found:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('🔍 First scheduled post:', data[0]);
    }
    return NextResponse.json({ posts: data });
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
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
    
    console.log('Scheduling post for project:', projectId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Start a transaction
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from('planner_scheduled_posts')
      .insert({
        project_id: projectId,
        planner_unscheduled_post_id: body.unscheduledPostId,
        post_data: body.postData,
        scheduled_date: body.scheduledDate,
        scheduled_time: body.scheduledTime,
        week_index: body.weekIndex,
        day_index: body.dayIndex
      })
      .select()
      .single();
    
    if (scheduleError) {
      console.error('Error scheduling post:', scheduleError);
      throw scheduleError;
    }
    
    // Delete the unscheduled post
    if (body.unscheduledPostId) {
      const { error: deleteError } = await supabase
        .from('planner_unscheduled_posts')
        .delete()
        .eq('id', body.unscheduledPostId);
      
      if (deleteError) {
        console.error('Error deleting unscheduled post:', deleteError);
        // Don't throw here, the post was scheduled successfully
      }
    }
    
    console.log('Scheduled post:', scheduledPost);
    return NextResponse.json({ post: scheduledPost });
  } catch (error) {
    console.error('Error scheduling post:', error);
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
    
    console.log('Updating scheduled post:', body.postId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // First check if the post exists
    const { data: existingPost, error: checkError } = await supabase
      .from('planner_scheduled_posts')
      .select('id')
      .eq('id', body.postId)
      .eq('project_id', projectId)
      .single();
    
    if (checkError) {
      console.error('Post not found:', checkError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    
    // Update the post
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .update({
        scheduled_time: body.scheduledTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.postId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Updated scheduled post:', data);
    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Error updating scheduled post:', error);
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
    
    console.log('Deleting scheduled post:', postId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Delete the scheduled post
    const { error } = await supabase
      .from('planner_scheduled_posts')
      .delete()
      .eq('id', postId)
      .eq('project_id', projectId);
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Scheduled post deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled post' }, { status: 500 });
  }
}
