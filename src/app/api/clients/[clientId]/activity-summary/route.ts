import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of this week (Saturday)

    // Fetch recent uploads (last 7 days)
    const { data: recentUploads, error: uploadsError } = await supabase
      .from('client_uploads')
      .select('id, created_at, file_name')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (uploadsError) {
      logger.error('Error fetching recent uploads:', uploadsError);
    }

    // Fetch recent approvals (last 7 days)
    const { data: recentApprovals, error: approvalsError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, updated_at, caption, approval_status')
      .eq('client_id', clientId)
      .eq('approval_status', 'approved')
      .gte('updated_at', sevenDaysAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (approvalsError) {
      logger.error('Error fetching recent approvals:', approvalsError);
    }

    // Fetch posts scheduled this week
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    const { data: thisWeekPosts, error: weekError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, scheduled_date, scheduled_time, caption, late_status')
      .eq('client_id', clientId)
      .gte('scheduled_date', startOfWeekStr)
      .lte('scheduled_date', endOfWeekStr)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (weekError) {
      logger.error('Error fetching this week posts:', weekError);
    }

    // Find next scheduled post (future posts only)
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

    const { data: futurePosts, error: futureError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, scheduled_date, scheduled_time, caption, late_status, platforms_scheduled')
      .eq('client_id', clientId)
      .not('scheduled_date', 'is', null)
      .or(`scheduled_date.gt.${todayStr},and(scheduled_date.eq.${todayStr},scheduled_time.gte.${currentTime})`)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(1);

    if (futureError) {
      logger.error('Error fetching next post:', futureError);
    }

    const nextPost = futurePosts && Array.isArray(futurePosts) && futurePosts.length > 0 ? futurePosts[0] : null;

    // Fetch recent portal activity (last 7 days)
    const { data: portalActivity, error: activityError } = await supabase
      .from('portal_activity')
      .select('id, activity_type, created_at')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (activityError) {
      logger.error('Error fetching portal activity:', activityError);
    }

    // Count posts pending approval
    const { data: pendingPosts, error: pendingError, count: pendingCount } = await supabase
      .from('calendar_scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('approval_status', ['pending', 'needs_attention']);

    if (pendingError) {
      logger.error('Error fetching pending posts:', pendingError);
    }

    // Calculate summary metrics
    const summary = {
      recentActivity: {
        uploads: recentUploads?.length || 0,
        approvals: recentApprovals?.length || 0,
        portalVisits: portalActivity?.filter((a: any) => a.activity_type === 'portal_access').length || 0,
      },
      upcomingPosts: {
        thisWeek: thisWeekPosts?.length || 0,
        nextPost: nextPost
          ? {
              id: nextPost.id,
              date: nextPost.scheduled_date,
              time: nextPost.scheduled_time,
              caption: nextPost.caption?.substring(0, 100) || 'No caption',
              lateStatus: nextPost.late_status,
              platforms: nextPost.platforms_scheduled || [],
            }
          : null,
        pendingApproval: typeof pendingCount === 'number'
          ? pendingCount
          : (pendingPosts?.length || 0),
      },
      details: {
        recentUploads:
          recentUploads?.slice(0, 5).map((upload: any) => ({
            id: upload.id,
            fileName: upload.file_name,
            createdAt: upload.created_at,
          })) || [],
        recentApprovals:
          recentApprovals?.slice(0, 5).map((post: any) => ({
            id: post.id,
            caption: post.caption?.substring(0, 50) || 'No caption',
            approvedAt: post.updated_at,
          })) || [],
      },
    };

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Activity summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
