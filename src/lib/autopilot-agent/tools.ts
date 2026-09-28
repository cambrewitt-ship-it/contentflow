import type OpenAI from 'openai';
import { CORPORATE_WORDS, countWords, countHashtags, countEmojis, endsWithQuestion } from '@/lib/preference-engine';
import type { StylePreferences } from '@/lib/preference-engine';
import type { BrandContext, GalleryItem, ContentEvent, RegionalHoliday } from './context';
import type { RunBrief } from './runBrief';

// ── Scratchpad candidate shape ──────────────────────────────────────────────
// What the agent accumulates via propose_post calls, persisted to
// autopilot_candidates once the run finalizes.

export interface ScratchpadPost {
  media_gallery_id: string;
  media_url: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  post_type: string | null;
  suggested_date: string | null;
  suggested_time: string | null;
  event_reference: string | null;
  season_tag: string | null;
  reasoning: string | null;
  // Paid-ad-copy fields — null for organic posts. Ad candidates never get a
  // calendar_scheduled_posts entry, so suggested_date/time stay null for them.
  ad_headline: string | null;
  ad_primary_text: string | null;
  ad_description: string | null;
  ad_platform: string | null;
}

// ── Run context ──────────────────────────────────────────────────────────────
// Everything is pre-fetched once before the loop starts (same DB round-trips
// as the old one-shot engine), then served to the model from memory as it
// calls tools — this keeps the loop's latency-per-iteration low since no tool
// call needs to hit the database.

export interface RunContext {
  clientId: string;
  startStr: string;
  endStr: string;
  candidateCount: number;
  season: string;
  hemisphere: string;
  brandCtx: BrandContext;
  gallery: GalleryItem[];
  galleryMap: Map<string, GalleryItem>;
  recentPosts: Array<{ caption: string | null; scheduled_date: string | null }>;
  events: ContentEvent[];
  holidays: RegionalHoliday[];
  stylePrefs: StylePreferences;
  scratchpad: { posts: ScratchpadPost[] };
  finalized: boolean;
  planSummary: string | null;
  // Paid ad copy — off by default per client.ad_copy_settings.
  adCopyEnabled: boolean;
  adCopyCount: number;
  adPlatform: string;
  // Per-run brief from the composer; null for cron runs (saved settings only).
  brief: RunBrief | null;
  // The client's caption playbook — rules from the agency's feedback on past posts.
  captionRules: string[];
}

// ── Tool schemas ─────────────────────────────────────────────────────────────
// propose_ad_copy is always offered, but gated at dispatch time by
// ctx.adCopyEnabled — the system prompt tells the model up front whether ad
// copy was requested for this run, and the dispatcher enforces it either way.

export const TOOL_DEFS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_brand_context',
      description:
        "Get this client's brand voice, audience, value proposition, caption dos/don'ts, and business details. Call this first.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_media_gallery',
      description:
        'Search the available, AI-analyzed photo gallery. Call with no filters to browse everything, or narrow by query/category/mood. Returns up to 15 results per call — call again with a different query to see more.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search against photo description, tags, and context (e.g. "coffee", "outdoor seating").' },
          category: { type: 'string', description: 'Filter by an AI-assigned category.' },
          mood: { type: 'string', description: 'Filter by an AI-assigned mood.' },
          limit: { type: 'integer', description: 'Max results to return (default 15, max 15).' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_posts',
      description: 'Get this client\'s posts from the last 14 days, so you avoid repeating topics or photos.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_events',
      description: "Get this specific client's manually-entered upcoming events (promotions, launches, closures) within the posting window.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_nz_context',
      description:
        "Get the client's hemisphere, current season, and any national public holidays falling in or shortly after the posting window — useful for seasonal and cultural relevance.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_style_preferences',
      description:
        'Get this client\'s learned caption style preferences from past swipe reviews (what they tend to like/dislike). Worth checking if this client has generated plans before.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_post',
      description: 'Add one post candidate to the pool. Only use media_gallery_id values returned by search_media_gallery.',
      parameters: {
        type: 'object',
        properties: {
          media_gallery_id: { type: 'string' },
          caption: { type: 'string', description: 'Full caption text WITHOUT hashtags — put those in the hashtags array.' },
          hashtags: { type: 'array', items: { type: 'string' } },
          platforms: { type: 'array', items: { type: 'string' } },
          post_type: { type: 'string', enum: ['promotional', 'engagement', 'seasonal', 'educational'] },
          suggested_date: { type: 'string', description: 'YYYY-MM-DD, must fall within the posting window.' },
          suggested_time: { type: 'string', description: 'HH:mm' },
          event_reference: { type: ['string', 'null'] },
          season_tag: { type: ['string', 'null'] },
          reasoning: { type: 'string', description: 'Why this photo, angle, and timing.' },
        },
        required: ['media_gallery_id', 'caption', 'suggested_date'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_ad_copy',
      description:
        'Add one paid-ad-copy candidate to the pool. Only call this if asked to generate ad copy. Not scheduled to the calendar — this is text for a human to paste into Meta/Google Ads Manager. Only use media_gallery_id values returned by search_media_gallery.',
      parameters: {
        type: 'object',
        properties: {
          media_gallery_id: { type: 'string' },
          ad_platform: { type: 'string', enum: ['meta', 'google'] },
          ad_headline: { type: 'string', description: 'Short punchy headline. Meta: ~40 characters max.' },
          ad_primary_text: { type: 'string', description: 'Main ad body copy. Meta: ~125 characters recommended before truncation.' },
          ad_description: { type: 'string', description: 'Optional short supporting line. Meta: ~30 characters.' },
          reasoning: { type: 'string', description: 'Why this photo and angle for a paid placement.' },
        },
        required: ['media_gallery_id', 'ad_platform', 'ad_headline', 'ad_primary_text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'critique_own_draft',
      description:
        'Check a caption draft against this brand\'s quality rules (corporate language, hashtag count, emoji use, length) before proposing it. Cheap — use it whenever unsure.',
      parameters: {
        type: 'object',
        properties: {
          caption: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['caption'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_candidate_pool',
      description: 'Call this once you have proposed enough candidates and are done. This ends the run.',
      parameters: {
        type: 'object',
        properties: {
          plan_summary: { type: 'string', description: 'Brief 1-2 sentence summary of the candidate pool for the account manager.' },
        },
        required: ['plan_summary'],
        additionalProperties: false,
      },
    },
  },
];

// The loop hands the model all context up front (buildContextBriefing), so it
// only needs the tools that act. The get_* and critique tools stay defined and
// dispatchable, but aren't offered — each one used to cost a full turn.
const AGENT_TOOL_NAMES = new Set(['search_media_gallery', 'propose_post', 'propose_ad_copy', 'finalize_candidate_pool']);
export const AGENT_TOOL_DEFS = TOOL_DEFS.filter(
  t => t.type === 'function' && AGENT_TOOL_NAMES.has(t.function.name)
);

/** Everything the get_* tools would return, gathered once for the first message. */
export function buildContextBriefing(ctx: RunContext): string {
  const section = (title: string, data: unknown) => `## ${title}\n${JSON.stringify(data)}`;
  return [
    section('Brand context', dispatchTool('get_brand_context', '{}', ctx)),
    section('Photo gallery (every available photo — use these ids)', ctx.gallery.map(trimmedGalleryItem)),
    section('Upcoming events in the window', dispatchTool('get_upcoming_events', '{}', ctx)),
    section('Season and holidays', dispatchTool('get_nz_context', '{}', ctx)),
    section('Style preferences and account manager feedback', dispatchTool('get_style_preferences', '{}', ctx)),
    section('Recent posts (last 14 days — avoid repeating these)', dispatchTool('get_recent_posts', '{}', ctx)),
  ].join('\n\n');
}

/** True once the pool has everything the run asked for. */
export function poolIsFull(ctx: RunContext): boolean {
  const ads = ctx.scratchpad.posts.filter(p => p.post_type === 'paid_ad').length;
  const organic = ctx.scratchpad.posts.length - ads;
  return organic >= ctx.candidateCount && (!ctx.adCopyEnabled || ads >= ctx.adCopyCount);
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

function trimmedGalleryItem(g: GalleryItem) {
  return {
    id: g.id,
    description: g.ai_description || 'none',
    tags: g.ai_tags || [],
    mood: g.ai_mood || 'none',
    categories: g.ai_categories || [],
    context: g.user_context || 'none',
    times_used: g.times_used,
  };
}

// ── Photo variety within a pool ─────────────────────────────────────────────
// Organic posts and ad variants each get their own variety check (an ad may
// reuse a photo from an organic post). A photo can only repeat within a type
// once the pool is bigger than the gallery.

function photoUsesInPool(ctx: RunContext, mediaGalleryId: string, isAd: boolean): number {
  return ctx.scratchpad.posts.filter(
    p => p.media_gallery_id === mediaGalleryId && (p.post_type === 'paid_ad') === isAd
  ).length;
}

function photoVarietyError(
  ctx: RunContext,
  mediaGalleryId: string,
  isAd: boolean
): { success: false; error: string; unused_photos: ReturnType<typeof trimmedGalleryItem>[] } | null {
  const poolSize = isAd ? ctx.adCopyCount : ctx.candidateCount;
  const maxUses = Math.max(1, Math.ceil(poolSize / Math.max(1, ctx.gallery.length)));
  const uses = photoUsesInPool(ctx, mediaGalleryId, isAd);
  if (uses < maxUses) return null;

  const unused = ctx.gallery
    .filter(g => photoUsesInPool(ctx, g.id, isAd) === 0)
    .sort((a, b) => a.times_used - b.times_used)
    .slice(0, 8)
    .map(trimmedGalleryItem);
  return {
    success: false,
    error: `That photo is already used in this pool — every ${isAd ? 'ad variant' : 'post'} needs a different photo. Pick one of these unused photos (or search again) and write the copy for it.`,
    unused_photos: unused,
  };
}

function critique(
  caption: string,
  hashtags: string[] | undefined,
  brief: RunBrief | null
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  if (caption.length > 2200) violations.push('Caption exceeds the 2200 character platform limit.');
  if (countWords(caption) < 5) violations.push('Caption is too short to be a real post.');

  const corpWords = CORPORATE_WORDS.filter(w => caption.toLowerCase().includes(w));
  if (corpWords.length > 0) {
    violations.push(`Corporate/generic language detected (${corpWords.join(', ')}) — write like a person, not a press release.`);
  }

  if (/#\w+/.test(caption)) {
    violations.push('Caption text contains inline hashtags — put all hashtags in the hashtags array instead.');
  }

  const tagCount = hashtags?.length ?? countHashtags(caption);
  if (tagCount > 5) {
    violations.push(`${tagCount} hashtags — max 5, and every one must be directly relevant to this specific post’s topic, not the brand’s region or unrelated services.`);
  }

  if (brief && !brief.useHashtags && tagCount > 0) {
    violations.push('This run asked for no hashtags — leave the hashtags array empty.');
  }

  const emojiCount = countEmojis(caption);
  if (brief && !brief.useEmojis && emojiCount > 0) {
    violations.push('This run asked for no emojis — remove them.');
  } else if (emojiCount > 6) {
    violations.push('Excessive emoji use.');
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Executes one tool call against the run context, mutating ctx.scratchpad /
 * ctx.finalized / ctx.planSummary as a side effect where relevant. Returns the
 * JSON-serializable content to send back as the tool result message.
 */
export function dispatchTool(name: string, argsJson: string, ctx: RunContext): unknown {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { error: 'Could not parse tool arguments as JSON.' };
  }

  switch (name) {
    case 'get_brand_context': {
      const { client, documents, website } = ctx.brandCtx;
      if (!client) return { error: 'No client record found.' };
      return {
        name: client.name,
        company_description: client.company_description,
        brand_tone: client.brand_tone,
        target_audience: client.target_audience,
        value_proposition: client.value_proposition,
        caption_dos: client.caption_dos,
        caption_donts: client.caption_donts,
        brand_voice_examples: client.brand_voice_examples,
        tone_of_voice_guide: client.brand_tov,
        caption_playbook: ctx.captionRules,
        region: client.region,
        business_context: client.business_context,
        posting_preferences: client.posting_preferences,
        operating_hours: client.operating_hours,
        brand_documents: documents.map(d => d.extracted_text?.substring(0, 500)).filter(Boolean),
        website: website ? { title: website.page_title, excerpt: website.scraped_content?.substring(0, 400) } : null,
      };
    }

    case 'search_media_gallery': {
      const query = typeof args.query === 'string' ? args.query.toLowerCase() : null;
      const category = typeof args.category === 'string' ? args.category.toLowerCase() : null;
      const mood = typeof args.mood === 'string' ? args.mood.toLowerCase() : null;
      const limit = Math.min(15, typeof args.limit === 'number' ? args.limit : 15);

      const filtered = ctx.gallery.filter(g => {
        if (mood && (g.ai_mood || '').toLowerCase() !== mood) return false;
        if (category && !(g.ai_categories || []).some(c => c.toLowerCase() === category)) return false;
        if (query) {
          const haystack = [
            g.ai_description || '',
            g.user_context || '',
            ...(g.ai_tags || []),
            ...(g.ai_categories || []),
          ].join(' ').toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });

      // Surface unused photos first when the brief asks for fresh media
      // (stable sort keeps the freshness_score order within each group).
      if (ctx.brief?.preferFreshMedia) {
        filtered.sort((a, b) => Number(a.times_used > 0) - Number(b.times_used > 0));
      }

      return {
        total_available: ctx.gallery.length,
        matched: filtered.length,
        // Photos the pool already uses sort last, so the agent sees fresh options first
        results: filtered
          .map(g => ({ g, used: photoUsesInPool(ctx, g.id, false) + photoUsesInPool(ctx, g.id, true) }))
          .sort((a, b) => Number(a.used > 0) - Number(b.used > 0))
          .slice(0, limit)
          .map(({ g, used }) => ({ ...trimmedGalleryItem(g), used_in_this_pool: used })),
      };
    }

    case 'get_recent_posts':
      return {
        posts: ctx.recentPosts.map(p => ({
          date: p.scheduled_date,
          caption_excerpt: (p.caption || '').substring(0, 120),
        })),
      };

    case 'get_upcoming_events':
      return {
        events: ctx.events.map(e => ({
          date: e.event_date,
          title: e.title,
          type: e.event_type,
          content_angle: e.content_angle,
          description: e.description,
        })),
      };

    case 'get_nz_context':
      return {
        hemisphere: ctx.hemisphere,
        current_season: ctx.season,
        holidays: ctx.holidays.map(h => ({ date: h.holiday_date, name: h.name })),
      };

    case 'get_style_preferences':
      if (!ctx.stylePrefs.hasEnoughData) {
        return {
          has_enough_data: false,
          note: 'Not enough swipe history for statistics yet — use default brand voice, but follow any feedback and edits below.',
          account_manager_feedback: ctx.stylePrefs.recentFeedback,
          account_manager_edits: ctx.stylePrefs.recentEdits,
        };
      }
      return {
        account_manager_feedback: ctx.stylePrefs.recentFeedback,
        account_manager_edits: ctx.stylePrefs.recentEdits,
        has_enough_data: true,
        liked_examples: ctx.stylePrefs.topLikedExamples,
        disliked_examples: ctx.stylePrefs.topDislikedExamples,
        preferred_caption_length_words: ctx.stylePrefs.avgLikedCaptionLength,
        preferred_hashtag_count: ctx.stylePrefs.avgLikedHashtagCount,
        preferred_post_types: ctx.stylePrefs.preferredPostTypes,
        avoided_post_types: ctx.stylePrefs.avoidedPostTypes,
        tone_notes: ctx.stylePrefs.toneNotes,
      };

    case 'propose_post': {
      if (ctx.candidateCount === 0) {
        return { success: false, error: 'This run is paid ads only — use propose_ad_copy instead.' };
      }
      const organicCount = ctx.scratchpad.posts.filter(p => p.post_type !== 'paid_ad').length;
      if (organicCount >= ctx.candidateCount) {
        return { success: false, error: `The pool already has ${organicCount} posts (target ${ctx.candidateCount}) — no more needed.` };
      }

      const mediaGalleryId = typeof args.media_gallery_id === 'string' ? args.media_gallery_id : null;
      const caption = typeof args.caption === 'string' ? args.caption.trim() : '';
      const suggestedDate = typeof args.suggested_date === 'string' ? args.suggested_date : null;

      if (!mediaGalleryId || !ctx.galleryMap.has(mediaGalleryId)) {
        return { success: false, error: 'Unknown media_gallery_id. Call search_media_gallery to find valid IDs.' };
      }
      if (!caption) {
        return { success: false, error: 'caption is required.' };
      }
      if (!suggestedDate || suggestedDate < ctx.startStr || suggestedDate > ctx.endStr) {
        return { success: false, error: `suggested_date must be between ${ctx.startStr} and ${ctx.endStr}.` };
      }
      const postType = typeof args.post_type === 'string' ? args.post_type : null;
      const goals: string[] = ctx.brief?.goals ?? [];
      if (postType && goals.length > 0 && !goals.includes(postType)) {
        return { success: false, error: `This run only wants these post_types: ${goals.join(', ')}.` };
      }

      // Pool-level variety: closing every post with a question reads as a formula
      const organicPosts = ctx.scratchpad.posts.filter(p => p.post_type !== 'paid_ad');
      const questionEndings = organicPosts.filter(p => endsWithQuestion(p.caption)).length;
      if (endsWithQuestion(caption) && questionEndings + 1 > Math.max(1, Math.floor(ctx.candidateCount / 3))) {
        return {
          success: false,
          error: `Too many captions end with a question (${questionEndings} already). End this one differently — a statement, an invitation, or a direct call to action — and propose it again.`,
        };
      }

      const organicPhotoError = photoVarietyError(ctx, mediaGalleryId, false);
      if (organicPhotoError) return organicPhotoError;

      // The quality check runs here rather than as its own turn (critique_own_draft)
      const proposedHashtags = Array.isArray(args.hashtags) ? (args.hashtags as string[]) : [];
      const check = critique(caption, proposedHashtags, ctx.brief);
      if (!check.passed) {
        return { success: false, error: 'Caption failed the quality check — fix these and propose it again.', violations: check.violations };
      }

      const galleryItem = ctx.galleryMap.get(mediaGalleryId)!;
      const suggestedTimeRaw = typeof args.suggested_time === 'string' ? args.suggested_time : '';
      const suggestedTime = suggestedTimeRaw.includes(':') ? suggestedTimeRaw : '12:00';

      ctx.scratchpad.posts.push({
        media_gallery_id: mediaGalleryId,
        media_url: galleryItem.media_url,
        caption,
        hashtags: Array.isArray(args.hashtags) && ctx.brief?.useHashtags !== false ? (args.hashtags as string[]) : [],
        platforms: ctx.brief?.platforms.length
          ? [...ctx.brief.platforms]
          : Array.isArray(args.platforms) ? (args.platforms as string[]) : [],
        post_type: postType,
        suggested_date: suggestedDate,
        suggested_time: suggestedTime,
        event_reference: typeof args.event_reference === 'string' ? args.event_reference : null,
        season_tag: typeof args.season_tag === 'string' ? args.season_tag : null,
        reasoning: typeof args.reasoning === 'string' ? args.reasoning : null,
        ad_headline: null,
        ad_primary_text: null,
        ad_description: null,
        ad_platform: null,
      });

      return { success: true, accepted_count: ctx.scratchpad.posts.length, target: ctx.candidateCount };
    }

    case 'propose_ad_copy': {
      if (!ctx.adCopyEnabled) {
        return { success: false, error: 'Ad copy was not requested for this run — skip propose_ad_copy and use propose_post instead.' };
      }

      const mediaGalleryId = typeof args.media_gallery_id === 'string' ? args.media_gallery_id : null;
      const headline = typeof args.ad_headline === 'string' ? args.ad_headline.trim() : '';
      const primaryText = typeof args.ad_primary_text === 'string' ? args.ad_primary_text.trim() : '';
      const platform = typeof args.ad_platform === 'string' ? args.ad_platform : ctx.adPlatform;

      if (!mediaGalleryId || !ctx.galleryMap.has(mediaGalleryId)) {
        return { success: false, error: 'Unknown media_gallery_id. Call search_media_gallery to find valid IDs.' };
      }
      if (!headline || !primaryText) {
        return { success: false, error: 'ad_headline and ad_primary_text are both required.' };
      }

      const adCandidateCount = ctx.scratchpad.posts.filter(p => p.ad_headline !== null).length;
      if (adCandidateCount >= ctx.adCopyCount) {
        return { success: false, error: `Already have ${adCandidateCount} ad copy candidates (target ${ctx.adCopyCount}) — no more needed.` };
      }

      const adPhotoError = photoVarietyError(ctx, mediaGalleryId, true);
      if (adPhotoError) return adPhotoError;

      const adCheck = critique(primaryText, [], ctx.brief);
      if (!adCheck.passed) {
        return { success: false, error: 'Ad copy failed the quality check — fix these and propose it again.', violations: adCheck.violations };
      }

      const galleryItem = ctx.galleryMap.get(mediaGalleryId)!;

      ctx.scratchpad.posts.push({
        media_gallery_id: mediaGalleryId,
        media_url: galleryItem.media_url,
        caption: primaryText,
        hashtags: [],
        platforms: [],
        post_type: 'paid_ad',
        suggested_date: null,
        suggested_time: null,
        event_reference: null,
        season_tag: null,
        reasoning: typeof args.reasoning === 'string' ? args.reasoning : null,
        ad_headline: headline,
        ad_primary_text: primaryText,
        ad_description: typeof args.ad_description === 'string' ? args.ad_description.trim() : null,
        ad_platform: platform,
      });

      return { success: true, accepted_count: adCandidateCount + 1, target: ctx.adCopyCount };
    }

    case 'critique_own_draft': {
      const caption = typeof args.caption === 'string' ? args.caption : '';
      const hashtags = Array.isArray(args.hashtags) ? (args.hashtags as string[]) : undefined;
      return critique(caption, hashtags, ctx.brief);
    }

    case 'finalize_candidate_pool': {
      if (ctx.scratchpad.posts.length === 0) {
        return { success: false, error: 'No candidates proposed yet — call propose_post before finalizing.' };
      }
      ctx.finalized = true;
      ctx.planSummary = typeof args.plan_summary === 'string' ? args.plan_summary : `${ctx.scratchpad.posts.length} candidates generated.`;
      return { success: true, total_candidates: ctx.scratchpad.posts.length };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
