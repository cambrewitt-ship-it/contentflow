import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { checkAICreditsPermissionForUser, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { FEEDBACK_TAGS, FEEDBACK_TAG_IDS } from '@/lib/captionFeedback';
import type { FeedbackTag } from '@/lib/captionFeedback';
import { getCaptionRuleTexts, saveCaptionRule } from '@/lib/captionPlaybook';
import { reviseCandidate } from '@/lib/autopilot-agent/revise';
import { runBriefSchema } from '@/lib/autopilot-agent/runBrief';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Feedback on one Content Agent post during swipe review:
//   rewrite — rewrite the copy from the feedback, and say why it was written that way
//   explain — just say why it was written that way
//   skip    — record the feedback (the client then marks it skipped)
// With `remember`, the feedback also becomes a rule in the client's caption playbook.
const bodySchema = z
  .object({
    action: z.enum(['rewrite', 'explain', 'skip']),
    tags: z.array(z.enum(FEEDBACK_TAG_IDS as [FeedbackTag, ...FeedbackTag[]])).default([]),
    note: z.string().trim().max(1000).default(''),
    remember: z.boolean().default(true),
  })
  .refine(b => b.action === 'explain' || b.tags.length > 0 || b.note.length > 0, {
    message: 'Pick a reason or write a note',
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
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
    const { action, tags, note, remember } = parsed.data;

    const admin = createSupabaseAdmin();
    const { data: candidate } = await admin
      .from('autopilot_candidates')
      .select('*, autopilot_plans!inner(user_id, ai_context_snapshot)')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }
    const plan = candidate.autopilot_plans as { user_id: string; ai_context_snapshot: Record<string, unknown> | null } | null;
    if (plan?.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const feedbackText = [
      tags.length > 0 && `Problems: ${tags.map(t => FEEDBACK_TAGS[t].label).join(', ')}.`,
      note,
    ].filter(Boolean).join('\n');

    // A written note needs the AI to turn it into a rule; tags alone map to preset rules.
    const deriveRule = remember && note.length > 0;
    const useAI = action !== 'skip' || deriveRule;

    let explanation: string | null = null;
    let aiRule: string | null = null;
    let copy = null;

    if (useAI) {
      const creditCheck = await checkAICreditsPermissionForUser(user.id, 1);
      if (!creditCheck.allowed) {
        return NextResponse.json(
          { success: false, error: creditCheck.error || 'Insufficient AI credits' },
          { status: 402 }
        );
      }

      const briefParsed = runBriefSchema.safeParse(plan?.ai_context_snapshot?.runBrief);
      const result = await reviseCandidate({
        candidate,
        feedback: feedbackText || 'No specific feedback — the account manager wants to know why it was written this way.',
        rules: await getCaptionRuleTexts(candidate.client_id),
        runBrief: briefParsed.success ? briefParsed.data : null,
        rewrite: action === 'rewrite',
        explain: action !== 'skip',
        deriveRule,
      });
      explanation = result.explanation;
      aiRule = result.rule;
      copy = result.copy;

      await trackAICreditUsage(user.id, 1, 'autopilot_feedback', candidate.client_id, {
        action,
        totalTokens: result.totalTokens,
      });
    }

    // Save the feedback (and the rewrite) on the candidate
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (feedbackText) {
      updates.feedback = note || null;
      updates.feedback_tags = tags;
    }
    if (copy) {
      updates.original_caption = candidate.original_caption ?? candidate.caption;
      updates.caption = copy.caption;
      updates.hashtags = copy.hashtags;
      if (candidate.post_type === 'paid_ad') {
        updates.ad_headline = copy.ad_headline;
        updates.ad_primary_text = copy.ad_primary_text;
        updates.ad_description = copy.ad_description;
      }
    }

    const { data: updated, error: updateErr } = await admin
      .from('autopilot_candidates')
      .update(updates)
      .eq('id', candidateId)
      .select('*')
      .single();

    if (updateErr) {
      logger.error('POST candidate feedback update error:', updateErr);
      return NextResponse.json({ success: false, error: 'Failed to save feedback' }, { status: 500 });
    }

    // Add to the caption playbook
    const savedRules: string[] = [];
    if (remember && action !== 'explain') {
      const ruleTexts: string[] = deriveRule
        ? (aiRule ? [aiRule] : [])
        : tags.flatMap(t => {
            const preset: string | null = FEEDBACK_TAGS[t].rule;
            return preset ? [preset] : [];
          });
      for (const rule of ruleTexts) {
        const saved = await saveCaptionRule({
          clientId: candidate.client_id,
          userId: user.id,
          rule,
          source: 'feedback',
          sourceCandidateId: candidateId,
        });
        if (saved) savedRules.push(saved.rule);
      }
    }

    return NextResponse.json({ success: true, candidate: updated, explanation, savedRules });
  } catch (error) {
    logger.error('POST /api/autopilot/candidates/[candidateId]/feedback error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
