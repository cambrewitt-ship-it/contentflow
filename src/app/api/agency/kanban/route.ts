import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

// GET /api/agency/kanban?client_id=xxx
// Returns calendar_scheduled_posts with their approval steps for the agency kanban view.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;

    // Fetch posts
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('calendar_scheduled_posts')
      .select(`
        id,
        caption,
        image_url,
        scheduled_date,
        approval_status,
        post_type_tag,
        workflow_template_id,
        needs_attention,
        client_id
      `)
      .eq('client_id', client_id)
      .order('scheduled_date', { ascending: true, nullsFirst: false });

    if (postsError) {
      logger.error('Error fetching kanban posts:', postsError);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    const postList = posts ?? [];
    const postIds = postList.map(p => p.id);

    // Batch-fetch all approval steps for these posts
    let stepsByPostId: Record<string, any[]> = {};
    if (postIds.length > 0) {
      const { data: steps } = await supabaseAdmin
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

      for (const step of steps ?? []) {
        if (!stepsByPostId[step.post_id]) stepsByPostId[step.post_id] = [];
        stepsByPostId[step.post_id].push(step);
      }
    }

    const postsWithSteps = postList.map(p => ({
      ...p,
      approval_steps: stepsByPostId[p.id] ?? [],
    }));

    return NextResponse.json({ posts: postsWithSteps });
  } catch (error) {
    logger.error('Agency kanban GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
