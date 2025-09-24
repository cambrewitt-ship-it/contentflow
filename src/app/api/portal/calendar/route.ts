import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return NextResponse.json(
        { error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

    // Build date filter
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `scheduled_date >= '${startDate}' AND scheduled_date <= '${endDate}'`;
    }

    // Get scheduled posts for the client
    const { data: scheduledPosts, error: scheduledError } = await supabase
      .from('planner_scheduled_posts')
      .select(`
        id,
        caption,
        image_url,
        scheduled_date,
        scheduled_time,
        late_status,
        platforms_scheduled,
        created_at,
        updated_at
      `)
      .eq('client_id', client.id)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (scheduledError) {
      console.error('Error fetching scheduled posts:', scheduledError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled posts' },
        { status: 500 }
      );
    }

    // Get approval status for each post
    const postsWithApprovals = await Promise.all(
      scheduledPosts.map(async (post) => {
        const { data: approval } = await supabase
          .from('post_approvals')
          .select('approval_status, client_comments')
          .eq('post_id', post.id)
          .eq('post_type', 'planner_scheduled')
          .single();

        return {
          ...post,
          approval_status: approval?.approval_status || 'pending',
          client_comments: approval?.client_comments || null
        };
      })
    );

    // Group posts by date
    const postsByDate = postsWithApprovals.reduce((acc, post) => {
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
      totalPosts: postsWithApprovals.length
    });

  } catch (error) {
    console.error('Portal calendar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
