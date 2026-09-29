import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const StatusSchema = z.object({
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
  approval_status: z.enum(['pending', 'approved', 'needs_attention', 'rejected']),
});

// PATCH /api/posts/[postId]/approval-status
// Agency sets or clears ("pending") a post's approval status from the post modal.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = StatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { post_type, approval_status } = parsed.data;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';

    const { data: post } = await supabaseAdmin
      .from(postTable)
      .select('id, client_id, approval_status, client_feedback')
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { data: clientCheck } = await supabase
      .from('clients')
      .select('id')
      .eq('id', post.client_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const isClearing = approval_status === 'pending';

    const { error: updateError } = await supabaseAdmin
      .from(postTable)
      .update({
        approval_status,
        needs_attention: approval_status === 'needs_attention',
        // Clearing wipes the client's feedback along with the status.
        ...(isClearing ? { client_feedback: null } : {}),
        updated_at: now,
      })
      .eq('id', postId);

    if (updateError) {
      logger.error('Failed to update approval status:', updateError);
      return NextResponse.json({ error: 'Failed to update approval status' }, { status: 500 });
    }

    // Clearing also resets any actioned pipeline steps so the post goes back through review.
    if (isClearing) {
      await supabaseAdmin
        .from('post_approval_steps')
        .update({ status: 'pending', actioned_by: null, actioned_at: null, comments: null, updated_at: now })
        .eq('post_id', postId)
        .eq('post_type', post_type)
        .neq('status', 'pending');
    }

    // History row (fire-and-forget)
    supabaseAdmin
      .from('post_approval_history')
      .insert({
        post_id: postId,
        changed_by: 'agency',
        previous_approval_status: post.approval_status ?? null,
        new_approval_status: approval_status,
        previous_client_feedback: post.client_feedback ?? null,
        new_client_feedback: isClearing ? null : post.client_feedback ?? null,
        metadata: { action: isClearing ? 'clear_status' : 'set_status', post_type },
      })
      .then(({ error }) => {
        if (error) logger.warn('Failed to write approval history', error);
      });

    return NextResponse.json({ success: true, approval_status });
  } catch (error) {
    logger.error('Approval status update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
