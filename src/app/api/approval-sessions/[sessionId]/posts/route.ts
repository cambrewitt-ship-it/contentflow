import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
// Temporary inline types to resolve import issue
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const startTime = Date.now();
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const share_token = searchParams.get('token'); // For public access
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeImages = searchParams.get('includeImages') !== 'false';

    logger.debug('Optimized approval fetch', { 
      sessionIdPreview: sessionId?.substring(0, 8) + '...', 
      limit, 
      includeImages 
    });

    // Validate session (either by ID for internal or token for public)
    let sessionQuery;
    
    if (share_token) {
      sessionQuery = supabase
        .from('client_approval_sessions')
        .select('id, project_id, expires_at, created_at')
        .eq('share_token', share_token)
        .single();
    } else {
      sessionQuery = supabase
        .from('client_approval_sessions')
        .select('id, project_id, expires_at, created_at')
        .eq('id', sessionId)
        .single();
    }

    const { data: session, error: sessionError } = await sessionQuery;

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
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

    // First, get the selected post IDs for this session
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

    // OPTIMIZED: Use Promise.all for parallel queries (safe version)
    const [scheduledResult, otherScheduledResult] = await Promise.all([
      // Fetch only selected scheduled posts from calendar_scheduled_posts
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
        .eq('project_id', session.project_id)
        .in('id', selectedPlannerPostIds)
        .order('scheduled_date', { ascending: true }) : { data: [], error: null },
      
      // Fetch only selected posts from scheduled_posts table
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
        .eq('project_id', session.project_id)
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

    // Group posts by week following your date patterns
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
    
    // Group posts by week
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

    // Convert to week data array and sort
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
        optimized: queryDuration < 2000, // Consider optimized if under 2 seconds
        limit,
        includeImages,
        parallelQueries: true
      }
    });
  } catch (error) {
    logger.error('❌ Error in approval posts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
