import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { getCaptionRuleTexts, formatPlaybookPromptSection } from '@/lib/captionPlaybook';
import { HOOK_FORMULAS, HOOK_RULES } from '@/lib/hookFormulas';
import { scoreHook } from '@/lib/hookScore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const CREDITS_PER_RUN = 1;

const bodySchema = z.object({
  clientId: z.string().uuid(),
  topic: z.string().min(1).max(500),
  platform: z.enum(['reel', 'caption']).optional().default('reel'),
});

interface RawHook {
  formulaId: number;
  spoken: string;
  onScreen: string;
}

function buildSystemPrompt(platform: 'reel' | 'caption', playbookSection: string): string {
  const formulaList = HOOK_FORMULAS.map(
    (f) => `${f.id}. ${f.name} — "${f.template}" (e.g. "${f.example}") — best for: ${f.bestFor} — avoid: ${f.trap}`
  ).join('\n');

  return `You write opening hooks for Instagram ${platform === 'reel' ? 'Reels' : 'captions'}, choosing from a named set of 26 proven formulas rather than improvising.

FORMULAS:
${formulaList}

RULES:
${HOOK_RULES.map((r) => `- ${r}`).join('\n')}
${playbookSection}

Given the user's topic, pick the 4 formulas that fit it best and write one hook for each: the spoken line (what gets said out loud) and the on-screen line (shorter, blunter, 6 words or fewer). Do not reuse the formula's own example — write a new hook specific to the topic given.

Respond with ONLY a JSON object: {"hooks": [{"formulaId": <number>, "spoken": "<string>", "onScreen": "<string>"}, ...]} — exactly 4 entries, no prose before or after.`;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }
    const { clientId, topic, platform } = parsed.data;

    const ownership = await requireClientOwnership(request, clientId);
    if (ownership.error) return ownership.error;
    const { user } = ownership;

    const creditCheck = await withAICreditCheck(request, CREDITS_PER_RUN);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const playbookRules = await getCaptionRuleTexts(clientId);
    const playbookSection = formatPlaybookPromptSection(playbookRules);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(platform, playbookSection) },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ success: false, error: 'No response from the model' }, { status: 502 });
    }

    let rawHooks: RawHook[];
    try {
      const parsedJson = JSON.parse(raw) as { hooks?: RawHook[] };
      rawHooks = Array.isArray(parsedJson.hooks) ? parsedJson.hooks : [];
    } catch {
      logger.error('Hook writer: failed to parse model response', { raw });
      return NextResponse.json({ success: false, error: 'Could not parse the model response' }, { status: 502 });
    }

    if (rawHooks.length === 0) {
      return NextResponse.json({ success: false, error: 'The model returned no hooks' }, { status: 502 });
    }

    // Scoring is deterministic and happens here, not in the model — the LLM
    // writes candidates, the script ranks them, same split as the original
    // ig-reel skill (hooks.json for formulas, hookscore.py for the score).
    const scored = rawHooks
      .map((h) => {
        const formula = HOOK_FORMULAS.find((f) => f.id === h.formulaId);
        return {
          formulaId: h.formulaId,
          formulaName: formula?.name ?? 'Unnamed',
          spoken: h.spoken,
          onScreen: h.onScreen,
          ...scoreHook(h.spoken),
        };
      })
      .sort((a, b) => b.score - a.score);

    await trackAICreditUsage(user.id, CREDITS_PER_RUN, 'hook_writer', clientId, { topic, platform });

    return NextResponse.json({ success: true, hooks: scored });
  } catch (error) {
    logger.error('POST /api/ai-assist/hook-writer error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
