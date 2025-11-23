import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

interface ApprovalBoardPost {
  id: string;
  caption: string;
  image_url: string;
  scheduled_time: string;
  scheduled_date: string;
  post_type: 'scheduled' | 'planner_scheduled';
  project_id?: string;
  client_id?: string;
  approval?: {
    post_id: string;
    post_type: string;
    approval_status: string;
    client_comments?: string;
    created_at: string;
  };
}

interface WeekData {
  weekStart: Date;
  weekLabel: string;
  posts: ApprovalBoardPost[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Public route - get posts by share token (no auth required)
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const share_token = searchParams.get('token');

    if (!share_token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    logger.debug('Fetching approval posts by token', { 
      tokenPreview: share_token.substring(0, 8) + '...'
    });

    // Get session by token
    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .select('id, project_id, client_id, expires_at, created_at')
      .eq('share_token', share_token)
      .single();

    if (sessionError || !session) {
      logger.error('❌ Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Session not found or invalid token' },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    // Get post approvals for this session
    const { data: postApprovals, error: approvalsError } = await supabase
      .from('post_approvals')
      .select('post_id, post_type, approval_status, client_comments, created_at')
      .eq('session_id', session.id);

    if (approvalsError) {
      logger.error('❌ Error fetching post approvals:', approvalsError);
      return NextResponse.json(
        { error: 'Failed to fetch post approvals' },
        { status: 500 }
      );
    }

    // Extract selected post IDs by type
    const selectedPlannerPostIds = postApprovals
      ?.filter(approval => approval.post_type === 'planner_scheduled')
      ?.map(approval => approval.post_id) || [];
    
    const selectedScheduledPostIds = postApprovals
      ?.filter(approval => approval.post_type === 'scheduled')
      ?.map(approval => approval.post_id) || [];

    // Fetch posts by their IDs (already validated in post_approvals table)
    // No need to filter by project_id - we trust the post_approvals table links
    const [scheduledResult, otherScheduledResult] = await Promise.all([
      selectedPlannerPostIds.length > 0 ? supabase
        .from('calendar_scheduled_posts')
        .select(`
          id,
          caption,
          image_url,
          scheduled_time,
          scheduled_date,
          project_id,
          client_id
        `)
        .eq('client_id', session.client_id)
        .in('id', selectedPlannerPostIds)
        .order('scheduled_date', { ascending: true }) : { data: [], error: null },
      
      selectedScheduledPostIds.length > 0 ? supabase
        .from('scheduled_posts')
        .select(`
          id,
          caption,
          image_url,
          scheduled_time,
          project_id,
          client_id
        `)
        .eq('client_id', session.client_id)
        .in('id', selectedScheduledPostIds)
        .order('scheduled_time', { ascending: true }) : { data: [], error: null }
    ]);

    const { data: scheduledPosts, error: scheduledError } = scheduledResult;
    const { data: otherScheduledPosts, error: otherScheduledError } = otherScheduledResult;
    const approvals = postApprovals;

    if (scheduledError) {
      logger.error('❌ Error fetching scheduled posts:', scheduledError);
    }
    if (otherScheduledError) {
      logger.error('❌ Error fetching other scheduled posts:', otherScheduledError);
    }

    // Combine and format posts
    const allPosts: ApprovalBoardPost[] = [
      ...(scheduledPosts || []).map(post => ({
        ...post,
        post_type: 'planner_scheduled' as const,
        scheduled_date: post.scheduled_date || '',
        approval: approvals?.find(a => a.post_id === post.id && a.post_type === 'planner_scheduled')
      })),
      ...(otherScheduledPosts || []).map(post => ({
        ...post,
        post_type: 'scheduled' as const,
        scheduled_date: post.scheduled_time?.split('T')[0] || '',
        approval: approvals?.find(a => a.post_id === post.id && a.post_type === 'scheduled')
      }))
    ];

    // Group posts by week
    const getStartOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    
    const formatWeekLabel = (date: Date) => {
      const options: Intl.DateTimeFormatOptions = { 
        day: 'numeric', 
        month: 'long'
      };
      
      return `W/C ${date.toLocaleDateString('en-GB', options)}`;
    };
    
    const weekMap = new Map<string, ApprovalBoardPost[]>();
    
    allPosts.forEach(post => {
      if (post.scheduled_date) {
        const postDate = new Date(post.scheduled_date);
        const weekStart = getStartOfWeek(postDate);
        const weekKey = weekStart.toISOString();
        
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, []);
        }
        weekMap.get(weekKey)!.push(post);
      }
    });

    const weeks: WeekData[] = Array.from(weekMap.entries())
      .map(([weekKey, posts]) => {
        const weekStart = new Date(weekKey);
        return {
          weekStart,
          weekLabel: formatWeekLabel(weekStart),
          posts: posts.sort((a, b) => 
            new Date(a.scheduled_date + ' ' + (a.scheduled_time || '00:00')).getTime() - 
            new Date(b.scheduled_date + ' ' + (b.scheduled_time || '00:00')).getTime()
          )
        };
      })
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

    const queryDuration = Date.now() - startTime;

    return NextResponse.json({
      session,
      weeks,
      total_posts: allPosts.length,
      performance: {
        queryDuration,
        optimized: queryDuration < 2000
      }
    });
  } catch (error) {
    logger.error('❌ Error in approval posts by token API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

