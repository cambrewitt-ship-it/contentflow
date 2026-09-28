import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { FEEDBACK_TAGS } from '@/lib/captionFeedback';

export interface StylePreferences {
  totalLiked: number;
  totalDisliked: number;
  hasEnoughData: boolean;

  avgLikedCaptionLength: number;
  avgDislikedCaptionLength: number;
  avgLikedHashtagCount: number;
  avgDislikedHashtagCount: number;
  preferredPostTypes: string[];
  avoidedPostTypes: string[];

  topLikedExamples: Array<{ caption: string; post_type: string; event_context: string | null }>;
  topDislikedExamples: Array<{ caption: string; post_type: string; reason: string }>;

  // What the account manager actually said, and how they rewrote captions.
  // Returned regardless of hasEnoughData — explicit feedback is useful from day one.
  recentFeedback: Array<{ caption_excerpt: string; kept: boolean; feedback: string }>;
  recentEdits: Array<{ ai_wrote: string; they_changed_it_to: string }>;

  toneNotes: string;
}

interface PreferenceRow {
  caption: string;
  post_type: string | null;
  liked: boolean;
  event_context: string | null;
  caption_word_count: number | null;
  hashtag_count: number | null;
  created_at: string;
  feedback?: string | null;
  feedback_tags?: string[] | null;
  original_caption?: string | null;
}

export const endsWithQuestion = (caption: string) => /\?\s*(\p{Extended_Pictographic}\s*)*$/u.test(caption.trim());

function feedbackText(row: PreferenceRow): string | null {
  const tagLabels = (row.feedback_tags ?? [])
    .map(t => FEEDBACK_TAGS[t as keyof typeof FEEDBACK_TAGS]?.label)
    .filter(Boolean);
  const parts = [tagLabels.join(', '), row.feedback?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : null;
}

export const CORPORATE_WORDS = [
  'discover', 'leverage', 'solutions', 'elevate', 'unlock',
  'synergy', 'innovative', 'seamless', 'holistic', 'empower',
];

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countHashtags(text: string): number {
  return (text.match(/#\w+/g) || []).length;
}

export function countEmojis(text: string): number {
  return (text.match(EMOJI_REGEX) || []).length;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function inferDislikeReason(caption: string): string {
  const reasons: string[] = [];

  const wordCount = countWords(caption);
  if (wordCount > 150) reasons.push('too long');
  if (wordCount < 10) reasons.push('too short');

  if (countHashtags(caption) > 8) reasons.push('too many hashtags');

  const corpWords = CORPORATE_WORDS.filter(w => caption.toLowerCase().includes(w));
  if (corpWords.length > 0) reasons.push(`corporate language (${corpWords.join(', ')})`);

  if (countEmojis(caption) > 6) reasons.push('excessive emoji use');

  return reasons.length > 0 ? reasons.join('; ') : 'style mismatch';
}

function deriveToneNotes(
  liked: Array<{ caption: string }>,
  disliked: Array<{ caption: string }>
): string {
  if (liked.length === 0) return 'No preference data yet.';

  const avgWords = avg(liked.map(l => countWords(l.caption)));
  const avgEmojis = avg(liked.map(l => countEmojis(l.caption)));
  const avgHashtags = avg(liked.map(l => countHashtags(l.caption)));

  // Compare against skipped posts: a high rate among kept posts alone is just
  // the agent's own habit echoing back (it writes questions, some get kept).
  const questionEndRate = (rows: Array<{ caption: string }>) =>
    rows.length > 0 ? rows.filter(r => endsWithQuestion(r.caption)).length / rows.length : 0;
  const likedQuestionRate = questionEndRate(liked);
  const dislikedQuestionRate = questionEndRate(disliked);
  const exclamationRate = liked.filter(l => l.caption.includes('!')).length / liked.length;
  const likedCorporateCount = liked.filter(l =>
    CORPORATE_WORDS.some(w => l.caption.toLowerCase().includes(w))
  ).length;

  const notes: string[] = [];

  if (avgWords < 40) {
    notes.push('Prefers concise captions (under 40 words)');
  } else if (avgWords > 100) {
    notes.push('Prefers longer, story-driven captions');
  } else {
    notes.push(`Prefers medium-length captions (~${Math.round(avgWords)} words)`);
  }

  if (disliked.length >= 3 && dislikedQuestionRate > likedQuestionRate + 0.25) {
    notes.push('captions ending in a question tend to get skipped — end most posts another way');
  } else if (disliked.length >= 3 && likedQuestionRate > dislikedQuestionRate + 0.25) {
    notes.push('an occasional closing question works (still vary endings)');
  }
  if (exclamationRate > 0.5) notes.push('energetic tone with exclamation points resonates');

  if (avgEmojis > 3) notes.push('emoji-rich captions perform better');
  else if (avgEmojis < 1) notes.push('minimal emoji use preferred');

  if (avgHashtags <= 5) notes.push('fewer, targeted hashtags preferred');

  if (likedCorporateCount === 0 && liked.length >= 5) notes.push('avoids corporate language');

  if (disliked.length > 0) {
    const dislikedCorporateCount = disliked.filter(d =>
      CORPORATE_WORDS.some(w => d.caption.toLowerCase().includes(w))
    ).length;
    if (dislikedCorporateCount > disliked.length * 0.3) {
      notes.push('rejects corporate/generic language ("discover", "leverage", etc.)');
    }
  }

  return notes.join('. ') + '.';
}

export async function getStylePreferences(clientId: string): Promise<StylePreferences> {
  const admin = createSupabaseAdmin();

  const baseColumns = 'caption, post_type, liked, event_context, caption_word_count, hashtag_count, created_at';
  const query = (columns: string) =>
    admin
      .from('content_preferences')
      .select(columns)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
  let { data, error } = await query(`${baseColumns}, feedback, feedback_tags, original_caption`);
  // Feedback columns arrive with migration 027 — fall back until it's run
  if (error) ({ data, error } = await query(baseColumns));

  const prefs = (data ?? []) as unknown as PreferenceRow[];
  const liked = prefs.filter(p => p.liked);
  const disliked = prefs.filter(p => !p.liked);

  const totalLiked = liked.length;
  const totalDisliked = disliked.length;
  const hasEnoughData = totalLiked + totalDisliked >= 10;

  const avgLikedCaptionLength = avg(liked.map(p => p.caption_word_count ?? countWords(p.caption)));
  const avgDislikedCaptionLength = avg(disliked.map(p => p.caption_word_count ?? countWords(p.caption)));
  const avgLikedHashtagCount = avg(liked.map(p => p.hashtag_count ?? countHashtags(p.caption)));
  const avgDislikedHashtagCount = avg(disliked.map(p => p.hashtag_count ?? countHashtags(p.caption)));

  // Per post_type like rates (require ≥3 examples to be meaningful)
  const postTypeStats: Record<string, { liked: number; total: number }> = {};
  for (const p of prefs) {
    if (!p.post_type) continue;
    if (!postTypeStats[p.post_type]) postTypeStats[p.post_type] = { liked: 0, total: 0 };
    postTypeStats[p.post_type].total++;
    if (p.liked) postTypeStats[p.post_type].liked++;
  }

  const preferredPostTypes = Object.entries(postTypeStats)
    .filter(([, s]) => s.total >= 3 && s.liked / s.total > 0.6)
    .map(([type]) => type);

  const avoidedPostTypes = Object.entries(postTypeStats)
    .filter(([, s]) => s.total >= 3 && s.liked / s.total < 0.3)
    .map(([type]) => type);

  const topLikedExamples = liked.slice(0, 5).map(p => ({
    caption: p.caption,
    post_type: p.post_type ?? 'unknown',
    event_context: p.event_context ?? null,
  }));

  const topDislikedExamples = disliked.slice(0, 5).map(p => ({
    caption: p.caption,
    post_type: p.post_type ?? 'unknown',
    reason: feedbackText(p) ?? `inferred: ${inferDislikeReason(p.caption)}`,
  }));

  const recentFeedback = prefs
    .filter(p => feedbackText(p))
    .slice(0, 8)
    .map(p => ({
      caption_excerpt: p.caption.substring(0, 160),
      kept: p.liked,
      feedback: feedbackText(p)!,
    }));

  const recentEdits = prefs
    .filter(p => p.original_caption && p.original_caption !== p.caption)
    .slice(0, 3)
    .map(p => ({ ai_wrote: p.original_caption!, they_changed_it_to: p.caption }));

  const toneNotes = hasEnoughData
    ? deriveToneNotes(liked, disliked)
    : 'Not enough data yet for tone analysis.';

  return {
    totalLiked,
    totalDisliked,
    hasEnoughData,
    avgLikedCaptionLength: Math.round(avgLikedCaptionLength),
    avgDislikedCaptionLength: Math.round(avgDislikedCaptionLength),
    avgLikedHashtagCount: Math.round(avgLikedHashtagCount * 10) / 10,
    avgDislikedHashtagCount: Math.round(avgDislikedHashtagCount * 10) / 10,
    preferredPostTypes,
    avoidedPostTypes,
    topLikedExamples,
    topDislikedExamples,
    recentFeedback,
    recentEdits,
    toneNotes,
  };
}

export async function recordPreference(params: {
  clientId: string;
  userId: string;
  mediaGalleryId: string | null;
  caption: string;
  postType: string;
  platforms: string[];
  eventContext: string | null;
  seasonContext: string | null;
  liked: boolean;
  autopilotPlanId: string | null;
  feedback?: string | null;
  feedbackTags?: string[];
  originalCaption?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdmin();

  await admin.from('content_preferences').insert({
    client_id: params.clientId,
    user_id: params.userId,
    media_gallery_id: params.mediaGalleryId,
    caption: params.caption,
    post_type: params.postType,
    platforms: params.platforms,
    event_context: params.eventContext,
    season_context: params.seasonContext,
    liked: params.liked,
    caption_word_count: countWords(params.caption),
    hashtag_count: countHashtags(params.caption),
    emoji_count: countEmojis(params.caption),
    autopilot_plan_id: params.autopilotPlanId,
    // Only sent when present, so rows still save before migration 027 is run
    ...(params.feedback ? { feedback: params.feedback } : {}),
    ...(params.feedbackTags?.length ? { feedback_tags: params.feedbackTags } : {}),
    ...(params.originalCaption ? { original_caption: params.originalCaption } : {}),
  });
}
