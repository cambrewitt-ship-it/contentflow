import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { resolvePortalToken } from '@/lib/portalAuth';
import logger from '@/lib/logger';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COPY_TONE_MAP: Record<string, string> = {
  promotional: 'promotional — lead with compelling offers, benefits, or value propositions; include clear calls-to-action',
  educational: 'educational — share valuable insights or tips; position the brand as a trusted expert',
  personal: 'personal — authentic behind-the-scenes storytelling; conversational and relatable',
  testimonial: 'testimonial — highlight client success stories and social proof',
  engagement: 'engagement-focused — ask questions, invite interaction, build community',
};

const FOCUS_MAP: Record<string, string> = {
  'main-focus': 'build the caption primarily around what is shown in the image',
  supporting: 'use image details to enhance and support the main message',
  background: 'reference image elements briefly for context only',
  none: 'focus entirely on the notes text; ignore the image',
};

const COPY_TYPE_MAP: Record<string, string> = {
  'social-media': 'social media post',
  blog: 'blog post excerpt',
  email: 'email newsletter copy',
  ad: 'paid advertisement copy',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, imageData, notes, copyType, contentFocus, copyTone } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const toneInstruction = COPY_TONE_MAP[copyTone] || COPY_TONE_MAP.promotional;
    const focusInstruction = FOCUS_MAP[contentFocus] || FOCUS_MAP['main-focus'];
    const typeLabel = COPY_TYPE_MAP[copyType] || 'social media post';

    const systemPrompt = `You are a professional social media copywriter. Generate a compelling ${typeLabel} caption.
Tone: ${toneInstruction}.
Image role: ${focusInstruction}.
Output ONLY the caption text — no explanations, no labels, no quotes around it. Keep it concise and suitable for social media.`;

    const userMessage = notes?.trim()
      ? `Write a caption for the following content:\n\n${notes}`
      : 'Write a caption for this content.';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (imageData && typeof imageData === 'string' && contentFocus !== 'none') {
      // Strip data URL prefix if present to get just the base64
      const base64Match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64 = base64Match[2];
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'low',
              },
            },
          ],
        });
      } else {
        messages.push({ role: 'user', content: userMessage });
      }
    } else {
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    const caption = response.choices[0]?.message?.content?.trim() ?? '';

    if (!caption) {
      return NextResponse.json({ error: 'Failed to generate caption' }, { status: 500 });
    }

    return NextResponse.json({ caption });
  } catch (error) {
    logger.error('Portal generate-caption error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
