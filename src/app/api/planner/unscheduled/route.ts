import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  
  // Validate projectId
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  
  try {
    console.log(`🔍 OPTIMIZED QUERY - Fetching unscheduled posts for project ${projectId}`);
    
    // OPTIMIZED QUERY - Same structure as scheduled posts with LIMIT
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .select('*') // Simple: select all columns
      .eq('project_id', projectId) // Simple: single WHERE clause
      .order('created_at', { ascending: false }) // Simple: single ORDER BY
      .limit(20); // CRITICAL: Limit to prevent timeout
    
    if (error) throw error;
    
    console.log(`✅ Retrieved ${data?.length || 0} unscheduled posts`);
    
    return NextResponse.json({ posts: data || [] });
    
  } catch (error: unknown) {
    console.error('❌ Error fetching unscheduled posts:', error);
    
    // Enhanced error handling for timeouts
    if (error && typeof error === 'object' && 'code' in error && error.code === '57014') {
      console.error('❌ Database timeout error detected');
      return NextResponse.json({ 
        error: 'Database query timeout - too many posts to load',
        code: 'TIMEOUT',
        suggestion: 'Try reducing the number of posts or contact support'
      }, { status: 408 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch unscheduled posts',
      details: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Ensure image_url field is included in the post data
    const postData = {
      ...body,
      image_url: body.image_url || null // Ensure image_url field is present
    };
    
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }
    
    console.log(`🗑️ Deleting unscheduled post: ${postId}`);
    
    const { error } = await supabase
      .from('planner_unscheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    console.log(`✅ Successfully deleted unscheduled post: ${postId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting unscheduled post:', error);
    return NextResponse.json({ 
      error: 'Failed to delete post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
