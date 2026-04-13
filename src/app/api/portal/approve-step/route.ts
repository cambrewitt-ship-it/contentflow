import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const ApproveStepSchema = z.object({
  portal_token: z.string().uuid(),
  post_id: z.string().uuid(),
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
  action: z.enum(['approved', 'rejected', 'changes_requested']),
  actioned_by: z.string().min(1).max(200),
  comments: z.string().max(2000).optional().nullable(),
});

// POST /api/portal/approve-step
// A portal party approves/rejects/requests changes on their step.
// Validates:
//   1. Token resolves to a known portal party
//   2. There is an active (pending) step for this post
//   3. The active step is assigned to this party
//   4. All prior steps are approved
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ApproveStepSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { portal_token, post_id, post_type, action, actioned_by, comments } = parsed.data;

    // Resolve portal token — must be a party token (not a legacy client token)
    const resolved = await resolvePortalToken(portal_token);
    if (!resolved || !resolved.party) {
      return NextResponse.json(
        { error: 'Invalid portal token or not a party token' },
        { status: 401 }
      );
    }

    const { clientId, party } = resolved;

    // Verify the post belongs to this client
    const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: post } = await supabase
      .from(postTable)
      .select('id, client_id')
      .eq('id', post_id)
      .maybeSingle();

    if (!post || post.client_id !== clientId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch all steps for this post in order
    const { data: steps, error: stepsError } = await supabase
      .from('post_approval_steps')
      .select('id, step_order, party_id, status')
      .eq('post_id', post_id)
      .eq('post_type', post_type)
      .order('step_order', { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return NextResponse.json(
        { error: 'No approval pipeline found for this post' },
        { status: 400 }
      );
    }

    // Find the active step: first pending step
    const activeStep = steps.find(s => s.status === 'pending');
    if (!activeStep) {
      return NextResponse.json(
        { error: 'No pending steps — pipeline is already complete' },
        { status: 400 }
      );
    }

    // Ensure the active step is assigned to this party
    if (activeStep.party_id !== party.id) {
      logger.warn('Party attempted to action a step that is not theirs', {
        partyId: party.id.substring(0, 8) + '...',
        stepPartyId: activeStep.party_id?.substring(0, 8) + '...',
      });
      return NextResponse.json(
        { error: 'It is not your turn to action this post' },
        { status: 403 }
      );
    }

    // Verify all prior steps are approved
    const priorSteps = steps.filter(s => s.step_order < activeStep.step_order);
    const allPriorApproved = priorSteps.every(s => s.status === 'approved');
    if (!allPriorApproved) {
      return NextResponse.json(
        { error: 'Previous steps must be approved before actioning this step' },
        { status: 400 }
      );
    }

    // Update the step
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('post_approval_steps')
      .update({
        status: action,
        actioned_by,
        actioned_at: now,
        comments: comments ?? null,
        updated_at: now,
      })
      .eq('id', activeStep.id);

    if (updateError) {
      logger.error('Error updating approval step:', updateError);
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
    }

    // If the final step is approved, mirror to calendar_scheduled_posts.approval_status
    const updatedSteps = steps.map(s =>
      s.id === activeStep.id ? { ...s, status: action } : s
    );
    const allApproved = updatedSteps.every(s => s.status === 'approved');
    const anyRejected = updatedSteps.some(s => s.status === 'rejected');
    const anyChangesRequested = updatedSteps.some(s => s.status === 'changes_requested');

    let mirroredStatus: string | null = null;
    if (allApproved) {
      mirroredStatus = 'approved';
    } else if (anyRejected) {
      mirroredStatus = 'rejected';
    } else if (anyChangesRequested) {
      mirroredStatus = 'needs_attention';
    }

    if (mirroredStatus) {
      await supabase
        .from(postTable)
        .update({
          approval_status: mirroredStatus,
          needs_attention: mirroredStatus === 'needs_attention',
          updated_at: now,
        })
        .eq('id', post_id);

      logger.debug('Mirrored pipeline status to post', {
        postId: post_id.substring(0, 8) + '...',
        mirroredStatus,
      });
    }

    // Notify the next pending step's party (fire-and-forget, non-blocking)
    if (action === 'approved') {
      const nextStep = updatedSteps
        .filter(s => s.status === 'pending')
        .sort((a, b) => a.step_order - b.step_order)[0];

      if (nextStep?.party_id) {
        // Get client name for the email
        const { data: clientRecord } = await supabase
          .from('clients')
          .select('name')
          .eq('id', clientId)
          .maybeSingle();

        // Get next step label
        const fullNextStep = steps.find(s => s.id === nextStep.id || s.step_order === nextStep.step_order);

        fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id,
            post_type,
            event: 'step_completed',
            target_party_id: nextStep.party_id,
            client_name: clientRecord?.name ?? 'Your Client',
            step_label: fullNextStep && 'label' in fullNextStep ? (fullNextStep as any).label : null,
          }),
        }).catch(err => logger.error('Failed to fire notification:', err));
      }
    }

    return NextResponse.json({
      success: true,
      action,
      pipelineComplete: allApproved || anyRejected || anyChangesRequested,
      mirroredStatus,
    });
  } catch (error) {
    logger.error('Approve step error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
