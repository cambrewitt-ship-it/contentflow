import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get client info from portal token (including timezone for calendar display)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, timezone')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }
    
    // Use client's timezone or default to Pacific/Auckland
    const clientTimezone = client.timezone || 'Pacific/Auckland';

    // Build date filter (currently unused in query)
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `scheduled_date >= '${startDate}' AND scheduled_date <= '${endDate}'`;
    }

    // Get scheduled posts for the client
    const { data: scheduledPosts, error: scheduledError } = await supabase
      .from('calendar_scheduled_posts')
      .select(`
        id,
        caption,
        image_url,
        scheduled_date,
        scheduled_time,
        late_status,
        platforms_scheduled,
        approval_status,
        needs_attention,
        client_feedback,
        created_at,
        updated_at
      `)
      .eq('client_id', client.id)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (scheduledError) {
      logger.error('Error fetching scheduled posts:', scheduledError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled posts' },
        { status: 500 }
      );
    }

    // Debug: Log approval status of posts
    if (scheduledPosts && scheduledPosts.length > 0) {
      scheduledPosts.slice(0, 3).forEach((post: any, index: number) => {
        logger.debug('Post preview', { 
          postId: post.id?.substring(0, 8) + '...', 
          status: post.approval_status || 'NO STATUS', 
          captionLength: post.caption?.length || 0
        });
      });
    }

    // Group posts by date
    const postsByDate = scheduledPosts.reduce((acc: Record<string, any[]>, post: any) => {
      const date = post.scheduled_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(post);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      client,
      posts: postsByDate,
      totalPosts: scheduledPosts.length,
      timezone: clientTimezone
    });

  } catch (error) {
    logger.error('Portal calendar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
