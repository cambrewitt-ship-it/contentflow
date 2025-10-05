import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const projectId = searchParams.get('projectId');
  const filterUntagged = searchParams.get('filterUntagged') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');
  const includeImageData = searchParams.get('includeImageData') === 'true';
  
  // Validate clientId
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }
  
  try {
    const startTime = Date.now();
    console.log(`🔍 OPTIMIZED FETCH - Scheduled posts for client ${clientId} (project: ${projectId || 'all'}, untagged: ${filterUntagged}, limit: ${limit}, images: ${includeImageData})`);
    
    // Optimized query - only select fields needed for approval board
    const baseFields = 'id, project_id, caption, scheduled_time, scheduled_date, approval_status, needs_attention, client_feedback, late_status, late_post_id, platforms_scheduled, created_at, updated_at, last_edited_at, edit_count, needs_reapproval, original_caption';
    const selectFields = includeImageData ? `${baseFields}, image_url` : baseFields;
    
    // Build query based on filter type
    let query = supabase
      .from('calendar_scheduled_posts')
      .select(selectFields)
      .eq('client_id', clientId);
    
    // Apply project filter
    if (filterUntagged) {
      query = query.is('project_id', null);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }
    // If neither filterUntagged nor projectId, return all posts for client
    
    const { data, error } = await query
      .order('scheduled_date', { ascending: true })
      .limit(limit);
    
    const queryDuration = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled posts', 
        details: error.message 
      }, { status: 500 });
    }
    
    console.log(`✅ Retrieved ${data?.length || 0} scheduled posts in ${queryDuration}ms`);
    
    // Debug: Log approval status and captions of posts (only first few)
    if (data && data.length > 0) {
      console.log('📊 Approval status and caption debug:');
      data.slice(0, 3).forEach((post: Record<string, any>, index: number) => {
        console.log(`  Post ${post.id?.substring(0, 8)}... - Status: ${post.approval_status || 'NO STATUS'} - Caption: "${post.caption || 'NO CAPTION'}" - Caption Length: ${post.caption?.length || 0}`);
      });
    }
    
    // Fetch client uploads (content from portal)
    const { data: uploadsData, error: uploadsError } = await supabase
      .from('client_uploads')
      .select('id, client_id, project_id, file_name, file_type, file_size, file_url, status, notes, created_at, updated_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (uploadsError) {
      console.error('⚠️ Error fetching client uploads:', uploadsError);
      // Don't fail the whole request, just log the error
    }
    
    console.log(`📤 Retrieved ${uploadsData?.length || 0} client uploads`);
    
    return NextResponse.json({ 
      posts: data || [],
      uploads: uploadsData || [],
      performance: {
        queryDuration,
        optimized: queryDuration < 1000, // Consider optimized if under 1 second
        limit,
        includeImageData
      }
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch scheduled posts', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('🔧 POST /api/calendar/scheduled - DEBUG:');
    console.log('  - Request timestamp:', new Date().toISOString());
    console.log('  - Request body keys:', Object.keys(body));
    
    // Validate required fields
    if (!body.scheduledPost) {
      console.error('❌ Missing scheduledPost in request body');
      return NextResponse.json({ error: 'Missing scheduledPost data' }, { status: 400 });
    }
    
    // unscheduledId is optional - only needed when moving from unscheduled to scheduled
    const isMovingFromUnscheduled = !!body.unscheduledId;
    
    console.log('🔧 STEP 1 - VALIDATION PASSED:');
    console.log('  - scheduledPost keys:', Object.keys(body.scheduledPost));
    console.log('  - unscheduledId:', body.unscheduledId || 'NOT PROVIDED (direct create)');
    console.log('  - scheduledPost.image_url:', body.scheduledPost.image_url ? 'Present' : 'Missing');
    console.log('  - Operation type:', isMovingFromUnscheduled ? 'Move from unscheduled' : 'Direct create');
    
    // Ensure image_url and client_id are included in the scheduled post data
    const scheduledPostData = {
      ...body.scheduledPost,
      image_url: body.scheduledPost.image_url || null, // Ensure image_url field is present
      client_id: body.scheduledPost.client_id // Ensure client_id is preserved
    };
    
    console.log('🔧 STEP 2 - PREPARING INSERT DATA:');
    console.log('  - Data keys:', Object.keys(scheduledPostData));
    console.log('  - Data size (chars):', JSON.stringify(scheduledPostData).length);
    
    // Insert into scheduled posts
    console.log('🔧 STEP 3 - INSERTING INTO calendar_scheduled_posts:');
    const { data: scheduled, error: scheduleError } = await supabase
      .from('calendar_scheduled_posts')
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
    
    // Only delete from unscheduled if we're moving a post
    if (isMovingFromUnscheduled) {
      console.log('🔧 STEP 5 - DELETING FROM calendar_unscheduled_posts:');
      console.log('  - Deleting unscheduledId:', body.unscheduledId);
      
      const { error: deleteError } = await supabase
        .from('calendar_unscheduled_posts')
        .delete()
        .eq('id', body.unscheduledId);
      
      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
        console.error('  - Error code:', deleteError.code);
        console.error('  - Error message:', deleteError.message);
        throw deleteError;
      }
      
      console.log('✅ STEP 6 - SUCCESSFULLY DELETED FROM UNSCHEDULED');
    } else {
      console.log('⏭️ STEP 5 - SKIPPING DELETE (direct create, no unscheduled post to delete)');
    }
    
    console.log('  - Final response keys:', Object.keys({ success: true, post: scheduled }));
    
    return NextResponse.json({ success: true, post: scheduled });
    
  } catch (error) {
    console.error('❌ POST /api/calendar/scheduled - CRITICAL ERROR:');
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
      .from('calendar_scheduled_posts')
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
      .from('calendar_scheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
