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
    console.log(`🔍 SIMPLIFIED QUERY - Fetching scheduled posts for project ${projectId}`);
    
    // SIMPLIFIED QUERY - Same structure as unscheduled posts (which works fast)
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .select('*') // Simple: select all columns (like unscheduled)
      .eq('project_id', projectId) // Simple: single WHERE clause (like unscheduled)
      .order('created_at', { ascending: false }); // Simple: single ORDER BY (like unscheduled)
    
    if (error) throw error;
    
    console.log(`✅ Retrieved ${data?.length || 0} scheduled posts`);
    
    return NextResponse.json({ posts: data || [] });
    
  } catch (error) {
    console.error('❌ Error fetching scheduled posts:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('🔧 POST /api/planner/scheduled - DRAG & DROP DEBUG:');
    console.log('  - Request timestamp:', new Date().toISOString());
    console.log('  - Request body keys:', Object.keys(body));
    
    // Validate required fields
    if (!body.scheduledPost) {
      console.error('❌ Missing scheduledPost in request body');
      return NextResponse.json({ error: 'Missing scheduledPost data' }, { status: 400 });
    }
    
    if (!body.unscheduledId) {
      console.error('❌ Missing unscheduledId in request body');
      return NextResponse.json({ error: 'Missing unscheduledId' }, { status: 400 });
    }
    
    console.log('🔧 STEP 1 - VALIDATION PASSED:');
    console.log('  - scheduledPost keys:', Object.keys(body.scheduledPost));
    console.log('  - unscheduledId:', body.unscheduledId);
    console.log('  - scheduledPost.image_url:', body.scheduledPost.image_url ? 'Present' : 'Missing');
    
    // Ensure image_url is included in the scheduled post data
    const scheduledPostData = {
      ...body.scheduledPost,
      image_url: body.scheduledPost.image_url || null // Ensure image_url field is present
    };
    
    console.log('🔧 STEP 2 - PREPARING INSERT DATA:');
    console.log('  - Data keys:', Object.keys(scheduledPostData));
    console.log('  - Data size (chars):', JSON.stringify(scheduledPostData).length);
    
    // Move from unscheduled to scheduled
    console.log('🔧 STEP 3 - INSERTING INTO planner_scheduled_posts:');
    const { data: scheduled, error: scheduleError } = await supabase
      .from('planner_scheduled_posts')
      .insert(scheduledPostData)
      .select()
      .single();
    
    if (scheduleError) {
      console.error('❌ Database insert error:', scheduleError);
      console.error('  - Error code:', scheduleError.code);
      console.error('  - Error message:', scheduleError.message);
      console.error('  - Error details:', scheduleError.details);
      throw scheduleError;
    }
    
    console.log('✅ STEP 4 - SUCCESSFULLY INSERTED:');
    console.log('  - Inserted post ID:', scheduled.id);
    console.log('  - Inserted post keys:', Object.keys(scheduled));
    
    // Delete from unscheduled
    console.log('🔧 STEP 5 - DELETING FROM planner_unscheduled_posts:');
    console.log('  - Deleting unscheduledId:', body.unscheduledId);
    
    const { error: deleteError } = await supabase
      .from('planner_unscheduled_posts')
      .delete()
      .eq('id', body.unscheduledId);
    
    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      console.error('  - Error code:', deleteError.code);
      console.error('  - Error message:', deleteError.message);
      throw deleteError;
    }
    
    console.log('✅ STEP 6 - SUCCESSFULLY DELETED FROM UNSCHEDULED');
    console.log('  - Final response keys:', Object.keys({ success: true, post: scheduled }));
    
    return NextResponse.json({ success: true, post: scheduled });
    
  } catch (error) {
    console.error('❌ POST /api/planner/scheduled - CRITICAL ERROR:');
    console.error('  - Error type:', typeof error);
    console.error('  - Error message:', error instanceof Error ? error.message : String(error));
    console.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    console.error('  - Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      error: 'Failed to schedule post',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { postId, updates } = await request.json();
    
    // Ensure image_url is preserved if not being updated
    const updateData = {
      ...updates,
      // If image_url is not in updates, don't overwrite it
      ...(updates.image_url === undefined && { image_url: undefined })
    };
    
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .update(updateData)
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { postId } = await request.json();
    
    const { error } = await supabase
      .from('planner_scheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
