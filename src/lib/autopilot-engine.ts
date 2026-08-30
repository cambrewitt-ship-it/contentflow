import OpenAI from 'openai';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { sendAutopilotPlanReadyEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import logger from '@/lib/logger';
import { getStylePreferences } from '@/lib/preference-engine';
import {
  inferHemisphere,
  deriveSeason,
  formatDate,
  getOrCreateDefaultProject,
  fetchBrandContext,
  getAvailableGalleryItems,
  getRecentPosts,
  getExistingPostsInRange,
  getEventsForRange,
  getRegionalHolidays,
} from '@/lib/autopilot-agent/context';
import type { GalleryItem } from '@/lib/autopilot-agent/context';
import { runAutopilotAgentLoop } from '@/lib/autopilot-agent/loop';
import type { RunContext } from '@/lib/autopilot-agent/tools';
import { TOKENS_PER_CREDIT } from '@/lib/autopilot-agent/constants';

// Re-exported for backward compatibility — imported directly by
// src/app/api/autopilot/plans/[planId]/confirm/route.ts.
export { getOrCreateDefaultProject, inferHemisphere, deriveSeason };

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutopilotPlan {
  id: string;
  client_id: string;
  user_id: string;
  project_id: string | null;
  plan_week_start: string;
  plan_week_end: string;
  posts_planned: number;
  posts_approved: number;
  ai_plan_summary: string | null;
  ai_context_snapshot: Record<string, unknown> | null;
  events_considered: unknown[];
  status: string;
  approval_token: string;
  approved_at: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateContentPlan(
  clientId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ plan: AutopilotPlan; candidates: unknown[] }> {
  const admin = createSupabaseAdmin();

  // Step 1: Gather context (same data the old engine fetched — now served to
  // the agent via tools instead of pre-stuffed into one giant prompt).
  logger.info('Autopilot v3: gathering context', { clientId });
  const [brandCtx, events, recentPosts, existingPosts, gallery, project, stylePrefs] =
    await Promise.all([
      fetchBrandContext(clientId),
      getEventsForRange(clientId, startDate, endDate),
      getRecentPosts(clientId, 14),
      getExistingPostsInRange(clientId, startDate, endDate),
      getAvailableGalleryItems(clientId, 40),
      getOrCreateDefaultProject(clientId, userId),
      getStylePreferences(clientId),
    ]);

  const client = brandCtx.client;
  if (!client) throw new Error('Client not found');

  const holidays = await getRegionalHolidays(client.region, startDate, endDate);

  // Step 2: Determine candidate count (10-12, always, regardless of existing posts)
  const prefs = (client.posting_preferences ?? {}) as Record<string, unknown>;
  const postsPerWeek = (prefs.posts_per_week as number) || 3;
  const candidateCount = Math.min(12, Math.max(10, postsPerWeek * 3));
  const hemisphere = inferHemisphere(
    (client.business_context as Record<string, unknown>)?.hemisphere as string | undefined,
    client.region
  );
  const season = deriveSeason(hemisphere, startDate);

  const adCopySettings = (client.ad_copy_settings ?? {}) as { enabled?: boolean; platform?: string; variants_per_run?: number };
  const adCopyEnabled = adCopySettings.enabled === true;
  const adCopyCount = Math.min(10, Math.max(1, adCopySettings.variants_per_run || 3));
  const adPlatform = adCopySettings.platform === 'google' ? 'google' : 'meta';

  logger.info('Autopilot v3: plan params', {
    postsPerWeek,
    candidateCount,
    existingCount: existingPosts.length,
    gallerySize: gallery.length,
    eventsCount: events.length,
    holidaysCount: holidays.length,
    season,
    hasStylePrefs: stylePrefs.hasEnoughData,
    adCopyEnabled,
    adCopyCount: adCopyEnabled ? adCopyCount : 0,
  });

  // Create plan record in 'generating' state
  const { data: planRow, error: planInsertErr } = await admin
    .from('autopilot_plans')
    .insert({
      client_id: clientId,
      user_id: userId,
      project_id: project.id,
      plan_week_start: formatDate(startDate),
      plan_week_end: formatDate(endDate),
      posts_planned: postsPerWeek,
      ai_context_snapshot: {
        season,
        eventsCount: events.length,
        gallerySize: gallery.length,
        holidaysCount: holidays.length,
        postsPerWeek,
        existingCount: existingPosts.length,
        hasStylePrefs: stylePrefs.hasEnoughData,
      },
      events_considered: events.map(e => ({ id: e.id, title: e.title, date: e.event_date })),
      status: 'generating',
      generation_version: 'v3',
      candidates_generated: 0,
      candidates_liked: 0,
      candidates_skipped: 0,
    })
    .select('*')
    .single();

  if (planInsertErr || !planRow) {
    throw new Error(`Failed to create autopilot plan: ${planInsertErr?.message}`);
  }

  const notifyFailure = (reason: string) =>
    createNotification({
      userId,
      clientId,
      type: 'autopilot_failed',
      title: `Autopilot couldn't generate a plan for ${client.name}`,
      body: reason,
      link: `/dashboard/client/${clientId}/autopilot`,
    });

  if (gallery.length === 0) {
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'No analyzed photos available in gallery.' })
      .eq('id', planRow.id);
    await notifyFailure('No analyzed photos available in the media gallery — upload and analyze photos first.');
    throw new Error('No analyzed photos available in the media gallery. Upload and analyze photos first.');
  }

  // Step 3: Run the agentic tool-calling loop
  const galleryMap = new Map(gallery.map(g => [g.id, g]));
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const runCtx: RunContext = {
    clientId,
    startStr,
    endStr,
    candidateCount,
    season,
    hemisphere,
    brandCtx,
    gallery,
    galleryMap,
    recentPosts,
    events,
    holidays,
    stylePrefs,
    scratchpad: { posts: [] },
    finalized: false,
    planSummary: null,
    adCopyEnabled,
    adCopyCount,
    adPlatform,
  };

  logger.info('Autopilot v3: starting agent loop', { model: MODEL, candidateCount, clientId });

  let runResult;
  try {
    runResult = await runAutopilotAgentLoop(runCtx);
  } catch (agentErr) {
    const reason = agentErr instanceof Error ? agentErr.message : String(agentErr);
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'Agent generation failed.' })
      .eq('id', planRow.id);
    await notifyFailure(reason);
    throw new Error(`Autopilot agent run failed: ${reason}`);
  }

  // Step 4: Defensive re-validation (propose_post/propose_ad_copy already
  // validate on the way in — this is cheap insurance against any edge case in
  // the scratchpad). Ad-copy candidates skip the date-range check since they
  // don't get scheduled — see propose_ad_copy in tools.ts.
  const validCandidates = runResult.candidates.filter(c => {
    if (!c.media_gallery_id || !galleryMap.has(c.media_gallery_id)) return false;
    if (c.post_type === 'paid_ad') {
      return Boolean(c.ad_headline && c.ad_primary_text);
    }
    if (!c.caption || !c.suggested_date) return false;
    if (c.suggested_date < startStr || c.suggested_date > endStr) return false;
    return true;
  });

  if (validCandidates.length === 0) {
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'No valid candidates after validation.' })
      .eq('id', planRow.id);
    await notifyFailure('The agent finished but none of its candidates passed validation.');
    throw new Error('Agent candidate validation failed — no valid candidates.');
  }

  // Step 5: Store candidates in autopilot_candidates
  const createdCandidates: unknown[] = [];
  for (let i = 0; i < validCandidates.length; i++) {
    const c = validCandidates[i];

    const { data: created, error: insertErr } = await admin
      .from('autopilot_candidates')
      .insert({
        autopilot_plan_id: planRow.id,
        client_id: clientId,
        media_gallery_id: c.media_gallery_id,
        media_url: c.media_url,
        caption: c.caption,
        platforms: c.platforms ?? [],
        hashtags: c.hashtags ?? [],
        post_type: c.post_type || null,
        event_reference: c.event_reference || null,
        season_tag: c.season_tag || null,
        suggested_date: c.suggested_date,
        suggested_time: c.suggested_time,
        ai_reasoning: c.reasoning || null,
        decision: 'pending',
        display_order: i,
        ad_headline: c.ad_headline || null,
        ad_primary_text: c.ad_primary_text || null,
        ad_description: c.ad_description || null,
        ad_platform: c.ad_platform || null,
        ad_status: c.post_type === 'paid_ad' ? 'pending' : null,
      })
      .select('*')
      .single();

    if (insertErr) {
      logger.error('Failed to insert autopilot candidate:', insertErr);
    } else if (created) {
      createdCandidates.push(created);
    }
  }

  const adCandidatesCount = validCandidates.filter(c => c.post_type === 'paid_ad').length;
  const organicCandidatesCount = validCandidates.length - adCandidatesCount;

  // Step 6: Update plan
  const { data: finalPlan } = await admin
    .from('autopilot_plans')
    .update({
      ai_plan_summary: runResult.planSummary || null,
      status: 'pending_approval',
      candidates_generated: createdCandidates.length,
      ai_context_snapshot: {
        season,
        eventsCount: events.length,
        gallerySize: gallery.length,
        holidaysCount: holidays.length,
        postsPerWeek,
        existingCount: existingPosts.length,
        hasStylePrefs: stylePrefs.hasEnoughData,
        adCopyEnabled,
        adCandidatesCount,
        agentRun: runResult.usage,
      },
    })
    .eq('id', planRow.id)
    .select('*')
    .single();

  // Step 7: Track credits based on actual token usage across the whole loop
  const totalCredits = Math.max(1, Math.ceil(runResult.usage.totalTokens / TOKENS_PER_CREDIT));
  await trackAICreditUsage(userId, totalCredits, 'autopilot_generate', clientId, {
    iterations: runResult.usage.iterations,
    toolCalls: runResult.usage.toolCalls,
    totalTokens: runResult.usage.totalTokens,
  });

  // Step 8: Notify — in-app always, email when the user has one on file
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://content-manager.io';
  const approvalLink = `${baseUrl}/dashboard/client/${clientId}/autopilot`;
  const planSummaryText = runResult.planSummary || `${createdCandidates.length} candidates generated for review.`;
  const notificationBody = adCandidatesCount > 0
    ? `${planSummaryText} (${organicCandidatesCount} organic posts, ${adCandidatesCount} ad copy variants)`
    : planSummaryText;

  await createNotification({
    userId,
    clientId,
    type: 'autopilot_plan_ready',
    title: `New content plan ready for ${brandCtx.client?.name || 'this client'}`,
    body: notificationBody,
    link: `/dashboard/client/${clientId}/autopilot`,
    metadata: { planId: planRow.id, candidatesCount: createdCandidates.length, adCandidatesCount },
  });

  try {
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (userProfile?.email) {
      const formatWeekDate = (d: Date) =>
        d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });

      await sendAutopilotPlanReadyEmail({
        to: userProfile.email,
        userName: userProfile.full_name || 'there',
        clientName: brandCtx.client?.name || clientId,
        planSummary: planSummaryText,
        postsCount: createdCandidates.length,
        weekStart: formatWeekDate(startDate),
        weekEnd: formatWeekDate(endDate),
        approvalLink,
      });

      await admin
        .from('autopilot_plans')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', planRow.id);
    }
  } catch (emailErr) {
    logger.error('Autopilot v3: failed to send plan-ready email:', emailErr);
  }

  logger.info('Autopilot v3: candidates generated', {
    planId: planRow.id,
    candidatesCreated: createdCandidates.length,
    creditsUsed: totalCredits,
    ...runResult.usage,
  });

  return {
    plan: (finalPlan ?? { ...planRow, status: 'pending_approval' }) as AutopilotPlan,
    candidates: createdCandidates,
  };
}

// ── Caption regeneration (used by swap-photo) ─────────────────────────────────
// Unchanged: a simple one-shot rewrite, not part of the agentic candidate-pool
// generation flow above.

export async function regenerateCaption(params: {
  clientId: string;
  galleryItem: GalleryItem;
  postType: string;
  platforms: string[];
}): Promise<string> {
  const { clientId, galleryItem, postType, platforms } = params;
  const brandCtx = await fetchBrandContext(clientId);
  const client = brandCtx.client;

  const prompt = `You are a social media copywriter. Write a single caption for a ${postType} post on ${platforms.join(' and ')}.

Brand: ${client?.name || 'the business'}
Tone: ${client?.brand_tone || 'engaging and authentic'}
Target audience: ${client?.target_audience || 'general'}
Caption dos: ${client?.caption_dos || 'none'}
Caption don'ts: ${client?.caption_donts || 'none'}

Photo details:
- Description: ${galleryItem.ai_description || 'none'}
- Tags: ${(galleryItem.ai_tags || []).join(', ')}
- Mood: ${galleryItem.ai_mood || 'none'}
- Context: ${galleryItem.user_context || 'none'}

Write ONLY the caption text (with hashtags). No explanation.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.8,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}
