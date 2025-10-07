import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch next scheduled post first
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

    const { data: nextPostData, error: nextPostError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, scheduled_date, scheduled_time, caption, image_url, late_status, platforms_scheduled')
      .eq('client_id', clientId)
      .not('scheduled_date', 'is', null)
      .or(`scheduled_date.gt.${todayStr},and(scheduled_date.eq.${todayStr},scheduled_time.gte.${currentTime})`)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(1);

    if (nextPostError) {
      console.error('Error fetching next post:', nextPostError);
    }

    // Fetch all activity data from the last 30 days
    const [
      uploadsResult,
      approvalsResult,
      scheduledPostsResult,
      publishedPostsResult,
      portalActivityResult
    ] = await Promise.all([
      // Client uploads
      supabase
        .from('client_uploads')
        .select('id, created_at, file_name, file_type, status')
        .eq('client_id', clientId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),

      // Post approvals
      supabase
        .from('calendar_scheduled_posts')
        .select('id, updated_at, caption, approval_status, scheduled_date, scheduled_time')
        .eq('client_id', clientId)
        .eq('approval_status', 'approved')
        .gte('updated_at', thirtyDaysAgo.toISOString())
        .order('updated_at', { ascending: false }),

      // New scheduled posts
      supabase
        .from('calendar_scheduled_posts')
        .select('id, created_at, caption, scheduled_date, scheduled_time, platforms_scheduled')
        .eq('client_id', clientId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),

      // Published posts (posts that were actually published)
      supabase
        .from('calendar_scheduled_posts')
        .select('id, scheduled_date, scheduled_time, caption, platforms_scheduled, late_status')
        .eq('client_id', clientId)
        .not('scheduled_date', 'is', null)
        .lte('scheduled_date', now.toISOString().split('T')[0])
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('scheduled_date', { ascending: false }),

      // Portal activity
      supabase
        .from('portal_activity')
        .select('id, created_at, activity_type')
        .eq('client_id', clientId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
    ]);

    // Transform data into activity log format
    const activityLogs = [];

    // Add next scheduled post as activity entry
    const nextPost = nextPostData && nextPostData.length > 0 ? nextPostData[0] : null;
    if (nextPost) {
      activityLogs.push({
        id: `next-post-${nextPost.id}`,
        type: 'next_scheduled',
        title: `Next post scheduled for ${new Date(nextPost.scheduled_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })} at ${nextPost.scheduled_time}`,
        timestamp: new Date().toISOString(), // Current time to show at top
        status: 'scheduled',
        timeAgo: 'Upcoming',
        details: {
          caption: nextPost.caption?.substring(0, 100) || 'No caption',
          image_url: nextPost.image_url,
          platforms: nextPost.platforms_scheduled || [],
          scheduledDate: nextPost.scheduled_date,
          scheduledTime: nextPost.scheduled_time
        }
      });
    } else {
      // Add empty state for next post
      activityLogs.push({
        id: 'next-post-none',
        type: 'next_scheduled',
        title: 'No upcoming posts scheduled',
        timestamp: new Date().toISOString(),
        status: 'none',
        timeAgo: 'No posts',
        details: null
      });
    }

    // Add upload activities
    if (uploadsResult.data) {
      // Group uploads by date to show "Client uploaded X pieces of content"
      const uploadsByDate = uploadsResult.data.reduce((acc, upload) => {
        const date = upload.created_at.split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(upload);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(uploadsByDate).forEach(([date, uploads]) => {
        activityLogs.push({
          id: `upload-${date}`,
          type: 'upload',
          title: `Client uploaded ${uploads.length} piece${uploads.length === 1 ? '' : 's'} of content`,
          timestamp: uploads[0].created_at,
          status: 'upload',
          count: uploads.length,
          details: uploads.map(u => ({
            fileName: u.file_name,
            fileType: u.file_type,
            status: u.status
          }))
        });
      });
    } else {
      // Add empty state for uploads if none in last 30 days
      activityLogs.push({
        id: 'uploads-none',
        type: 'upload',
        title: 'No recent uploads',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        status: 'none',
        timeAgo: 'No uploads',
        details: null
      });
    }

    // Add approval activities
    if (approvalsResult.data) {
      approvalsResult.data.forEach(approval => {
        activityLogs.push({
          id: `approval-${approval.id}`,
          type: 'approval',
          title: 'Client approved content',
          timestamp: approval.updated_at,
          status: 'approved',
          details: {
            caption: approval.caption?.substring(0, 50) || 'No caption',
            scheduledDate: approval.scheduled_date,
            scheduledTime: approval.scheduled_time
          }
        });
      });
    }

    // Add scheduled post activities
    if (scheduledPostsResult.data) {
      scheduledPostsResult.data.forEach(post => {
        activityLogs.push({
          id: `scheduled-${post.id}`,
          type: 'scheduled',
          title: `Post scheduled for ${new Date(post.scheduled_date || post.created_at).toLocaleDateString()}`,
          timestamp: post.created_at,
          status: 'scheduled',
          details: {
            caption: post.caption?.substring(0, 50) || 'No caption',
            scheduledDate: post.scheduled_date,
            scheduledTime: post.scheduled_time,
            platforms: post.platforms_scheduled || []
          }
        });
      });
    }

    // Add published post activities
    if (publishedPostsResult.data) {
      publishedPostsResult.data.forEach(post => {
        const publishDate = new Date(post.scheduled_date);
        const timeAgo = getTimeAgo(publishDate);
        
        activityLogs.push({
          id: `published-${post.id}`,
          type: 'published',
          title: 'Post published',
          timestamp: publishDate.toISOString(),
          status: 'published',
          timeAgo,
          details: {
            caption: post.caption?.substring(0, 50) || 'No caption',
            platforms: post.platforms_scheduled || [],
            lateStatus: post.late_status
          }
        });
      });
    }

    // Add portal visit activities
    if (portalActivityResult.data) {
      const portalVisits = portalActivityResult.data.filter(activity => 
        activity.activity_type === 'portal_access'
      );
      
      portalVisits.forEach(visit => {
        activityLogs.push({
          id: `portal-${visit.id}`,
          type: 'portal_visit',
          title: 'Client accessed portal',
          timestamp: visit.created_at,
          status: 'completed'
        });
      });
    }

    // Sort all activities by timestamp (most recent first)
    activityLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Add time ago to all activities
    activityLogs.forEach(log => {
      if (!log.timeAgo) {
        log.timeAgo = getTimeAgo(new Date(log.timestamp));
      }
    });

    // Limit to last 20 activities for performance
    const recentActivities = activityLogs.slice(0, 20);

    return NextResponse.json({
      success: true,
      activities: recentActivities,
      total: activityLogs.length
    });

  } catch (error) {
    console.error('Activity logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  
  // Handle future dates
  if (diffInMs < 0) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  } else {
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
  }
}
