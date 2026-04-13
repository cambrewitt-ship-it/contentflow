import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

// GET /api/posts/[postId]/approval-pipeline
// Returns ordered steps with status + party details.
// Accessible by agency (Bearer token) or portal party (portal_token query param).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');
    const postType = searchParams.get('post_type') ?? 'calendar_scheduled';

    let clientId: string | null = null;

    if (portalToken) {
      // Portal access path
      const resolved = await resolvePortalToken(portalToken);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      }
      clientId = resolved.clientId;
    } else {
      // Agency access path
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      const { supabase, user } = auth;

      // Resolve clientId from post
      const postTable = postType === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
      const { data: post } = await supabase
        .from(postTable)
        .select('client_id')
        .eq('id', postId)
        .maybeSingle();

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      // Verify ownership
      const { data: clientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('id', post.client_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      clientId = post.client_id;
    }

    // Fetch steps with party details
    const { data: steps, error } = await supabaseAdmin
      .from('post_approval_steps')
      .select(`
        id,
        step_order,
        label,
        status,
        actioned_by,
        actioned_at,
        comments,
        created_at,
        updated_at,
        party:party_id (
          id,
          name,
          role,
          color
        )
      `)
      .eq('post_id', postId)
      .eq('post_type', postType)
      .order('step_order', { ascending: true });

    if (error) {
      logger.error('Error fetching approval pipeline:', error);
      return NextResponse.json({ error: 'Failed to fetch pipeline' }, { status: 500 });
    }

    const stepsData = steps ?? [];

    // Derive current active step (first pending step)
    const activeStep = stepsData.find(s => s.status === 'pending') ?? null;

    // Derive overall pipeline status
    let pipelineStatus: 'not_started' | 'in_progress' | 'approved' | 'rejected' | 'changes_requested';
    if (stepsData.length === 0) {
      pipelineStatus = 'not_started';
    } else if (stepsData.every(s => s.status === 'approved')) {
      pipelineStatus = 'approved';
    } else if (stepsData.some(s => s.status === 'rejected')) {
      pipelineStatus = 'rejected';
    } else if (stepsData.some(s => s.status === 'changes_requested')) {
      pipelineStatus = 'changes_requested';
    } else {
      pipelineStatus = 'in_progress';
    }

    return NextResponse.json({
      steps: stepsData,
      activeStep,
      pipelineStatus,
    });
  } catch (error) {
    logger.error('Approval pipeline GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
