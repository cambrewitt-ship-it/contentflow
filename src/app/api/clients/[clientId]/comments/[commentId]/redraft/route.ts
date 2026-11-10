import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { completionParams } from '@/lib/openaiParams';
import { brandBrief } from '@/lib/comments/store';

export const dynamic = 'force-dynamic';

// Write a different reply to a comment, optionally steered ("warmer", "mention the
// Saturday market"). 1 AI credit. Body: { instruction?, private?: boolean }.

type Params = { params: Promise<{ clientId: string; commentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId, commentId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const instruction = typeof body?.instruction === 'string' ? body.instruction.slice(0, 300) : '';
  const isPrivate = body?.private === true;

  const admin = createSupabaseAdmin();
  const { data: c } = await admin
    .from('client_comments')
    .select('message, post_text, author_name, platform, suggested_reply')
    .eq('id', commentId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!c) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });

  const credit = await withAICreditCheck(request, 1);
  if (!credit.allowed || !credit.userId) {
    return NextResponse.json({ success: false, error: credit.error || 'AI credit limit reached' }, { status: 403 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 300, temperature: 0.7 }),
      messages: [
        {
          role: 'system',
          content: `You reply to comments on a business's ${c.platform} posts as its community manager. ${
            isPrivate ? 'This reply is a private DM to the commenter.' : 'This is a public reply under the comment.'
          } Short (1-3 sentences), natural, in the brand's voice, no hashtags, never invent facts like prices or hours. Output only the reply.\n\nBRAND:\n${await brandBrief(admin, clientId)}`,
        },
        {
          role: 'user',
          content: `Post: "${String(c.post_text ?? '').slice(0, 300)}"\nComment from ${c.author_name ?? 'someone'}: "${c.message}"${
            c.suggested_reply ? `\nPrevious draft (write a different one): "${c.suggested_reply}"` : ''
          }${instruction ? `\nInstruction: ${instruction}` : ''}`,
        },
      ],
    });
    const reply = (completion.choices[0]?.message?.content ?? '').trim().replace(/^"|"$/g, '');
    await trackAICreditUsage(credit.userId, 1, 'comment_reply', clientId);
    return NextResponse.json({ success: true, reply });
  } catch (error) {
    logger.error('Redraft reply error:', error);
    return NextResponse.json({ success: false, error: 'Could not write a reply right now' }, { status: 500 });
  }
}
