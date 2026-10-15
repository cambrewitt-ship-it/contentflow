import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

// Captions from a client's own calendar that show their real voice: posts
// that were approved or published, and posts a person edited. Unreviewed AI
// drafts are left out so the AI doesn't learn from its own output.

const SCAN_LIMIT = 80;
const MAX_CAPTIONS = 8;
const MAX_CAPTION_CHARS = 700;

interface CalendarPostRow {
  caption: string | null;
  original_caption: string | null;
  approval_status: string | null;
  late_status: string | null;
  scheduled_date: string | null;
}

function score(post: CalendarPostRow): number {
  const caption = post.caption?.trim() ?? '';
  const edited = !!post.original_caption && post.original_caption.trim() !== caption;
  const approved = post.approval_status === 'approved' || post.late_status === 'published';
  // A person rewriting the caption is the strongest signal of the voice they want
  return (edited ? 2 : 0) + (approved ? 1 : 0);
}

export async function getCalendarVoiceCaptions(clientId: string): Promise<string[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('calendar_scheduled_posts')
    .select('caption, original_caption, approval_status, late_status, scheduled_date')
    .eq('client_id', clientId)
    .not('caption', 'is', null)
    .order('scheduled_date', { ascending: false })
    .limit(SCAN_LIMIT);

  if (error) {
    logger.warn('Calendar voice: could not load captions', { clientId, error: error.message });
    return [];
  }

  const seen = new Set<string>();
  return ((data ?? []) as CalendarPostRow[])
    .filter(p => p.approval_status !== 'rejected' && p.approval_status !== 'needs_attention')
    .map(p => ({ post: p, score: score(p) }))
    .filter(p => p.score > 0)
    // Stable sort keeps newest first within each score
    .sort((a, b) => b.score - a.score)
    .map(p => p.post.caption!.trim().slice(0, MAX_CAPTION_CHARS))
    .filter(caption => {
      const key = caption.toLowerCase();
      if (caption.length < 20 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CAPTIONS);
}

export function formatCalendarVoicePromptSection(captions: string[]): string {
  if (captions.length === 0) return '';
  return `CAPTIONS THIS BRAND HAS APPROVED OR PUBLISHED — the clearest evidence of how they really sound. Match their voice (length, rhythm, vocabulary, emoji and hashtag habits, how they open and sign off), but write new sentences and don't repeat their topics.
<approved_captions>
${captions.map(c => `---\n${c}`).join('\n')}
</approved_captions>`;
}
