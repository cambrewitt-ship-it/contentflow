import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vercel rejects API bodies over ~4.5MB, so keep uploads under that.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOV_CHARS = 60000;

const TRANSCRIBE_PROMPT = `You are transcribing a brand's Tone of Voice (TOV) guide into clean markdown. The markdown will be given to an AI copywriter as the rules for writing this brand's social captions and marketing copy.

Rules:
- Transcribe ALL guidance faithfully: brand personality, voice traits, tone by context/channel, vocabulary, preferred and banned words or phrases, grammar, spelling (e.g. NZ/UK/US English), punctuation, capitalisation, emoji and hashtag rules, formatting, and any do/don't lists.
- Keep every example line of copy exactly as written, including "write this / not this" pairs.
- Use markdown headings, bullet lists and tables to mirror the document's structure.
- Leave out content that does not affect how copy is written (cover pages, contents pages, page numbers, logo/colour/typography specs, legal footers).
- Do not add, invent, summarise away or reinterpret guidance.
- Output ONLY the markdown. No preamble, no code fences.`;

type Kind = 'pdf' | 'docx' | 'txt' | 'md';

function detectKind(file: File): Kind | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (file.type.includes('wordprocessingml.document') || ext === 'docx') return 'docx';
  if (ext === 'md' || ext === 'markdown' || file.type === 'text/markdown') return 'md';
  if (file.type === 'text/plain' || ext === 'txt') return 'txt';
  return null;
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '').trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const kind = detectKind(file);
    if (!kind) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, Word (.docx), text or markdown file.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 4MB — try exporting a smaller PDF or a .docx.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let markdown: string;
    let usedAI = false;
    let userId: string | undefined;

    if (kind === 'md') {
      markdown = buffer.toString('utf-8').trim();
    } else {
      const creditCheck = await withAICreditCheck(request, 1);
      if (!creditCheck.allowed || !creditCheck.userId) {
        return NextResponse.json(
          { error: creditCheck.error || 'AI credit limit reached' },
          { status: 403 }
        );
      }
      userId = creditCheck.userId;

      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
      }
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[];
      if (kind === 'pdf') {
        // Send the PDF itself so the model sees layout and any text baked into images.
        userContent = [
          { type: 'text', text: 'Transcribe this Tone of Voice guide into markdown.' },
          {
            type: 'file',
            file: {
              filename: file.name,
              file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
            },
          },
        ];
      } else {
        const source =
          kind === 'docx'
            ? (await mammoth.convertToHtml({ buffer })).value
            : buffer.toString('utf-8');
        if (!source.trim()) {
          return NextResponse.json({ error: 'No text could be read from this document.' }, { status: 400 });
        }
        userContent = [
          {
            type: 'text',
            text: `Transcribe this Tone of Voice guide (${kind === 'docx' ? 'converted from Word to HTML' : 'plain text'}) into markdown:\n\n${source.slice(0, 200000)}`,
          },
        ];
      }

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: 12000,
        temperature: 0,
        messages: [
          { role: 'system', content: TRANSCRIBE_PROMPT },
          { role: 'user', content: userContent },
        ],
      });

      markdown = stripCodeFences(completion.choices[0]?.message?.content || '');
      usedAI = true;
    }

    if (!markdown) {
      return NextResponse.json({ error: 'No tone of voice content could be read from this document.' }, { status: 422 });
    }
    if (markdown.length > MAX_TOV_CHARS) {
      markdown = markdown.slice(0, MAX_TOV_CHARS);
    }

    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        brand_tov: markdown,
        brand_tov_source_filename: file.name,
        brand_tov_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Failed to save tone of voice:', { error: updateError.message });
      return NextResponse.json(
        { error: `Failed to save tone of voice: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (usedAI && userId) {
      await trackAICreditUsage(userId, 1, 'transcribe_tone_of_voice', clientId, { fileType: kind });
    }

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error: unknown) {
    logger.error('Error transcribing tone of voice:', error);
    return NextResponse.json(
      {
        error: `Failed to transcribe tone of voice document: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
