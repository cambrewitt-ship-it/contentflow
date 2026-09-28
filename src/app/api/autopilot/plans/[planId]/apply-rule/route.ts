import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { checkAICreditsPermissionForUser, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { getCaptionRuleTexts } from '@/lib/captionPlaybook';
import { fetchBrandContext } from '@/lib/autopilot-agent/context';
import { reviseCandidate } from '@/lib/autopilot-agent/revise';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

// Rewrites the posts still waiting in swipe review so a rule the account
// manager just added applies to this run too, not only future ones.
const bodySchema = z.object({
  rule: z.string().trim().min(1).max(500),
  candidateIds: z.array(z.string().uuid()).min(1).max(12),
});

const CONCURRENCY = 4;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }
    const { rule, candidateIds } = parsed.data;

    const admin = createSupabaseAdmin();
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, client_id')
      .eq('id', planId)
      .maybeSingle();
    if (!plan) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    if (plan.user_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { data: candidates } = await admin
      .from('autopilot_candidates')
      .select('*')
      .eq('autopilot_plan_id', planId)
      .eq('decision', 'pending')
      .in('id', candidateIds);

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ success: true, candidates: [] });
    }

    const creditCheck = await checkAICreditsPermissionForUser(user.id, candidates.length);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const [brandCtx, rules] = await Promise.all([
      fetchBrandContext(plan.client_id),
      getCaptionRuleTexts(plan.client_id),
    ]);

    const updated: unknown[] = [];
    let totalTokens = 0;
    let revisions = 0;

    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      const batch = candidates.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async candidate => {
          const result = await reviseCandidate({
            candidate,
            feedback: `Apply this rule: "${rule}". If the copy already follows it, return it unchanged.`,
            rules,
            runBrief: null,
            rewrite: true,
            explain: false,
            deriveRule: false,
            brandCtx,
          });
          totalTokens += result.totalTokens;
          revisions++;
          const copy = result.copy!;

          const updates: Record<string, unknown> = {
            caption: copy.caption,
            hashtags: copy.hashtags,
            updated_at: new Date().toISOString(),
          };
          if (copy.caption !== candidate.caption) {
            updates.original_caption = candidate.original_caption ?? candidate.caption;
          }
          if (candidate.post_type === 'paid_ad') {
            updates.ad_headline = copy.ad_headline;
            updates.ad_primary_text = copy.ad_primary_text;
            updates.ad_description = copy.ad_description;
          }

          const { data } = await admin
            .from('autopilot_candidates')
            .update(updates)
            .eq('id', candidate.id)
            .select('*')
            .single();
          return data;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) updated.push(r.value);
        else if (r.status === 'rejected') logger.warn('apply-rule: one rewrite failed', { planId, reason: String(r.reason) });
      }
    }

    if (revisions > 0) {
      await trackAICreditUsage(user.id, revisions, 'autopilot_apply_rule', plan.client_id, { totalTokens });
    }

    return NextResponse.json({ success: true, candidates: updated });
  } catch (error) {
    logger.error('POST /api/autopilot/plans/[planId]/apply-rule error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
