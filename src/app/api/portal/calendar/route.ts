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

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    const { clientId, party } = resolved;

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build posts query with optional date range
    let postsQuery = supabase
      .from('calendar_scheduled_posts')
      .select(`
        id,
        caption,
        image_url,
        post_notes,
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

    if (startDate) postsQuery = postsQuery.gte('scheduled_date', startDate);
    if (endDate) postsQuery = postsQuery.lte('scheduled_date', endDate);

    // Build events query with same date range
    let eventsQuery = supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: true });

    if (startDate) eventsQuery = eventsQuery.gte('date', startDate);
    if (endDate) eventsQuery = eventsQuery.lte('date', endDate);

    // Fetch client, posts and events in parallel
    const [
      { data: client, error: clientError },
      { data: scheduledPosts, error: scheduledError },
      { data: calendarEvents },
    ] = await Promise.all([
      supabase.from('clients').select('id, name, timezone, logo_url').eq('id', clientId).single(),
      postsQuery,
      eventsQuery,
    ]);

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 401 }
      );
    }

    if (scheduledError) {
      logger.error('Error fetching scheduled posts:', scheduledError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled posts' },
        { status: 500 }
      );
    }

    const posts = scheduledPosts ?? [];
    const postIds = posts.map((p: any) => p.id);

    // Batch-fetch approval steps and tags in parallel
    let stepsByPostId: Record<string, any[]> = {};
    let tagsByPostId: Record<string, any[]> = {};

    if (postIds.length > 0) {
      const [stepsResult, tagsResult] = await Promise.allSettled([
        supabase
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
          .order('step_order', { ascending: true }),
        supabase
          .from('post_tags')
          .select('post_id, tags(id, name, color)')
          .in('post_id', postIds),
      ]);

      if (stepsResult.status === 'fulfilled' && !stepsResult.value.error) {
        for (const step of stepsResult.value.data ?? []) {
          if (!stepsByPostId[step.post_id]) stepsByPostId[step.post_id] = [];
          stepsByPostId[step.post_id].push(step);
        }
      } else if (stepsResult.status === 'rejected') {
        logger.debug('post_approval_steps table not available yet, skipping steps fetch');
      }

      if (tagsResult.status === 'fulfilled' && !tagsResult.value.error) {
        for (const pt of tagsResult.value.data ?? []) {
          if (!tagsByPostId[pt.post_id]) tagsByPostId[pt.post_id] = [];
          const tag = (pt as any).tags;
          if (tag) tagsByPostId[pt.post_id].push({ id: tag.id, name: tag.name, color: tag.color });
        }
      } else if (tagsResult.status === 'rejected') {
        logger.debug('post_tags table not available yet, skipping tags fetch');
      }
    }

    const postsByDate = posts.reduce((acc: Record<string, any[]>, post: any) => {
      const date = post.scheduled_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push({
        ...post,
        approval_steps: stepsByPostId[post.id] ?? [],
        tags: tagsByPostId[post.id] ?? [],
      });
      return acc;
    }, {} as Record<string, any[]>);

    const eventsByDate = (calendarEvents ?? []).reduce((acc: Record<string, any[]>, evt: any) => {
      if (!acc[evt.date]) acc[evt.date] = [];
      acc[evt.date].push(evt);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      client: { id: client.id, name: client.name, logo_url: client.logo_url ?? null },
      party: party ?? null,
      posts: postsByDate,
      events: eventsByDate,
      totalPosts: posts.length,
      timezone: client.timezone || 'Pacific/Auckland',
    });

  } catch (error) {
    logger.error('Portal calendar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, postId, scheduled_date } = body;

    if (!token || !postId || !scheduled_date) {
      return NextResponse.json(
        { error: 'token, postId, and scheduled_date are required' },
        { status: 400 }
      );
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    const { clientId } = resolved;

    // Verify the post belongs to this client
    const { data: existing, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id')
      .eq('id', postId)
      .eq('client_id', clientId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('calendar_scheduled_posts')
      .update({ scheduled_date })
      .eq('id', postId);

    if (updateError) {
      logger.error('Error updating post date:', updateError);
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Portal calendar PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
