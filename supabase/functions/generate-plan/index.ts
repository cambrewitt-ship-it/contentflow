import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js';
import { Resend } from 'npm:resend';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function createAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOUTHERN_HEMISPHERE_REGIONS = [
  'new zealand', 'nz', 'australia', 'au', 'south africa', 'za',
  'argentina', 'brazil', 'chile', 'peru', 'uruguay', 'paraguay',
  'bolivia', 'ecuador', 'fiji', 'papua new guinea', 'new caledonia',
  'vanuatu', 'solomon islands', 'tonga', 'samoa', 'madagascar',
  'mozambique', 'zimbabwe', 'zambia', 'namibia', 'botswana', 'lesotho',
  'eswatini', 'malawi', 'tanzania', 'kenya', 'indonesia', 'timor-leste',
];

function inferHemisphere(hemisphere?: string | null, region?: string | null): string {
  if (hemisphere === 'southern' || hemisphere === 'northern') return hemisphere;
  if (region) {
    const lower = region.toLowerCase();
    if (SOUTHERN_HEMISPHERE_REGIONS.some(r => lower.includes(r))) return 'southern';
  }
  return 'northern';
}

function deriveSeason(hemisphere: string, date: Date): string {
  const month = date.getUTCMonth() + 1;
  const isSouthern = hemisphere === 'southern';
  if (isSouthern) {
    if (month >= 12 || month <= 2) return 'summer';
    if (month >= 3 && month <= 5) return 'autumn';
    if (month >= 6 && month <= 8) return 'winter';
    return 'spring';
  } else {
    if (month >= 12 || month <= 2) return 'winter';
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    return 'autumn';
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function nextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ── Style preferences (ported from preference-engine.ts) ──────────────────────

const CORPORATE_WORDS = ['discover', 'leverage', 'solutions', 'elevate', 'unlock', 'synergy', 'innovative', 'seamless', 'holistic', 'empower'];
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

function countWords(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length; }
function countHashtags(text: string): number { return (text.match(/#\w+/g) || []).length; }
function countEmojis(text: string): number { return (text.match(EMOJI_REGEX) || []).length; }
function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

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

function deriveToneNotes(liked: Array<{ caption: string }>, disliked: Array<{ caption: string }>): string {
  if (liked.length === 0) return 'No preference data yet.';
  const avgWords = avg(liked.map(l => countWords(l.caption)));
  const avgEmojis = avg(liked.map(l => countEmojis(l.caption)));
  const avgHashtags = avg(liked.map(l => countHashtags(l.caption)));
  const questionRate = liked.filter(l => l.caption.includes('?')).length / liked.length;
  const exclamationRate = liked.filter(l => l.caption.includes('!')).length / liked.length;
  const likedCorporateCount = liked.filter(l => CORPORATE_WORDS.some(w => l.caption.toLowerCase().includes(w))).length;
  const notes: string[] = [];
  if (avgWords < 40) notes.push('Prefers concise captions (under 40 words)');
  else if (avgWords > 100) notes.push('Prefers longer, story-driven captions');
  else notes.push(`Prefers medium-length captions (~${Math.round(avgWords)} words)`);
  if (questionRate > 0.4) notes.push('engagement-style questions work well');
  if (exclamationRate > 0.5) notes.push('energetic tone with exclamation points resonates');
  if (avgEmojis > 3) notes.push('emoji-rich captions perform better');
  else if (avgEmojis < 1) notes.push('minimal emoji use preferred');
  if (avgHashtags <= 5) notes.push('fewer, targeted hashtags preferred');
  if (likedCorporateCount === 0 && liked.length >= 5) notes.push('avoids corporate language');
  if (disliked.length > 0) {
    const dislikedCorporateCount = disliked.filter(d => CORPORATE_WORDS.some(w => d.caption.toLowerCase().includes(w))).length;
    if (dislikedCorporateCount > disliked.length * 0.3) notes.push('rejects corporate/generic language ("discover", "leverage", etc.)');
  }
  return notes.join('. ') + '.';
}

async function getStylePreferences(clientId: string) {
  const admin = createAdmin();
  const { data } = await admin
    .from('content_preferences')
    .select('caption, post_type, liked, event_context, caption_word_count, hashtag_count, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  const prefs = data ?? [];
  const liked = prefs.filter((p: { liked: boolean }) => p.liked);
  const disliked = prefs.filter((p: { liked: boolean }) => !p.liked);
  const totalLiked = liked.length;
  const totalDisliked = disliked.length;
  const hasEnoughData = totalLiked + totalDisliked >= 10;

  const avgLikedCaptionLength = avg(liked.map((p: { caption_word_count?: number; caption: string }) => p.caption_word_count ?? countWords(p.caption)));
  const avgDislikedCaptionLength = avg(disliked.map((p: { caption_word_count?: number; caption: string }) => p.caption_word_count ?? countWords(p.caption)));
  const avgLikedHashtagCount = avg(liked.map((p: { hashtag_count?: number; caption: string }) => p.hashtag_count ?? countHashtags(p.caption)));
  const avgDislikedHashtagCount = avg(disliked.map((p: { hashtag_count?: number; caption: string }) => p.hashtag_count ?? countHashtags(p.caption)));

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

  const topLikedExamples = liked.slice(0, 5).map((p: { caption: string; post_type?: string; event_context?: string }) => ({
    caption: p.caption, post_type: p.post_type ?? 'unknown', event_context: p.event_context ?? null,
  }));

  const topDislikedExamples = disliked.slice(0, 5).map((p: { caption: string; post_type?: string }) => ({
    caption: p.caption, post_type: p.post_type ?? 'unknown', reason_inferred: inferDislikeReason(p.caption),
  }));

  const toneNotes = hasEnoughData ? deriveToneNotes(liked, disliked) : 'Not enough data yet for tone analysis.';

  return {
    totalLiked, totalDisliked, hasEnoughData,
    avgLikedCaptionLength: Math.round(avgLikedCaptionLength),
    avgDislikedCaptionLength: Math.round(avgDislikedCaptionLength),
    avgLikedHashtagCount: Math.round(avgLikedHashtagCount * 10) / 10,
    avgDislikedHashtagCount: Math.round(avgDislikedHashtagCount * 10) / 10,
    preferredPostTypes, avoidedPostTypes, topLikedExamples, topDislikedExamples, toneNotes,
  };
}

function formatPreferencesForPrompt(prefs: Awaited<ReturnType<typeof getStylePreferences>>): string {
  if (!prefs.hasEnoughData) return '## Style Preferences\nNo preference data yet — generating with default brand voice.';
  const total = prefs.totalLiked + prefs.totalDisliked;
  const likedExamplesText = prefs.topLikedExamples.map((e: { caption: string; post_type: string }) => `"${e.caption.substring(0, 200)}" [Type: ${e.post_type}]`).join('\n');
  const dislikedExamplesText = prefs.topDislikedExamples.map((e: { caption: string; post_type: string; reason_inferred: string }) => `"${e.caption.substring(0, 200)}" [Type: ${e.post_type}] — Why avoided: ${e.reason_inferred}`).join('\n');
  const preferredTypes = prefs.preferredPostTypes.length > 0 ? prefs.preferredPostTypes.join(', ') : 'no strong preference yet';
  return `## Style Preferences (from ${total} previous reviews)\n\nCAPTIONS THE CLIENT LIKED — match this style:\n\n${likedExamplesText}\n\nCAPTIONS THE CLIENT DISLIKED — avoid this style:\n\n${dislikedExamplesText}\n\nSTYLE PATTERNS:\nPreferred caption length: ~${prefs.avgLikedCaptionLength} words\nPreferred hashtag count: ${prefs.avgLikedHashtagCount} per post\nPost types that resonate: ${preferredTypes}\n${prefs.toneNotes}`;
}

// ── Brand context & data fetching ─────────────────────────────────────────────

async function fetchBrandContext(clientId: string) {
  const admin = createAdmin();

  const { data: client } = await admin
    .from('clients')
    .select('name, company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples, region, timezone, business_context, posting_preferences, operating_hours')
    .eq('id', clientId)
    .single();

  const { data: documents } = await admin
    .from('brand_documents')
    .select('extracted_text, original_filename')
    .eq('client_id', clientId)
    .eq('processing_status', 'completed')
    .not('extracted_text', 'is', null)
    .limit(3);

  const { data: scrapes } = await admin
    .from('website_scrapes')
    .select('scraped_content, page_title')
    .eq('client_id', clientId)
    .eq('scrape_status', 'completed')
    .not('scraped_content', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(1);

  return { client: client ?? null, documents: documents ?? [], website: scrapes?.[0] ?? null };
}

async function getAvailableGalleryItems(clientId: string, limit: number) {
  const admin = createAdmin();
  const { data } = await admin
    .from('media_gallery')
    .select('id, media_url, media_type, ai_description, ai_tags, ai_categories, ai_mood, ai_setting, ai_subjects, freshness_score, times_used, user_context, last_used_at')
    .eq('client_id', clientId)
    .eq('status', 'available')
    .eq('ai_analysis_status', 'complete')
    .eq('media_type', 'image')
    .order('freshness_score', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function getRecentPosts(clientId: string, days: number) {
  const admin = createAdmin();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('id, caption, scheduled_date, image_url')
    .eq('client_id', clientId)
    .gte('scheduled_date', since)
    .order('scheduled_date', { ascending: false })
    .limit(20);
  return data ?? [];
}

async function getExistingPostsInRange(clientId: string, start: Date, end: Date) {
  const admin = createAdmin();
  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('id, scheduled_date')
    .eq('client_id', clientId)
    .gte('scheduled_date', formatDate(start))
    .lte('scheduled_date', formatDate(end));
  return data ?? [];
}

async function getEventsForRange(clientId: string, start: Date, end: Date) {
  const admin = createAdmin();
  const { data } = await admin
    .from('content_events')
    .select('id, title, description, event_date, event_type, content_angle, relevance_tags')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .gte('event_date', formatDate(start))
    .lte('event_date', formatDate(end))
    .order('event_date', { ascending: true });
  return (data ?? []);
}

async function getOrCreateDefaultProject(clientId: string, userId: string) {
  const admin = createAdmin();
  const { data: existing } = await admin
    .from('projects')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await admin
    .from('projects')
    .insert({ client_id: clientId, name: 'Autopilot Content', description: 'AI-generated content from the Autopilot engine', status: 'active' })
    .select('id, name')
    .single();

  if (error || !created) throw new Error(`Failed to create default project: ${error?.message}`);
  return created;
}

async function trackAICreditUsage(userId: string, creditsUsed: number, actionType: string, clientId?: string) {
  const admin = createAdmin();
  try {
    const { data: profile } = await admin.from('user_profiles').select('ai_credits_purchased').eq('id', userId).single();
    const purchased = profile?.ai_credits_purchased ?? 0;
    if (purchased > 0) {
      await admin.from('user_profiles').update({ ai_credits_purchased: Math.max(0, purchased - creditsUsed) }).eq('id', userId);
    } else {
      const { data: sub } = await admin.from('subscriptions').select('ai_credits_used_this_month').eq('user_id', userId).single();
      if (sub) {
        await admin.from('subscriptions').update({ ai_credits_used_this_month: (sub.ai_credits_used_this_month ?? 0) + creditsUsed }).eq('user_id', userId);
      }
    }
    await admin.from('ai_credit_usage_log').insert({ user_id: userId, credits_used: creditsUsed, action_type: actionType, client_id: clientId ?? null }).maybeSingle().catch(() => {});
  } catch (_) { /* non-fatal */ }
}

// ── Prompt builder (v2) ───────────────────────────────────────────────────────

function buildPromptV2(params: {
  client: Record<string, unknown>;
  brandCtx: { documents: Array<{ extracted_text?: string }>; website: { page_title?: string; scraped_content?: string } | null };
  events: Array<{ event_date: string; title: string; event_type: string; content_angle?: string | null; description?: string | null }>;
  recentPosts: Array<{ scheduled_date: string; caption: string }>;
  gallery: Array<{ id: string; ai_description?: string | null; ai_tags?: string[]; ai_mood?: string | null; ai_categories?: string[]; times_used: number; user_context?: string | null }>;
  season: string;
  hemisphere: string;
  candidateCount: number;
  startDate: Date;
  endDate: Date;
  stylePreferences: string;
}): { system: string; user: string } {
  const { client, brandCtx, events, recentPosts, gallery, season, hemisphere, candidateCount, startDate, endDate, stylePreferences } = params;
  const biz = (client.business_context ?? {}) as Record<string, unknown>;
  const prefs = (client.posting_preferences ?? {}) as Record<string, unknown>;
  const hours = (client.operating_hours ?? {}) as Record<string, unknown>;
  const mix = (prefs.content_mix ?? {}) as Record<string, number>;

  const system = `You are an expert social media content strategist. You are creating a pool of post candidates for ${client.name}, a ${biz.business_type || 'business'} in ${client.region || 'the region'}.

Your job is to select the best photos from their gallery, write highly specific engaging captions, and suggest optimal scheduling times.

RULES:
- Only suggest posts on days the business is open (see operating hours). If operating hours are empty, any day is fine.
- Never suggest days in the "avoid" list.
- Respect the content mix percentages across the candidate pool.
- Use the brand voice and tone consistently.
- Incorporate relevant events and seasonal context.
- Don't repeat topics or photos used in recent posts.
- Write captions appropriate for each target platform.
- Maximum 5 hashtags per post — every hashtag MUST pass: "Would a human actually search for or follow this?"
- Keep captions under 2200 characters.
- Only use media_gallery_id values from the "Available Photos" list.
- Respond with ONLY valid JSON — no markdown fences, no explanatory text.

CRITICAL RULES TO PREVENT LOW-QUALITY CONTENT:
- Every hashtag MUST be directly relevant to the POST TOPIC. Never add hashtags about the brand's region, country, or unrelated business aspects.
- Write as if you ARE this business's social media manager who has worked there for years.
- Each caption must be SPECIFIC to the photo being used.
- No corporate language: avoid "discover", "leverage", "solutions", "elevate", "unlock". Write like a person, not a press release.
- Vary the structure — not every post should start with a question or an emoji.`;

  const docsText = brandCtx.documents.length > 0
    ? brandCtx.documents.map(d => d.extracted_text?.substring(0, 500)).filter(Boolean).join('\n')
    : 'None';

  const websiteText = brandCtx.website
    ? `${brandCtx.website.page_title || ''}: ${(brandCtx.website.scraped_content || '').substring(0, 400)}`
    : 'None';

  const galleryText = gallery.length > 0
    ? gallery.map(g => `ID: ${g.id}\n  Description: ${g.ai_description || 'none'}\n  Tags: ${(g.ai_tags || []).join(', ')}\n  Mood: ${g.ai_mood || 'none'}\n  Categories: ${(g.ai_categories || []).join(', ')}\n  Used: ${g.times_used} times\n  Context: ${g.user_context || 'none'}`).join('\n\n')
    : 'No analyzed photos available.';

  const eventsText = events.length > 0
    ? events.map(e => `- ${e.event_date}: ${e.title} (${e.event_type})${e.content_angle ? ` — ${e.content_angle}` : ''}${e.description ? ` — ${e.description}` : ''}`).join('\n')
    : 'None this week.';

  const recentText = recentPosts.length > 0
    ? recentPosts.map(p => `- ${p.scheduled_date}: ${(p.caption || '').substring(0, 120)}`).join('\n')
    : 'None.';

  const user = `## Brand Context
Company: ${client.name}
Description: ${client.company_description || 'Not provided'}
Tone: ${client.brand_tone || 'Professional and engaging'}
Target Audience: ${client.target_audience || 'General audience'}
Value Proposition: ${client.value_proposition || 'Not provided'}
Caption Dos: ${client.caption_dos || 'Not provided'}
Caption Don'ts: ${client.caption_donts || 'Not provided'}
Voice Examples: ${client.brand_voice_examples || 'Not provided'}
Brand Documents: ${docsText}
Website: ${websiteText}

## Business Operations
Type: ${biz.business_type || 'business'}
Hemisphere: ${hemisphere}
Current Season: ${season}
Region: ${client.region || 'Not specified'}
Operating Hours: ${JSON.stringify(hours)}
Key Offerings: ${((biz.key_offerings as string[]) || []).join(', ') || 'Not specified'}
Attributes: ${((biz.attributes as string[]) || []).join(', ') || 'None specified'}

## Posting Preferences
Preferred days: ${((prefs.preferred_days as string[]) || []).join(', ')}
Days to avoid: ${((prefs.avoid_days as string[]) || []).join(', ') || 'None'}
Preferred times: ${((prefs.preferred_times as string[]) || []).join(', ')}
Content mix: Promotional ${mix.promotional || 30}%, Engagement ${mix.engagement || 40}%, Seasonal ${mix.seasonal || 20}%, Educational ${mix.educational || 10}%

## Upcoming Events
${eventsText}

## Recent Posts (last 14 days — avoid repeating these topics)
${recentText}

## Available Photos
${galleryText}

${stylePreferences}

## Instructions
Generate exactly ${candidateCount} post candidates for the period ${formatDate(startDate)} to ${formatDate(endDate)}.

Return ONLY valid JSON in this exact structure:
{
  "plan_summary": "Brief 1-2 sentence summary of the candidate pool",
  "candidates": [
    {
      "media_gallery_id": "uuid-from-available-photos",
      "caption": "Full caption text (WITHOUT hashtags — put those in hashtags array)",
      "hashtags": ["#tag1", "#tag2"],
      "platforms": ["instagram", "facebook"],
      "post_type": "promotional",
      "suggested_date": "YYYY-MM-DD",
      "suggested_time": "HH:mm",
      "event_reference": null,
      "season_tag": "summer",
      "reasoning": "Why this photo, angle, and timing"
    }
  ]
}`;

  return { system, user };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Validate user JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { clientId, startDate: startDateStr, endDate: endDateStr, force = false } = body;

    if (!clientId) {
      return jsonResponse({ success: false, error: 'clientId is required' }, 400);
    }

    const admin = createAdmin();

    // Verify client ownership
    const { data: clientRow } = await admin
      .from('clients')
      .select('id, user_id, autopilot_enabled, posting_preferences')
      .eq('id', clientId)
      .maybeSingle();

    if (!clientRow || clientRow.user_id !== user.id) {
      return jsonResponse({ success: false, error: 'Forbidden' }, 403);
    }

    if (!force && !clientRow.autopilot_enabled) {
      return jsonResponse({ success: false, error: 'Autopilot is not enabled for this client.' }, 400);
    }

    // Resolve dates
    const startDate = startDateStr
      ? new Date(startDateStr + 'T00:00:00Z')
      : nextMonday(new Date());
    const endDate = endDateStr
      ? new Date(endDateStr + 'T23:59:59Z')
      : addDays(startDate, 6);

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    // Check for existing non-failed plan
    if (!force) {
      const { data: existingPlan } = await admin
        .from('autopilot_plans')
        .select('id, status')
        .eq('client_id', clientId)
        .eq('plan_week_start', startStr)
        .neq('status', 'failed')
        .maybeSingle();

      if (existingPlan) {
        return jsonResponse({
          success: false,
          error: `A plan already exists for this week (status: ${existingPlan.status}). Pass force: true to generate a new one.`,
          existingPlanId: existingPlan.id,
        }, 409);
      }
    }

    // Gather all context in parallel
    const [brandCtx, events, recentPosts, existingPosts, gallery, project, stylePrefs] = await Promise.all([
      fetchBrandContext(clientId),
      getEventsForRange(clientId, startDate, endDate),
      getRecentPosts(clientId, 14),
      getExistingPostsInRange(clientId, startDate, endDate),
      getAvailableGalleryItems(clientId, 40),
      getOrCreateDefaultProject(clientId, user.id),
      getStylePreferences(clientId),
    ]);

    const client = brandCtx.client;
    if (!client) throw new Error('Client not found');

    const prefs = (client.posting_preferences ?? {}) as Record<string, unknown>;
    const postsPerWeek = (prefs.posts_per_week as number) || 3;
    const candidateCount = Math.min(12, Math.max(10, postsPerWeek * 3));
    const hemisphere = inferHemisphere(
      (client.business_context as Record<string, unknown>)?.hemisphere as string | undefined,
      client.region as string | undefined
    );
    const season = deriveSeason(hemisphere, startDate);

    // Create plan record
    const { data: planRow, error: planInsertErr } = await admin
      .from('autopilot_plans')
      .insert({
        client_id: clientId,
        user_id: user.id,
        project_id: project.id,
        plan_week_start: startStr,
        plan_week_end: endStr,
        posts_planned: postsPerWeek,
        ai_context_snapshot: { season, eventsCount: events.length, gallerySize: gallery.length, postsPerWeek, existingCount: existingPosts.length, hasStylePrefs: stylePrefs.hasEnoughData },
        events_considered: events.map((e: { id: string; title: string; event_date: string }) => ({ id: e.id, title: e.title, date: e.event_date })),
        status: 'generating',
        generation_version: 'v2',
        candidates_generated: 0,
        candidates_liked: 0,
        candidates_skipped: 0,
      })
      .select('*')
      .single();

    if (planInsertErr || !planRow) {
      throw new Error(`Failed to create autopilot plan: ${planInsertErr?.message}`);
    }

    if (gallery.length === 0) {
      await admin.from('autopilot_plans').update({ status: 'failed', ai_plan_summary: 'No analyzed photos available in gallery.' }).eq('id', planRow.id);
      return jsonResponse({ success: false, error: 'No analyzed photos available. Upload and analyze photos first.' }, 400);
    }

    // Build and run the AI prompt
    const stylePreferencesBlock = formatPreferencesForPrompt(stylePrefs);
    const { system, user: userPrompt } = buildPromptV2({
      client: client as Record<string, unknown>,
      brandCtx,
      events,
      recentPosts,
      gallery,
      season,
      hemisphere,
      candidateCount,
      startDate,
      endDate,
      stylePreferences: stylePreferencesBlock,
    });

    let parsedResult: { plan_summary: string; candidates: Array<{ media_gallery_id: string; caption: string; hashtags?: string[]; platforms?: string[]; post_type?: string; suggested_date: string; suggested_time?: string; event_reference?: string | null; season_tag?: string | null; reasoning?: string }> };

    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        max_tokens: 6000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      const rawContent = completion.choices[0]?.message?.content || '{}';
      parsedResult = JSON.parse(stripJsonFences(rawContent));
    } catch (aiErr) {
      await admin.from('autopilot_plans').update({ status: 'failed', ai_plan_summary: 'AI generation failed.' }).eq('id', planRow.id);
      throw new Error(`OpenAI generation failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`);
    }

    if (!Array.isArray(parsedResult.candidates) || parsedResult.candidates.length === 0) {
      await admin.from('autopilot_plans').update({ status: 'failed', ai_plan_summary: 'AI returned no candidates.' }).eq('id', planRow.id);
      throw new Error('AI returned an empty candidate pool.');
    }

    const galleryMap = new Map(gallery.map((g: { id: string }) => [g.id, g]));

    const validCandidates = parsedResult.candidates.filter(c => {
      if (!c.media_gallery_id || !c.caption || !c.suggested_date) return false;
      if (c.suggested_date < startStr || c.suggested_date > endStr) return false;
      if (!galleryMap.has(c.media_gallery_id)) return false;
      return true;
    });

    if (validCandidates.length === 0) {
      await admin.from('autopilot_plans').update({ status: 'failed', ai_plan_summary: 'No valid candidates after validation.' }).eq('id', planRow.id);
      throw new Error('AI candidate validation failed — no valid candidates.');
    }

    // Store candidates
    const createdCandidates: unknown[] = [];
    for (let i = 0; i < validCandidates.length; i++) {
      const c = validCandidates[i];
      const galleryItem = galleryMap.get(c.media_gallery_id)!;
      const suggestedTime = c.suggested_time?.includes(':') ? c.suggested_time : '12:00';

      const { data: created } = await admin
        .from('autopilot_candidates')
        .insert({
          autopilot_plan_id: planRow.id,
          client_id: clientId,
          media_gallery_id: c.media_gallery_id,
          media_url: (galleryItem as { media_url: string }).media_url,
          caption: c.caption,
          platforms: c.platforms ?? [],
          hashtags: c.hashtags ?? [],
          post_type: c.post_type || null,
          event_reference: c.event_reference || null,
          season_tag: c.season_tag || null,
          suggested_date: c.suggested_date,
          suggested_time: suggestedTime,
          ai_reasoning: c.reasoning || null,
          decision: 'pending',
          display_order: i,
        })
        .select('*')
        .single();

      if (created) createdCandidates.push(created);
    }

    // Update plan to pending_approval
    const { data: finalPlan } = await admin
      .from('autopilot_plans')
      .update({ ai_plan_summary: parsedResult.plan_summary || null, status: 'pending_approval', candidates_generated: createdCandidates.length })
      .eq('id', planRow.id)
      .select('*')
      .single();

    // Track credits (non-blocking)
    const totalCredits = 1 + validCandidates.length;
    trackAICreditUsage(user.id, totalCredits, 'autopilot_generate', clientId).catch(() => {});

    // Send email notification (non-blocking)
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resend = new Resend(resendKey);
      const { data: userProfile } = await admin.from('user_profiles').select('full_name, email').eq('id', user.id).maybeSingle();
      if (userProfile?.email) {
        const baseUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://content-manager.io';
        const approvalLink = `${baseUrl}/dashboard/client/${clientId}/autopilot`;
        resend.emails.send({
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'Content Manager <noreply@content-manager.io>',
          to: userProfile.email,
          subject: `Your autopilot plan is ready — ${createdCandidates.length} posts to review`,
          html: `<p>Hi ${userProfile.full_name || 'there'},</p><p>Your autopilot plan for <strong>${brandCtx.client?.name || clientId}</strong> is ready with ${createdCandidates.length} post candidates to review.</p><p><a href="${approvalLink}">Review your plan</a></p>`,
        }).catch(() => {});
      }
    }

    return jsonResponse({ success: true, plan: finalPlan ?? { ...planRow, status: 'pending_approval' }, candidates: createdCandidates }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('generate-plan error:', message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
