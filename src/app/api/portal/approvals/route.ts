import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

// Get posts awaiting approval for a client via portal token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    logger.debug('Portal approvals request', { tokenPreview: token?.substring(0, 8) + '...' });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Portal token is required' },
        { status: 400 }
      );
    }

    // Validate portal token and get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    if (!client.portal_enabled) {
      return NextResponse.json(
        { success: false, error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

    // Get all projects for this client
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('client_id', client.id);

    if (projectsError) {
      logger.error('❌ Error fetching projects:', projectsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        success: true,
        client: { id: client.id, name: client.name },
        projects: [],
        weeks: [],
      });
    }

    const projectIds = projects.map(p => p.id);

    // Get posts from both scheduled tables for all client projects
    const [scheduledPosts, plannerScheduledPosts] = await Promise.all([
      supabase
        .from('scheduled_posts')
        .select(`
          id,
          caption,
          image_url,
          scheduled_time,
          approval_status,
          needs_attention,
          client_feedback,
          created_at,
          project_id
        `)
        .in('project_id', projectIds)
        .order('scheduled_time', { ascending: true }),

      supabase
        .from('calendar_scheduled_posts')
        .select(`
          id,
          caption,
          image_url,
          scheduled_date,
          scheduled_time,
          approval_status,
          needs_attention,
          client_feedback,
          created_at,
          project_id
        `)
        .in('project_id', projectIds)
        .order('scheduled_date', { ascending: true }),
    ]);

    if (scheduledPosts.error) {
      logger.error('❌ Error fetching scheduled posts:', scheduledPosts.error);
    }

    if (plannerScheduledPosts.error) {
      logger.error('❌ Error fetching planner scheduled posts:', plannerScheduledPosts.error);
    }

    // Combine and format posts
    const allPosts = [
      ...(scheduledPosts.data || []).map(post => ({
        ...post,
        post_type: 'scheduled' as const
      })),
      ...(plannerScheduledPosts.data || []).map(post => ({
        ...post,
        post_type: 'planner_scheduled' as const
      })),
    ];

    // Group posts by week
    const weeks = groupPostsByWeek(allPosts);

    return NextResponse.json({
      success: true,
      client: { id: client.id, name: client.name },
      projects: projects,
      weeks: weeks,
    });

  } catch (error) {
    logger.error('❌ Portal approvals error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Submit approval decisions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      post_id,
      post_type,
      approval_status,
      client_comments,
      edited_caption
    } = body;

    logger.debug('Portal approval submission', {
      tokenPreview: token?.substring(0, 8) + '...',
      postIdPreview: post_id?.substring(0, 8) + '...',
      postType: post_type,
      approvalStatus: approval_status,
      hasComments: !!client_comments,
      hasEditedCaption: !!edited_caption,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Portal token is required' },
        { status: 400 }
      );
    }

    // Validate portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    if (!client.portal_enabled) {
      return NextResponse.json(
        { success: false, error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

    // Validate approval_status
    const validStatuses = ['approved', 'rejected', 'needs_attention'];
    if (!validStatuses.includes(approval_status)) {
      return NextResponse.json(
        { success: false, error: `Invalid approval status: ${approval_status}` },
        { status: 400 }
      );
    }

    if (!post_id || !post_type || !approval_status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update post caption if client edited it
    if (edited_caption && edited_caption.trim() !== '') {
      const tableName = post_type === 'planner_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';

      const { error: captionUpdateError } = await supabase
        .from(tableName)
        .update({
          caption: edited_caption,
          updated_at: new Date().toISOString()
        })
        .eq('id', post_id);

      if (captionUpdateError) {
        logger.error('❌ Error updating caption:', captionUpdateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update caption' },
          { status: 500 }
        );
      }
    }

    // Update the post status
    const tableName = post_type === 'planner_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';

    const statusUpdate: any = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === 'needs_attention') {
      statusUpdate.needs_attention = true;
      statusUpdate.client_feedback = client_comments;
    } else {
      statusUpdate.needs_attention = false;
      statusUpdate.client_feedback = client_comments || null;
    }

    const { error: statusUpdateError } = await supabase
      .from(tableName)
      .update(statusUpdate)
      .eq('id', post_id);

    if (statusUpdateError) {
      logger.error('❌ Error updating post status:', statusUpdateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update post status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Approval submitted successfully',
    });

  } catch (error) {
    logger.error('❌ Portal approval submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to group posts by week
function groupPostsByWeek(posts: any[]): any[] {
  const weeksMap = new Map<string, any[]>();

  // Get current week start (Sunday)
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
  currentWeekStart.setHours(0, 0, 0, 0); // Reset time to start of day

  logger.debug('Current week start', { weekStart: currentWeekStart.toISOString().split('T')[0] });

  posts.forEach(post => {
    // Handle different column names: scheduled_posts uses 'scheduled_time', calendar_scheduled_posts uses 'scheduled_date'
    const scheduledDate = post.scheduled_date || post.scheduled_time;
    const date = new Date(scheduledDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0); // Reset time to start of day

    // Skip posts from weeks older than current week
    if (weekStart < currentWeekStart) {
      logger.debug('Skipping expired post', {
        weekStart: weekStart.toISOString().split('T')[0],
        postId: post.id?.substring(0, 8) + '...'
      });
      return;
    }

    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeksMap.has(weekKey)) {
      weeksMap.set(weekKey, []);
    }

    // Normalize the post data to use 'scheduled_date' for consistency
    const normalizedPost = {
      ...post,
      scheduled_date: scheduledDate,
    };

    weeksMap.get(weekKey)!.push(normalizedPost);
  });

  // Convert to array and sort by week start date
  const weeks = Array.from(weeksMap.entries())
    .map(([weekKey, posts]) => {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return {
        weekStart,
        weekLabel: `W/C ${weekStart.getDate()} ${weekStart.toLocaleDateString('en-GB', { month: 'short' })}`,
        posts: posts.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      };
    })
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  logger.debug('Weeks filtered', { totalWeeks: weeks.length });
  return weeks;
}