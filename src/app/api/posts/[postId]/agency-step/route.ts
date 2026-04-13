import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const AgencyStepSchema = z.object({
  step_id: z.string().uuid(),
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
  action: z.enum(['approved', 'changes_requested']),
  actioned_by: z.string().min(1).max(200).default('Agency'),
  comments: z.string().max(2000).optional().nullable(),
});

// POST /api/posts/[postId]/agency-step
// Agency user marks their own step (no party_id) as done from the dashboard.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const parsed = AgencyStepSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { step_id, post_type, action, actioned_by, comments } = parsed.data;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Verify post ownership
    const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: post } = await supabaseAdmin
      .from(postTable)
      .select('client_id')
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

    // Verify the step exists, belongs to this post, and has no party (agency step)
    const { data: step } = await supabaseAdmin
      .from('post_approval_steps')
      .select('id, step_order, party_id, status')
      .eq('id', step_id)
      .eq('post_id', postId)
      .eq('post_type', post_type)
      .maybeSingle();

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    if (step.party_id) {
      return NextResponse.json(
        { error: 'This step belongs to a portal party, not the agency' },
        { status: 403 }
      );
    }

    if (step.status !== 'pending') {
      return NextResponse.json(
        { error: `Step is already ${step.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from('post_approval_steps')
      .update({
        status: action,
        actioned_by,
        actioned_at: now,
        comments: comments ?? null,
        updated_at: now,
      })
      .eq('id', step_id);

    // Check if all steps are done and mirror to post
    const { data: allSteps } = await supabaseAdmin
      .from('post_approval_steps')
      .select('status')
      .eq('post_id', postId)
      .eq('post_type', post_type);

    const updatedSteps = (allSteps ?? []).map(s =>
      s === step ? { ...s, status: action } : s
    );
    const allApproved = updatedSteps.every(s => s.status === 'approved');
    const anyChanges = updatedSteps.some(s => s.status === 'changes_requested');

    if (allApproved || anyChanges) {
      await supabaseAdmin
        .from(postTable)
        .update({
          approval_status: allApproved ? 'approved' : 'needs_attention',
          updated_at: now,
        })
        .eq('id', postId);
    }

    // Notify the next pending step's party (fire-and-forget)
    if (action === 'approved') {
      const { data: remainingSteps } = await supabaseAdmin
        .from('post_approval_steps')
        .select('id, step_order, party_id, label, status')
        .eq('post_id', postId)
        .eq('post_type', post_type)
        .order('step_order', { ascending: true });

      const nextStep = (remainingSteps ?? []).find(s => s.status === 'pending' && s.party_id);

      if (nextStep?.party_id) {
        const { data: clientRecord } = await supabaseAdmin
          .from('clients')
          .select('name')
          .eq('id', post.client_id)
          .maybeSingle();

        fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            post_type,
            event: 'step_completed',
            target_party_id: nextStep.party_id,
            client_name: clientRecord?.name ?? 'Your Client',
            step_label: nextStep.label ?? null,
          }),
        }).catch(err => logger.error('Failed to fire notification:', err));
      }
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    logger.error('Agency step action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
