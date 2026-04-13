import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Resolve token — supports both legacy client tokens and party tokens
    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    const { clientId, party } = resolved;

    // Get client timezone
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, timezone')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 401 }
      );
    }

    const clientTimezone = client.timezone || 'Pacific/Auckland';

    // Get scheduled posts for the client, including approval steps
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
      .eq('client_id', clientId)
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

    const posts = scheduledPosts ?? [];

    // Batch-fetch approval steps — silently skip if table doesn't exist yet
    let stepsByPostId: Record<string, any[]> = {};
    const postIds = posts.map((p: any) => p.id);

    if (postIds.length > 0) {
      try {
        const { data: allSteps } = await supabase
          .from('post_approval_steps')
          .select(`
            id,
            post_id,
            step_order,
            label,
            status,
            actioned_by,
            actioned_at,
            party:party_id (
              id,
              name,
              role,
              color
            )
          `)
          .in('post_id', postIds)
          .eq('post_type', 'calendar_scheduled')
          .order('step_order', { ascending: true });

        for (const step of allSteps ?? []) {
          if (!stepsByPostId[step.post_id]) stepsByPostId[step.post_id] = [];
          stepsByPostId[step.post_id].push(step);
        }
      } catch {
        logger.debug('post_approval_steps table not available yet, skipping steps fetch');
      }
    }

    // Attach steps to posts and group by date
    const postsByDate = posts.reduce((acc: Record<string, any[]>, post: any) => {
      const date = post.scheduled_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push({
        ...post,
        approval_steps: stepsByPostId[post.id] ?? [],
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Fetch calendar events for this client
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: true });

    const eventsByDate = (calendarEvents ?? []).reduce((acc: Record<string, any[]>, evt: any) => {
      if (!acc[evt.date]) acc[evt.date] = [];
      acc[evt.date].push(evt);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      client: { id: client.id, name: client.name },
      party: party ?? null,
      posts: postsByDate,
      events: eventsByDate,
      totalPosts: posts.length,
      timezone: clientTimezone,
    });

  } catch (error) {
    logger.error('Portal calendar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
