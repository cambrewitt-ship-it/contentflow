import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import logger from '@/lib/logger';
import { TOOL_DEFS, dispatchTool } from './tools';
import type { RunContext, ScratchpadPost } from './tools';
import { MAX_ITERATIONS } from './constants';

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

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
  const adCopyGoal = ctx.adCopyEnabled
    ? `\n\nALSO build a pool of ${ctx.adCopyCount} paid-ad-copy candidates for ${ctx.adPlatform === 'google' ? 'Google Ads' : 'Meta Ads'} (headline + primary text + optional description), using propose_ad_copy. These are separate from the organic posts above — not scheduled, not part of the content_mix, just ad copy variants for a human to paste into Ads Manager. Ground them in the same brand voice and gallery, but written for a scroll-stopping paid placement, not an organic post.`
    : '';

  return `You are an expert social media content strategist working as an autonomous agent for ${clientName}.

GOAL: build a pool of ${ctx.candidateCount} organic social media post candidates for ${ctx.startStr} to ${ctx.endStr}. This is a candidate pool for a human to swipe through and pick favourites from — generate more variety than they'll need, not a final locked-in schedule.${adCopyGoal}

You have tools to gather everything you need. Don't guess at brand voice, events, or season — call the tools. Don't invent photos — only use media_gallery_id values returned by search_media_gallery.

SUGGESTED WORKFLOW:
1. get_brand_context — brand voice, audience, rules. Do this first.
2. search_media_gallery — see what's available. Call it more than once with different queries if that helps you find a good mix (don't just take the first page).
3. get_upcoming_events and get_nz_context — check for relevant dates.
4. get_style_preferences — check what this client has liked/disliked before, if any history exists.
5. get_recent_posts — avoid repeating topics or photos from the last 14 days.
6. For each organic candidate: draft it, optionally run critique_own_draft on it, revise if it fails, then call propose_post.${ctx.adCopyEnabled ? `\n7. For each ad copy candidate: call propose_ad_copy.` : ''}
${ctx.adCopyEnabled ? '8' : '7'}. When you have ${ctx.candidateCount} organic candidates${ctx.adCopyEnabled ? ` and ${ctx.adCopyCount} ad copy candidates` : ''}, call finalize_candidate_pool. That ends the run — nothing after that call counts.

RULES:
- Only propose posts on days the business is open (see operating_hours from get_brand_context). If empty, any day is fine.
- Never propose a day in the posting_preferences "avoid_days" list.
- Respect the content_mix percentages across the whole candidate pool (promotional/engagement/seasonal/educational).
- Use the brand voice and tone consistently — reference brand_voice_examples and caption_dos/caption_donts.
- Don't repeat topics or photos used in recent posts.
- Write captions appropriate for each target platform. Max 5 hashtags per post, every one must pass: "would a human actually search for or follow this?" Never hashtag the brand's region/country unless the post is actually about that region.
- Keep captions under 2200 characters.

CRITICAL RULES FOR CAPTION QUALITY:
- Write as if you ARE this business's social media manager who has worked there for years. You know the regulars, you know what the place feels like on a Tuesday lunch.
- Each caption must be SPECIFIC to the photo being used — reference concrete details from the photo's AI description (the steam off a bowl, the wooden table, the specific dish). If the caption could be swapped onto a different photo and still work, it's too generic — rewrite it.
- No corporate language: avoid "discover", "leverage", "solutions", "elevate", "unlock", "seamless", "innovative", "synergy", "holistic", "empower".
- Vary structure across the pool — not every post should open with a question or an emoji.
- Respond only by calling tools. Do not write prose responses to the user.`;
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
    { role: 'user', content: `Begin. Build the candidate pool for ${ctx.startStr} to ${ctx.endStr}.` },
  ];

  let promptTokens = 0;
  let completionTokens = 0;
  let toolCallCount = 0;
  let iterations = 0;
  let autoFinalized = false;

  while (iterations < MAX_ITERATIONS && !ctx.finalized) {
    iterations++;

    const nearCap = iterations >= MAX_ITERATIONS - 1;
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOL_DEFS,
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
            : 'Please use the available tools to gather context and start proposing candidates.',
      });
      continue;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      toolCallCount++;
      const result = dispatchTool(toolCall.function.name, toolCall.function.arguments, ctx);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!ctx.finalized) {
    if (ctx.scratchpad.posts.length === 0) {
      throw new Error(`Agent loop hit the ${MAX_ITERATIONS}-iteration cap without proposing any candidates.`);
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
