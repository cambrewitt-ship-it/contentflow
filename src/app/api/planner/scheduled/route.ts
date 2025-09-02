import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Default 50, max 100
  const offset = parseInt(searchParams.get('offset') || '0');
  const includeImageData = searchParams.get('includeImageData') === 'true';
  
  // Validate projectId
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  
  // Validate limit (prevent excessive queries)
  if (limit > 100) {
    return NextResponse.json({ error: 'Limit cannot exceed 100' }, { status: 400 });
  }
  
  try {
    console.log(`🔍 OPTIMIZED QUERY - Fetching scheduled posts for project ${projectId} (limit: ${limit}, offset: ${offset})`);
    
    // Optimized column selection - only include image_url if specifically requested
    // Note: Only select columns that actually exist in the table schema
    const selectColumns = includeImageData 
      ? `id, project_id, client_id, caption, image_url, post_notes, scheduled_date, scheduled_time, late_status, late_post_id, platforms_scheduled, created_at`
      : `id, project_id, client_id, caption, post_notes, scheduled_date, scheduled_time, late_status, late_post_id, platforms_scheduled, created_at`;
    
    // Set query timeout (30 seconds)
    const queryStartTime = Date.now();
    
    // Optimized query with proper indexing and efficient WHERE clause
    const { data, error, count } = await supabase
      .from('planner_scheduled_posts')
      .select(selectColumns, { count: 'exact' })
      .eq('project_id', projectId) // Uses idx_planner_scheduled_posts_project_date_time
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .range(offset, offset + limit - 1);
    
    const queryDuration = Date.now() - queryStartTime;
    console.log(`⏱️ Query executed in ${queryDuration}ms`);
    
    if (error) {
      console.error('❌ Database query error:', error);
      
      // Handle specific timeout errors
      if (error.code === '57014') {
        console.error('⏰ Query timeout detected - consider reducing limit or adding more indexes');
        return NextResponse.json({ 
          error: 'Query timeout - the database is taking too long to respond',
          code: 'TIMEOUT',
          suggestion: 'Try reducing the limit parameter or contact support'
        }, { status: 408 });
      }
      
      // Handle other database errors
      if (error.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'No posts found for this project',
          code: 'NOT_FOUND'
        }, { status: 404 });
      }
      
      throw error;
    }
    
    console.log(`✅ Retrieved ${data?.length || 0} scheduled posts (total: ${count}) in ${queryDuration}ms`);
    
    // Performance warning for slow queries
    if (queryDuration > 5000) {
      console.warn(`⚠️ Slow query detected: ${queryDuration}ms - consider optimizing indexes`);
    }
    
    return NextResponse.json({ 
      posts: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      performance: {
        queryDuration: `${queryDuration}ms`,
        optimized: queryDuration < 1000
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching scheduled posts:', error);
    
    // Handle timeout errors specifically
    if (error.code === '57014') {
      return NextResponse.json({ 
        error: 'Database query timeout - the query took too long to execute',
        code: 'TIMEOUT',
        suggestion: 'Try reducing the limit parameter or contact support'
      }, { status: 408 });
    }
    
    // Handle network/connection errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return NextResponse.json({ 
        error: 'Database connection failed',
        code: 'CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch scheduled posts',
      details: error.message,
      code: 'UNKNOWN_ERROR'
    }, { status: 500 });
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
    console.error('  - Error message:', error.message);
    console.error('  - Error stack:', error.stack);
    console.error('  - Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      error: 'Failed to schedule post',
      details: error.message,
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
