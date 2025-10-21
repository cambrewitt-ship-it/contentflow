import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

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
    logger.debug('Fetching scheduled posts', { 
      clientId: clientId?.substring(0, 8) + '...', 
      project: projectId || 'all', 
      untagged: filterUntagged, 
      limit, 
      includeImages: includeImageData 
    });
    
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
      logger.error('❌ Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled posts', 
        details: error.message 
      }, { status: 500 });
    }

    // Debug: Log approval status and captions of posts (only first few)
    if (data && data.length > 0) {

      data.slice(0, 3).forEach((post: Record<string, any>, index: number) => {
        logger.debug('Post preview', { 
          postId: post.id?.substring(0, 8) + '...', 
          status: post.approval_status || 'NO STATUS', 
          captionLength: post.caption?.length || 0 
        });
      });
    }
    
    // Fetch client uploads (content from portal)
    const { data: uploadsData, error: uploadsError } = await supabase
      .from('client_uploads')
      .select('id, client_id, project_id, file_name, file_type, file_size, file_url, status, notes, created_at, updated_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (uploadsError) {
      logger.error('⚠️ Error fetching client uploads:', uploadsError);
      // Don't fail the whole request, just log the error
    }

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
    logger.error('❌ Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch scheduled posts', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    logger.debug('Creating scheduled post', { 
      timestamp: new Date().toISOString(),
      bodyKeys: Object.keys(body) 
    });
    
    // Validate required fields
    if (!body.scheduledPost) {
      logger.error('❌ Missing scheduledPost in request body');
      return NextResponse.json({ error: 'Missing scheduledPost data' }, { status: 400 });
    }
    
    // unscheduledId is optional - only needed when moving from unscheduled to scheduled
    const isMovingFromUnscheduled = !!body.unscheduledId;

    logger.debug('Post details', { 
      scheduledPostKeys: Object.keys(body.scheduledPost),
      operationType: isMovingFromUnscheduled ? 'move' : 'create' 
    });

    // Ensure image_url and client_id are included in the scheduled post data
    const scheduledPostData = {
      ...body.scheduledPost,
      image_url: body.scheduledPost.image_url || null, // Ensure image_url field is present
      client_id: body.scheduledPost.client_id // Ensure client_id is preserved
    };

    logger.debug('Preparing insert data', { 
      dataKeys: Object.keys(scheduledPostData),
      dataSize: JSON.stringify(scheduledPostData).length 
    });
    
    // Insert into scheduled posts

    const { data: scheduled, error: scheduleError } = await supabase
      .from('calendar_scheduled_posts')
      .insert(scheduledPostData)
      .select()
      .single();
    
    if (scheduleError) {
      logger.error('❌ Database insert error:', scheduleError);
      logger.error('  - Error code:', scheduleError.code);
      logger.error('  - Error message:', scheduleError.message);
      logger.error('  - Error details:', scheduleError.details);
      throw scheduleError;
    }

    logger.debug('Post inserted successfully', { 
      postId: scheduled.id?.substring(0, 8) + '...',
      hasImage: !!scheduled.image_url 
    });
    
    // Only delete from unscheduled if we're moving a post
    if (isMovingFromUnscheduled) {

      const { error: deleteError } = await supabase
        .from('calendar_unscheduled_posts')
        .delete()
        .eq('id', body.unscheduledId);
      
      if (deleteError) {
        logger.error('❌ Delete error:', deleteError);
        logger.error('  - Error code:', deleteError.code);
        logger.error('  - Error message:', deleteError.message);
        throw deleteError;
      }

    } else {
      logger.debug('Skipping unscheduled delete - direct create operation');
    }
    
    logger.debug('Scheduled post created', { success: true });
    
    return NextResponse.json({ success: true, post: scheduled });
    
  } catch (error) {
    logger.error('❌ POST /api/calendar/scheduled - CRITICAL ERROR:');
    logger.error('  - Error type:', typeof error);
    logger.error('  - Error message:', error instanceof Error ? error.message : String(error));
    logger.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    logger.error('  - Full error object:', JSON.stringify(error, null, 2));
    
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
    logger.error('PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { postId, scheduledDate, clientId } = await request.json();
    
    if (!postId || !scheduledDate || !clientId) {
      return NextResponse.json({ 
        error: 'Missing required fields: postId, scheduledDate, clientId' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calendar_scheduled_posts')
      .update({ 
        scheduled_date: scheduledDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .eq('client_id', clientId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating post date:', error);
      throw error;
    }

    return NextResponse.json({ success: true, post: data });
    
  } catch (error) {
    logger.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Failed to update post date',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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
    logger.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
