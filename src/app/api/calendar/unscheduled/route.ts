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
  
  // Validate clientId
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }
  
  try {
    logger.debug('Fetching unscheduled posts', { 
      clientIdPreview: clientId?.substring(0, 8) + '...', 
      project: projectId || 'all', 
      untagged: filterUntagged 
    });

    // Build query based on filter type
    let query = supabase
      .from('calendar_unscheduled_posts')
      .select('*') // Simple: select all columns
      .eq('client_id', clientId); // Filter by client
    
    // Apply project filter
    if (filterUntagged) {
      query = query.is('project_id', null);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }
    // If neither filterUntagged nor projectId, return all posts for client
    
    const { data, error } = await query
      .order('created_at', { ascending: false }) // Simple: single ORDER BY
      .limit(20); // CRITICAL: Limit to prevent timeout
    
    if (error) throw error;

    // Debug logging for captions
    if (data && data.length > 0) {
      data.forEach((post, index) => {
        // Debug logging can be added here if needed
      });
    }
    
    return NextResponse.json({ posts: data || [] });
    
  } catch (error: unknown) {
    logger.error('❌ Error fetching unscheduled posts:', error);
    
    // Enhanced error handling for timeouts
    if (error && typeof error === 'object' && 'code' in error && error.code === '57014') {
      logger.error('❌ Database timeout error detected');
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
      .from('calendar_unscheduled_posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    logger.error('Error:', error);
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

    const { error } = await supabase
      .from('calendar_unscheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('❌ Error deleting unscheduled post:', error);
    return NextResponse.json({ 
      error: 'Failed to delete post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
