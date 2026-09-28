import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import logger from '@/lib/logger';
import { AGENT_TOOL_DEFS, dispatchTool, buildContextBriefing, poolIsFull } from './tools';
import type { RunContext, ScratchpadPost } from './tools';
import { MAX_ITERATIONS } from './constants';
import { formatRunBriefPrompt } from './runBrief';

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// Each iteration resends the growing conversation, so a run can hit the org's
// tokens-per-minute cap. OpenAI's suggested retry-after is often ~100ms, which
// the SDK's own fast retries burn through while the rolling 1-minute window is
// still full — so wait progressively longer here (5s, 10s, ... ~75s total,
// inside the route's 300s budget) before giving up.
const RATE_LIMIT_BACKOFF_MS = [5_000, 10_000, 15_000, 20_000, 25_000];

async function createCompletionWithBackoff(
  params: Parameters<typeof openai.chat.completions.create>[0] & { stream?: false }
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      if (!(err instanceof OpenAI.RateLimitError) || attempt >= RATE_LIMIT_BACKOFF_MS.length) throw err;
      const delay = RATE_LIMIT_BACKOFF_MS[attempt];
      logger.warn(`Autopilot agent: OpenAI rate limit hit, retrying in ${delay / 1000}s`, { attempt: attempt + 1 });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function summarizePool(ctx: RunContext): string {
  const ads = ctx.scratchpad.posts.filter(p => p.post_type === 'paid_ad').length;
  const organic = ctx.scratchpad.posts.length - ads;
  const types = [...new Set(ctx.scratchpad.posts.map(p => p.post_type).filter(t => t && t !== 'paid_ad'))];
  const parts = [
    organic > 0 && `${organic} ${types.length > 0 ? `${types.join('/')} ` : ''}posts for ${ctx.startStr} to ${ctx.endStr}`,
    ads > 0 && `${ads} ad copy variant${ads === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return `${parts.join(' and ')}.`;
}

export interface AgentRunResult {
  planSummary: string;
  candidates: ScratchpadPost[];
  usage: {
    iterations: number;
    toolCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    autoFinalized: boolean;
  };
}

function buildSystemPrompt(ctx: RunContext): string {
  const clientName = ctx.brandCtx.client?.name || 'this business';
  const adsName = ctx.adPlatform === 'google' ? 'Google Ads' : 'Meta Ads';
  const organic = ctx.candidateCount > 0;

  let goal: string;
  if (!organic) {
    goal = `GOAL: build a pool of ${ctx.adCopyCount} paid-ad-copy candidates for ${adsName} (headline + primary text + optional description), using propose_ad_copy. This run is paid ads only — do NOT call propose_post. These are ad copy variants for a human to swipe through and paste into Ads Manager, written for a scroll-stopping paid placement, not an organic post.`;
  } else {
    goal = `GOAL: build a pool of ${ctx.candidateCount} organic social media post candidates for ${ctx.startStr} to ${ctx.endStr}. This is a candidate pool for a human to swipe through and pick favourites from — generate more variety than they'll need, not a final locked-in schedule.`;
    if (ctx.adCopyEnabled) {
      goal += `\n\nALSO build a pool of ${ctx.adCopyCount} paid-ad-copy candidates for ${adsName} (headline + primary text + optional description), using propose_ad_copy. These are separate from the organic posts above — not scheduled, not part of the content_mix, just ad copy variants for a human to paste into Ads Manager. Ground them in the same brand voice and gallery, but written for a scroll-stopping paid placement, not an organic post.`;
    }
  }

  const proposeCalls = [
    organic && `${ctx.candidateCount} propose_post calls`,
    ctx.adCopyEnabled && `${ctx.adCopyCount} propose_ad_copy calls`,
  ].filter(Boolean).join(' and ');

  return `You are an expert social media content strategist working as an autonomous agent for ${clientName}.

${goal}

Everything you need — brand context, caption playbook, tone of voice guide, the full photo gallery, events, season, style preferences and recent posts — is in the first message. Don't invent photos: only use media_gallery_id values from the gallery list.

WORKFLOW (speed matters — a person is waiting):
1. Read the context, plan the whole pool (a different photo and angle for each), then make ALL ${proposeCalls} together in ONE turn as parallel tool calls.
2. Each proposal is checked on the way in (photo variety, question endings, quality rules). If any come back rejected, fix just those and re-propose them together in the next turn.
3. The run ends automatically once the pool is full. Only call finalize_candidate_pool if you genuinely can't fill it.

RULES:
- Only propose posts on days the business is open (see operating_hours in the brand context). If empty, any day is fine.
- Never propose a day in the posting_preferences "avoid_days" list.
- Respect the content_mix percentages across the whole candidate pool (promotional/engagement/seasonal/educational), unless the RUN BRIEF below restricts post types.
- Use the brand voice and tone consistently — reference brand_voice_examples and caption_dos/caption_donts.
- If the brand context has a caption_playbook, those are rules the account manager wrote from feedback on past posts. Follow every one, on every caption and ad — they override the content defaults, the run brief and learned style preferences.
- The style preferences may include account_manager_feedback (why posts were skipped or changed) and account_manager_edits (the agent's caption vs the human rewrite). Learn from both: write the way the edits go, and avoid what the feedback complains about.
- If the brand context has a tone_of_voice_guide, it is the brand's official copy rulebook: every caption and ad copy MUST follow it (vocabulary, grammar, punctuation, emoji use, banned words). Specific caption_dos/caption_donts take precedence where they conflict.
- Use a DIFFERENT photo for every post, and a different photo for every ad variant — never build several posts around one image. (search_media_gallery shows used_in_this_pool if you need to check.) Only reuse a photo once every photo in the gallery has been used.
- Don't repeat topics or photos used in recent posts.
- Write captions appropriate for each target platform. Max 5 hashtags per post, every one must pass: "would a human actually search for or follow this?" Never hashtag the brand's region/country unless the post is actually about that region.
- Keep captions under 2200 characters.

CRITICAL RULES FOR CAPTION QUALITY:
- Write as if you ARE this business's social media manager who has worked there for years. You know the regulars, you know what the place feels like on a Tuesday lunch.
- Each caption must be SPECIFIC to the photo being used — reference concrete details from the photo's AI description (the steam off a bowl, the wooden table, the specific dish). If the caption could be swapped onto a different photo and still work, it's too generic — rewrite it.
- No corporate language: avoid "discover", "leverage", "solutions", "elevate", "unlock", "seamless", "innovative", "synergy", "holistic", "empower".
- Vary structure across the pool — not every post should open with a question or an emoji, and no more than 1 in 3 should END with a question. Mix endings: statements, invitations, direct CTAs, or simply stopping when the point is made.
- Respond only by calling tools. Do not write prose responses to the user.${ctx.brief ? formatRunBriefPrompt(ctx.brief) : ''}`;
}

/**
 * Runs the bounded tool-calling agent loop that replaces the old single
 * chat.completions.create() call. Stops when the model calls
 * finalize_candidate_pool, or auto-finalizes near the iteration cap if the
 * scratchpad already has candidates (today's one-shot call always cleanly
 * succeeds or fails once — this loop shouldn't regress that reliability by
 * hard-failing a run that has usable output just because it ran long).
 */
export async function runAutopilotAgentLoop(ctx: RunContext): Promise<AgentRunResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    {
      role: 'user',
      content: `Build the candidate pool for ${ctx.startStr} to ${ctx.endStr}. Here is all the context:\n\n${buildContextBriefing(ctx)}\n\nNow propose the whole pool in one turn.`,
    },
  ];

  let promptTokens = 0;
  let completionTokens = 0;
  let toolCallCount = 0;
  let iterations = 0;
  let autoFinalized = false;
  const toolCallNames: string[] = [];
  const rejections: string[] = [];
  // If we're most of the way through the budget and nothing's been proposed
  // yet, the model is stuck exploring — nudge it to commit rather than
  // silently burning the rest of the cap. Fires once.
  const stuckNudgeAt = Math.max(1, MAX_ITERATIONS - 8);
  const proposeTool = ctx.candidateCount > 0 ? 'propose_post' : 'propose_ad_copy';
  let stuckNudgeSent = false;

  while (iterations < MAX_ITERATIONS && !ctx.finalized) {
    iterations++;

    const nearCap = iterations >= MAX_ITERATIONS - 1;
    const completion = await createCompletionWithBackoff({
      model: MODEL,
      messages,
      tools: AGENT_TOOL_DEFS,
      tool_choice: nearCap && ctx.scratchpad.posts.length > 0
        ? { type: 'function', function: { name: 'finalize_candidate_pool' } }
        : 'auto',
      temperature: 0.7,
    });

    promptTokens += completion.usage?.prompt_tokens ?? 0;
    completionTokens += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0];
    const msg = choice?.message;
    if (!msg) break;

    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // Model responded without calling a tool — nudge it back on track.
      messages.push({
        role: 'user',
        content:
          ctx.scratchpad.posts.length > 0
            ? 'Continue using tools. Call finalize_candidate_pool when the pool is ready.'
            : 'You already have all the context. Propose the whole pool now with parallel propose calls.',
      });
      continue;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      toolCallCount++;
      toolCallNames.push(toolCall.function.name);
      const result = dispatchTool(toolCall.function.name, toolCall.function.arguments, ctx);
      const rejection = (result as { success?: boolean; error?: string } | null);
      if (rejection?.success === false && rejection.error) {
        rejections.push(`${toolCall.function.name}: ${rejection.error}`);
        logger.warn('Autopilot agent: tool call rejected', { tool: toolCall.function.name, error: rejection.error });
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Pool full — end here rather than spending a turn on finalize_candidate_pool
    if (!ctx.finalized && poolIsFull(ctx)) {
      ctx.finalized = true;
      ctx.planSummary = summarizePool(ctx);
    }

    if (!stuckNudgeSent && iterations >= stuckNudgeAt && ctx.scratchpad.posts.length === 0 && !ctx.finalized) {
      stuckNudgeSent = true;
      messages.push({
        role: 'user',
        content: `You're at iteration ${iterations} of ${MAX_ITERATIONS} and haven't proposed a single candidate yet. Stop gathering more context — you already have enough. Pick a media_gallery_id from a search_media_gallery result you already received and call ${proposeTool} right now, then keep calling ${proposeTool} until the pool is done.`,
      });
    }
  }

  if (!ctx.finalized) {
    if (ctx.scratchpad.posts.length === 0) {
      logger.error('Autopilot agent loop: hit iteration cap with zero candidates', {
        clientId: ctx.clientId,
        iterations,
        toolCallCount,
        toolCallNames,
      });
      const lastRejection = rejections[rejections.length - 1];
      throw new Error(
        `Agent loop hit the ${MAX_ITERATIONS}-iteration cap without proposing any candidates.` +
          (lastRejection ? ` Last rejection — ${lastRejection}` : '')
      );
    }
    logger.warn('Autopilot agent loop: auto-finalizing at iteration cap', {
      clientId: ctx.clientId,
      candidateCount: ctx.scratchpad.posts.length,
    });
    ctx.finalized = true;
    ctx.planSummary = `${ctx.scratchpad.posts.length} candidates generated (auto-finalized after reaching the reasoning limit).`;
    autoFinalized = true;
  }

  return {
    planSummary: ctx.planSummary!,
    candidates: ctx.scratchpad.posts,
    usage: {
      iterations,
      toolCalls: toolCallCount,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      autoFinalized,
    },
  };
}
