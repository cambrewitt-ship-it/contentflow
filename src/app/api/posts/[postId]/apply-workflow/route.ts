import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const ApplyWorkflowSchema = z.object({
  workflow_template_id: z.string().uuid(),
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
  client_id: z.string().uuid(),
});

// POST /api/posts/[postId]/apply-workflow
// Creates post_approval_steps from a workflow template for a given post.
// Agency-only route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const parsed = ApplyWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { workflow_template_id, post_type, client_id } = parsed.data;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Verify client ownership
    const { data: clientCheck } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify post belongs to this client
    const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: post } = await supabaseAdmin
      .from(postTable)
      .select('id, client_id')
      .eq('id', postId)
      .maybeSingle();

    if (!post || post.client_id !== client_id) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch workflow template
    const { data: template } = await supabase
      .from('workflow_templates')
      .select('id, steps, name')
      .eq('id', workflow_template_id)
      .eq('client_id', client_id)
      .maybeSingle();

    if (!template) {
      return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
    }

    const steps = template.steps as Array<{
      step_order: number;
      party_id?: string | null;
      label?: string;
      agency_step?: boolean;
    }>;

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'Workflow template has no steps' }, { status: 400 });
    }

    // Delete any existing steps for this post (re-applying a workflow resets it)
    await supabaseAdmin
      .from('post_approval_steps')
      .delete()
      .eq('post_id', postId)
      .eq('post_type', post_type);

    // Insert new steps
    const stepInserts = steps.map(step => ({
      post_id: postId,
      post_type,
      step_order: step.step_order,
      party_id: step.party_id ?? null,
      label: step.label ?? null,
      status: 'pending',
    }));

    const { data: createdSteps, error: insertError } = await supabaseAdmin
      .from('post_approval_steps')
      .insert(stepInserts)
      .select();

    if (insertError) {
      logger.error('Error inserting post_approval_steps:', insertError);
      return NextResponse.json({ error: 'Failed to apply workflow' }, { status: 500 });
    }

    // Update the post to reference this template
    await supabaseAdmin
      .from(postTable)
      .update({ workflow_template_id, updated_at: new Date().toISOString() })
      .eq('id', postId);

    logger.debug('Workflow applied to post', {
      postId: postId.substring(0, 8) + '...',
      templateName: template.name,
      stepCount: createdSteps?.length,
    });

    return NextResponse.json({ steps: createdSteps }, { status: 201 });
  } catch (error) {
    logger.error('Apply workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
