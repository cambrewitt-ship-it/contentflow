import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const ResubmitSchema = z.object({
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
});

// POST /api/posts/[postId]/resubmit
// Agency clears a "needs_attention" / "changes_requested" status and sends the post
// back into review — used after the agency edits a post in response to feedback.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ResubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { post_type } = parsed.data;

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
      .select('id, name')
      .eq('id', post.client_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from(postTable)
      .update({
        approval_status: 'pending',
        needs_attention: false,
        client_feedback: null,
        updated_at: now,
      })
      .eq('id', postId);

    if (updateError) {
      logger.error('Failed to reset approval status:', updateError);
      return NextResponse.json({ error: 'Failed to reset approval status' }, { status: 500 });
    }

    // Reset any blocked pipeline step(s) back to pending so the same party is asked to re-review.
    const { data: blockedSteps } = await supabaseAdmin
      .from('post_approval_steps')
      .select('id, step_order, party_id, label')
      .eq('post_id', postId)
      .eq('post_type', post_type)
      .in('status', ['changes_requested', 'rejected'])
      .order('step_order', { ascending: true });

    if (blockedSteps && blockedSteps.length > 0) {
      await supabaseAdmin
        .from('post_approval_steps')
        .update({
          status: 'pending',
          actioned_by: null,
          actioned_at: null,
          comments: null,
          updated_at: now,
        })
        .in('id', blockedSteps.map(s => s.id));

      // Notify the party on the first reset step (fire-and-forget)
      const firstBlocked = blockedSteps[0];
      if (firstBlocked.party_id) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            post_type,
            event: 'step_completed',
            target_party_id: firstBlocked.party_id,
            client_name: clientCheck.name ?? 'Your Client',
            step_label: firstBlocked.label ?? null,
          }),
        }).catch(err => logger.error('Failed to fire resubmit notification:', err));
      }
    }

    // History row (fire-and-forget)
    supabaseAdmin
      .from('post_approval_history')
      .insert({
        post_id: postId,
        changed_by: 'agency',
        previous_approval_status: post.approval_status ?? null,
        new_approval_status: 'pending',
        previous_client_feedback: post.client_feedback ?? null,
        new_client_feedback: null,
        metadata: { action: 'resubmit', post_type },
      })
      .then(({ error }) => {
        if (error) logger.warn('Failed to write approval history', error);
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Resubmit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
