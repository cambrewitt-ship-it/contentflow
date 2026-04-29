import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'approve_all']),
  postIds: z.array(z.string().uuid()).optional(),
  feedback: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { action, postIds, feedback } = parsed.data;

    const admin = createSupabaseAdmin();

    // Verify plan ownership
    const { data: plan, error: planErr } = await admin
      .from('autopilot_plans')
      .select('id, user_id, status, posts_planned')
      .eq('id', planId)
      .maybeSingle();

    if (planErr || !plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }
    if (plan.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let updatedCount = 0;

    if (action === 'approve_all') {
      // Approve all pending posts in the plan
      const { data: updated, error: updateErr } = await admin
        .from('calendar_scheduled_posts')
        .update({
          autopilot_status: 'approved',
          approval_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('autopilot_plan_id', planId)
        .eq('autopilot_status', 'pending_approval')
        .select('id');

      if (updateErr) {
        logger.error('Error approving all posts:', updateErr);
        return NextResponse.json({ success: false, error: 'Failed to approve posts' }, { status: 500 });
      }
      updatedCount = updated?.length ?? 0;
    } else {
      if (!postIds || postIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'postIds is required for approve/reject actions' },
          { status: 400 }
        );
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';

      const updates: Record<string, unknown> = {
        autopilot_status: newStatus,
        approval_status: approvalStatus,
        updated_at: new Date().toISOString(),
      };
      if (action === 'reject' && feedback) {
        updates.client_feedback = feedback;
      }

      const { data: updated, error: updateErr } = await admin
        .from('calendar_scheduled_posts')
        .update(updates)
        .in('id', postIds)
        .eq('autopilot_plan_id', planId)
        .select('id');

      if (updateErr) {
        logger.error('Error updating post statuses:', updateErr);
        return NextResponse.json({ success: false, error: 'Failed to update posts' }, { status: 500 });
      }
      updatedCount = updated?.length ?? 0;
    }

    // Recount approved/total posts to update plan status
    const { data: allPosts } = await admin
      .from('calendar_scheduled_posts')
      .select('id, autopilot_status')
      .eq('autopilot_plan_id', planId);

    const total = allPosts?.length ?? 0;
    const approved = allPosts?.filter(p => p.autopilot_status === 'approved').length ?? 0;
    const rejected = allPosts?.filter(p => p.autopilot_status === 'rejected').length ?? 0;
    const pending = allPosts?.filter(p => p.autopilot_status === 'pending_approval').length ?? 0;

    let newPlanStatus: string = plan.status;
    if (pending === 0 && approved === total) {
      newPlanStatus = 'approved';
    } else if (pending === 0 && rejected === total) {
      newPlanStatus = 'partially_approved';
    } else if (approved > 0 || rejected > 0) {
      newPlanStatus = 'partially_approved';
    }

    const { data: updatedPlan } = await admin
      .from('autopilot_plans')
      .update({
        posts_approved: approved,
        status: newPlanStatus,
        updated_at: new Date().toISOString(),
        ...(newPlanStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
      })
      .eq('id', planId)
      .select('*')
      .single();

    return NextResponse.json({ success: true, plan: updatedPlan, updatedPosts: updatedCount });
  } catch (error) {
    logger.error('POST /api/autopilot/plans/[planId]/approve error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
