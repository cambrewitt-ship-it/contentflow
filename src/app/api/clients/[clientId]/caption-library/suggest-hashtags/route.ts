import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { completionParams } from '@/lib/openaiParams';
import { isValidHashtag, normalizeHashtag } from '@/lib/captionLibrary';

export const dynamic = 'force-dynamic';

// AI hashtag ideas for a caption, for the # menu in caption boxes. Costs 1 AI credit.
// Meta has no hashtag search we can use, so these are the model's picks of
// established, commonly used tags — the UI labels them as suggestions.

type Params = { params: Promise<{ clientId: string }> };

const SYSTEM_PROMPT = `You suggest Instagram/Facebook hashtags for a social media caption.
Rules:
- Only suggest hashtags that already exist and are actively used on Instagram. Never invent new tags or brand-new phrases.
- Mix: a few broad popular tags, mostly mid-size niche tags for the topic and industry, and local tags if a location is known.
- No banned, spammy or engagement-bait tags (#follow4follow, #like4like, #instagood style filler).
- No tags the caption already contains.
- Return JSON: {"hashtags": ["tag", ...]} with 15 tags, without the # sign, most relevant first.`;

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const caption = typeof body?.caption === 'string' ? body.caption.slice(0, 5000) : '';
    if (!caption.trim()) {
      return NextResponse.json(
        { success: false, error: 'Write some of the caption first, then ask for hashtags.' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const creditCheck = await withAICreditCheck(request, 1);
    if (!creditCheck.allowed || !creditCheck.userId) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'AI credit limit reached' },
        { status: 403 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: client } = await admin
      .from('clients')
      .select('name, industry, company_description, target_audience')
      .eq('id', clientId)
      .maybeSingle();

    const context = [
      client?.name && `Business: ${client.name}`,
      client?.industry && `Industry: ${client.industry}`,
      client?.company_description && `About: ${String(client.company_description).slice(0, 1000)}`,
      client?.target_audience && `Audience: ${String(client.target_audience).slice(0, 500)}`,
    ]
      .filter(Boolean)
      .join('\n');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 400, temperature: 0.4 }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\nCaption:\n${caption}` },
      ],
    });

    let raw: unknown = [];
    try {
      raw = JSON.parse(completion.choices[0]?.message?.content || '{}').hashtags;
    } catch {
      raw = [];
    }
    const existing = new Set(
      Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu), (m: RegExpMatchArray) => m[1].toLowerCase())
    );
    const seen = new Set<string>();
    const hashtags = (Array.isArray(raw) ? raw : [])
      .filter((t): t is string => typeof t === 'string')
      .map(normalizeHashtag)
      .filter((t) => {
        const key = t.toLowerCase();
        if (!isValidHashtag(t) || /^\d+$/.test(t) || existing.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);

    await trackAICreditUsage(creditCheck.userId, 1, 'suggest_hashtags', clientId);

    return NextResponse.json({ success: true, hashtags });
  } catch (error) {
    logger.error('POST suggest-hashtags error:', error);
    return NextResponse.json({ success: false, error: 'Could not suggest hashtags right now.' }, { status: 500 });
  }
}
