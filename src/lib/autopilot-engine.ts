import OpenAI from 'openai';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { sendAutopilotPlanReadyEmail } from '@/lib/email';
import logger from '@/lib/logger';
import { getStylePreferences, formatPreferencesForPrompt } from '@/lib/preference-engine';

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutopilotPlan {
  id: string;
  client_id: string;
  user_id: string;
  project_id: string | null;
  plan_week_start: string;
  plan_week_end: string;
  posts_planned: number;
  posts_approved: number;
  ai_plan_summary: string | null;
  ai_context_snapshot: Record<string, unknown> | null;
  events_considered: unknown[];
  status: string;
  approval_token: string;
  approved_at: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GalleryItem {
  id: string;
  media_url: string;
  media_type: string;
  ai_description: string | null;
  ai_tags: string[];
  ai_categories: string[];
  ai_mood: string | null;
  ai_setting: string | null;
  ai_subjects: unknown[];
  freshness_score: number;
  times_used: number;
  user_context: string | null;
  last_used_at: string | null;
}

interface ContentEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  content_angle: string | null;
  relevance_tags: string[];
}

interface AIPlanPost {
  scheduled_date: string;
  scheduled_time: string;
  post_type: string;
  media_gallery_id: string;
  platforms: string[];
  caption: string;
  reasoning: string;
  event_reference: string | null;
}

interface AIGeneratedPlan {
  plan_summary: string;
  posts: AIPlanPost[];
}

interface AICandidatePost {
  media_gallery_id: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  post_type: string;
  suggested_date: string;
  suggested_time: string;
  event_reference: string | null;
  season_tag: string | null;
  reasoning: string;
}

interface AIGeneratedCandidates {
  plan_summary: string;
  candidates: AICandidatePost[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOUTHERN_HEMISPHERE_REGIONS = [
  'new zealand', 'nz', 'australia', 'au', 'south africa', 'za',
  'argentina', 'brazil', 'chile', 'peru', 'uruguay', 'paraguay',
  'bolivia', 'ecuador', 'fiji', 'papua new guinea', 'new caledonia',
  'vanuatu', 'solomon islands', 'tonga', 'samoa', 'madagascar',
  'mozambique', 'zimbabwe', 'zambia', 'namibia', 'botswana', 'lesotho',
  'eswatini', 'malawi', 'tanzania', 'kenya', 'indonesia', 'timor-leste',
];

export function inferHemisphere(hemisphere: string | null | undefined, region: string | null | undefined): string {
  if (hemisphere === 'southern' || hemisphere === 'northern') return hemisphere;
  if (region) {
    const lower = region.toLowerCase();
    if (SOUTHERN_HEMISPHERE_REGIONS.some(r => lower.includes(r))) return 'southern';
  }
  return 'northern';
}

export function deriveSeason(hemisphere: string, date: Date): string {
  const month = date.getUTCMonth() + 1; // 1-12
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

export async function getOrCreateDefaultProject(
  clientId: string,
  userId: string
): Promise<{ id: string; name: string }> {
  const admin = createSupabaseAdmin();

  // Try to find first active project
  const { data: existing } = await admin
    .from('projects')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // Create autopilot project — projects table has no user_id column (keyed by client_id only)
  const { data: created, error } = await admin
    .from('projects')
    .insert({
      client_id: clientId,
      name: 'Autopilot Content',
      description: 'AI-generated content from the Autopilot engine',
      status: 'active',
    })
    .select('id, name')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create default project: ${error?.message}`);
  }

  return created;
}

async function fetchBrandContext(clientId: string) {
  const admin = createSupabaseAdmin();

  const { data: client } = await admin
    .from('clients')
    .select(
      'name, company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples, region, timezone, business_context, posting_preferences, operating_hours'
    )
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

  return {
    client: client ?? null,
    documents: documents ?? [],
    website: scrapes?.[0] ?? null,
  };
}

export async function getAvailableGalleryItems(
  clientId: string,
  limit: number
): Promise<GalleryItem[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('media_gallery')
    .select(
      'id, media_url, media_type, ai_description, ai_tags, ai_categories, ai_mood, ai_setting, ai_subjects, freshness_score, times_used, user_context, last_used_at'
    )
    .eq('client_id', clientId)
    .eq('status', 'available')
    .eq('ai_analysis_status', 'complete')
    .eq('media_type', 'image')
    .order('freshness_score', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch gallery items:', error);
    return [];
  }
  return (data ?? []) as GalleryItem[];
}

export async function getRecentPosts(clientId: string, days: number) {
  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('id, caption, scheduled_date, image_url')
    .eq('client_id', clientId)
    .gte('scheduled_date', since)
    .order('scheduled_date', { ascending: false })
    .limit(20);

  return data ?? [];
}

export async function getExistingPostsInRange(
  clientId: string,
  start: Date,
  end: Date
) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('id, scheduled_date')
    .eq('client_id', clientId)
    .gte('scheduled_date', start.toISOString().split('T')[0])
    .lte('scheduled_date', end.toISOString().split('T')[0]);

  return data ?? [];
}

export async function getEventsForRange(
  clientId: string,
  start: Date,
  end: Date
): Promise<ContentEvent[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('content_events')
    .select('id, title, description, event_date, event_type, content_angle, relevance_tags')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .gte('event_date', start.toISOString().split('T')[0])
    .lte('event_date', end.toISOString().split('T')[0])
    .order('event_date', { ascending: true });

  return (data ?? []) as ContentEvent[];
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

function buildPrompt(params: {
  client: NonNullable<Awaited<ReturnType<typeof fetchBrandContext>>['client']>;
  brandCtx: Awaited<ReturnType<typeof fetchBrandContext>>;
  events: ContentEvent[];
  recentPosts: Awaited<ReturnType<typeof getRecentPosts>>;
  gallery: GalleryItem[];
  season: string;
  hemisphere: string;
  postsToGenerate: number;
  startDate: Date;
  endDate: Date;
}): { system: string; user: string } {
  const { client, brandCtx, events, recentPosts, gallery, season, hemisphere, postsToGenerate, startDate, endDate } = params;

  const biz = (client.business_context ?? {}) as Record<string, unknown>;
  const prefs = (client.posting_preferences ?? {}) as Record<string, unknown>;
  const hours = (client.operating_hours ?? {}) as Record<string, unknown>;
  const mix = (prefs.content_mix ?? {}) as Record<string, number>;

  const system = `You are an expert social media content strategist. You are creating a weekly content plan for ${client.name}, a ${biz.business_type || 'business'} in ${client.region || 'the region'}.

Your job is to select the best photos from their gallery, write engaging captions, and schedule posts at optimal times.

RULES:
- Only schedule posts on days the business is open (see operating hours). If operating hours are empty, any day is fine.
- Never schedule on days in the "avoid" list.
- Respect the content mix percentages.
- Use the brand voice and tone consistently.
- Incorporate relevant events and seasonal context.
- Don't repeat topics or photos used in recent posts.
- Schedule at preferred posting times.
- Write captions appropriate for each target platform.
- Include relevant hashtags (5-10 per post).
- Keep captions under 2200 characters.
- Only use media_gallery_id values from the "Available Photos" list.
- Respond with ONLY valid JSON — no markdown fences, no explanatory text.`;

  const docsText =
    brandCtx.documents.length > 0
      ? brandCtx.documents
          .map((d: { extracted_text?: string; original_filename?: string }) =>
            d.extracted_text?.substring(0, 500)
          )
          .filter(Boolean)
          .join('\n')
      : 'None';

  const websiteText = brandCtx.website
    ? `${(brandCtx.website as { page_title?: string }).page_title || ''}: ${((brandCtx.website as { scraped_content?: string }).scraped_content || '').substring(0, 400)}`
    : 'None';

  const galleryText =
    gallery.length > 0
      ? gallery
          .map(
            g =>
              `ID: ${g.id}\n  Description: ${g.ai_description || 'none'}\n  Tags: ${(g.ai_tags || []).join(', ')}\n  Mood: ${g.ai_mood || 'none'}\n  Categories: ${(g.ai_categories || []).join(', ')}\n  Used: ${g.times_used} times\n  Context: ${g.user_context || 'none'}`
          )
          .join('\n\n')
      : 'No analyzed photos available.';

  const eventsText =
    events.length > 0
      ? events
          .map(
            e =>
              `- ${e.event_date}: ${e.title} (${e.event_type})${e.content_angle ? ` — ${e.content_angle}` : ''}${e.description ? ` — ${e.description}` : ''}`
          )
          .join('\n')
      : 'None this week.';

  const recentText =
    recentPosts.length > 0
      ? recentPosts
          .map(p => `- ${p.scheduled_date}: ${(p.caption || '').substring(0, 120)}`)
          .join('\n')
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
Local Sports Teams: ${((biz.local_sports_teams as string[]) || []).join(', ') || 'None'}

## Posting Preferences
Posts to generate: ${postsToGenerate}
Preferred days: ${((prefs.preferred_days as string[]) || []).join(', ')}
Days to avoid: ${((prefs.avoid_days as string[]) || []).join(', ') || 'None'}
Preferred times: ${((prefs.preferred_times as string[]) || []).join(', ')}
Content mix: Promotional ${mix.promotional || 30}%, Engagement ${mix.engagement || 40}%, Seasonal ${mix.seasonal || 20}%, Educational ${mix.educational || 10}%

## Upcoming Events This Week
${eventsText}

## Recent Posts (last 14 days — avoid repeating these topics)
${recentText}

## Available Photos
${galleryText}

## Instructions
Create exactly ${postsToGenerate} post${postsToGenerate !== 1 ? 's' : ''} for the week of ${formatDate(startDate)} to ${formatDate(endDate)}.

Return ONLY valid JSON in this exact structure:
{
  "plan_summary": "Brief 1-2 sentence summary of the plan",
  "posts": [
    {
      "scheduled_date": "YYYY-MM-DD",
      "scheduled_time": "HH:mm",
      "post_type": "promotional",
      "media_gallery_id": "uuid-from-available-photos",
      "platforms": ["instagram", "facebook"],
      "caption": "Full caption with hashtags",
      "reasoning": "Why this photo, day, time and angle",
      "event_reference": null
    }
  ]
}`;

  return { system, user };
}

function buildPromptV2(params: {
  client: NonNullable<Awaited<ReturnType<typeof fetchBrandContext>>['client']>;
  brandCtx: Awaited<ReturnType<typeof fetchBrandContext>>;
  events: ContentEvent[];
  recentPosts: Awaited<ReturnType<typeof getRecentPosts>>;
  gallery: GalleryItem[];
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
- Every hashtag MUST be directly relevant to the POST TOPIC. Never add hashtags about the brand's region, country, or unrelated business aspects. If the post is about soup, hashtags should be about soup, food, winter, dining — NOT about the country or unrelated services.
- Write as if you ARE this business's social media manager who has worked there for years. You know the regulars, you know what the place feels like on a Tuesday lunch.
- Each caption must be SPECIFIC to the photo being used. If you could swap this caption onto a different photo and it still worked, it's too generic — be more specific.
- No corporate language: avoid "discover", "leverage", "solutions", "elevate", "unlock". Write like a person, not a press release.
- Vary the structure — not every post should start with a question or an emoji.
- Include specific details from the photo (if the AI described it as "steaming bowl of soup on wooden table", reference the steam, the wooden table, the specific type of soup if known).`;

  const docsText =
    brandCtx.documents.length > 0
      ? brandCtx.documents
          .map((d: { extracted_text?: string; original_filename?: string }) =>
            d.extracted_text?.substring(0, 500)
          )
          .filter(Boolean)
          .join('\n')
      : 'None';

  const websiteText = brandCtx.website
    ? `${(brandCtx.website as { page_title?: string }).page_title || ''}: ${((brandCtx.website as { scraped_content?: string }).scraped_content || '').substring(0, 400)}`
    : 'None';

  const galleryText =
    gallery.length > 0
      ? gallery
          .map(
            g =>
              `ID: ${g.id}\n  Description: ${g.ai_description || 'none'}\n  Tags: ${(g.ai_tags || []).join(', ')}\n  Mood: ${g.ai_mood || 'none'}\n  Categories: ${(g.ai_categories || []).join(', ')}\n  Used: ${g.times_used} times\n  Context: ${g.user_context || 'none'}`
          )
          .join('\n\n')
      : 'No analyzed photos available.';

  const eventsText =
    events.length > 0
      ? events
          .map(
            e =>
              `- ${e.event_date}: ${e.title} (${e.event_type})${e.content_angle ? ` — ${e.content_angle}` : ''}${e.description ? ` — ${e.description}` : ''}`
          )
          .join('\n')
      : 'None this week.';

  const recentText =
    recentPosts.length > 0
      ? recentPosts
          .map(p => `- ${p.scheduled_date}: ${(p.caption || '').substring(0, 120)}`)
          .join('\n')
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
Local Sports Teams: ${((biz.local_sports_teams as string[]) || []).join(', ') || 'None'}

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
Generate exactly ${candidateCount} post candidates for the period ${formatDate(startDate)} to ${formatDate(endDate)}. These are candidates for the user to swipe through — generate more variety than they need so they can pick their favourites.

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

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateContentPlan(
  clientId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ plan: AutopilotPlan; candidates: unknown[] }> {
  const admin = createSupabaseAdmin();

  // Step 1: Gather context (style prefs in parallel with brand data)
  logger.info('Autopilot v2: gathering context', { clientId });
  const [brandCtx, events, recentPosts, existingPosts, gallery, project, stylePrefs] =
    await Promise.all([
      fetchBrandContext(clientId),
      getEventsForRange(clientId, startDate, endDate),
      getRecentPosts(clientId, 14),
      getExistingPostsInRange(clientId, startDate, endDate),
      getAvailableGalleryItems(clientId, 40),
      getOrCreateDefaultProject(clientId, userId),
      getStylePreferences(clientId),
    ]);

  const client = brandCtx.client;
  if (!client) throw new Error('Client not found');

  // Step 2: Determine candidate count (10-12, always, regardless of existing posts)
  const prefs = (client.posting_preferences ?? {}) as Record<string, unknown>;
  const postsPerWeek = (prefs.posts_per_week as number) || 3;
  const candidateCount = Math.min(12, Math.max(10, postsPerWeek * 3));
  const hemisphere = inferHemisphere(
    (client.business_context as Record<string, unknown>)?.hemisphere as string | undefined,
    client.region
  );
  const season = deriveSeason(hemisphere, startDate);

  logger.info('Autopilot v2: plan params', {
    postsPerWeek,
    candidateCount,
    existingCount: existingPosts.length,
    gallerySize: gallery.length,
    eventsCount: events.length,
    season,
    hasStylePrefs: stylePrefs.hasEnoughData,
  });

  // Create plan record in 'generating' state
  const { data: planRow, error: planInsertErr } = await admin
    .from('autopilot_plans')
    .insert({
      client_id: clientId,
      user_id: userId,
      project_id: project.id,
      plan_week_start: formatDate(startDate),
      plan_week_end: formatDate(endDate),
      posts_planned: postsPerWeek,
      ai_context_snapshot: {
        season,
        eventsCount: events.length,
        gallerySize: gallery.length,
        postsPerWeek,
        existingCount: existingPosts.length,
        hasStylePrefs: stylePrefs.hasEnoughData,
      },
      events_considered: events.map(e => ({ id: e.id, title: e.title, date: e.event_date })),
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
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'No analyzed photos available in gallery.' })
      .eq('id', planRow.id);
    throw new Error('No analyzed photos available in the media gallery. Upload and analyze photos first.');
  }

  // Step 3: Call OpenAI with v2 prompt
  const stylePreferencesBlock = formatPreferencesForPrompt(stylePrefs);
  logger.info('Autopilot v2: calling OpenAI', { model: MODEL, candidateCount });
  const { system, user } = buildPromptV2({
    client,
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

  let parsedResult: AIGeneratedCandidates;
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 6000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const cleaned = stripJsonFences(rawContent);
    parsedResult = JSON.parse(cleaned) as AIGeneratedCandidates;
  } catch (aiErr) {
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'AI generation failed.' })
      .eq('id', planRow.id);
    throw new Error(`OpenAI candidate generation failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`);
  }

  // Step 4: Validate response
  if (!Array.isArray(parsedResult.candidates) || parsedResult.candidates.length === 0) {
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'AI returned no candidates.' })
      .eq('id', planRow.id);
    throw new Error('AI returned an empty candidate pool.');
  }

  const galleryMap = new Map(gallery.map(g => [g.id, g]));
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const validCandidates = parsedResult.candidates.filter(c => {
    if (!c.media_gallery_id || !c.caption || !c.suggested_date) return false;
    if (c.suggested_date < startStr || c.suggested_date > endStr) return false;
    if (!galleryMap.has(c.media_gallery_id)) return false;
    return true;
  });

  if (validCandidates.length === 0) {
    await admin
      .from('autopilot_plans')
      .update({ status: 'failed', ai_plan_summary: 'No valid candidates after validation.' })
      .eq('id', planRow.id);
    throw new Error('AI candidate validation failed — no valid candidates.');
  }

  // Step 5: Store candidates in autopilot_candidates
  const createdCandidates: unknown[] = [];
  for (let i = 0; i < validCandidates.length; i++) {
    const c = validCandidates[i];
    const galleryItem = galleryMap.get(c.media_gallery_id)!;
    const suggestedTime = c.suggested_time?.includes(':') ? c.suggested_time : '12:00';

    const { data: created, error: insertErr } = await admin
      .from('autopilot_candidates')
      .insert({
        autopilot_plan_id: planRow.id,
        client_id: clientId,
        media_gallery_id: c.media_gallery_id,
        media_url: galleryItem.media_url,
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

    if (insertErr) {
      logger.error('Failed to insert autopilot candidate:', insertErr);
    } else if (created) {
      createdCandidates.push(created);
    }
  }

  // Step 6: Update plan
  const { data: finalPlan } = await admin
    .from('autopilot_plans')
    .update({
      ai_plan_summary: parsedResult.plan_summary || null,
      status: 'pending_approval',
      candidates_generated: createdCandidates.length,
    })
    .eq('id', planRow.id)
    .select('*')
    .single();

  // Step 7: Track credits (1 base + 1 per candidate)
  const totalCredits = 1 + validCandidates.length;
  await trackAICreditUsage(userId, totalCredits, 'autopilot_generate', clientId);

  // Step 8: Send plan-ready email notification
  try {
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (userProfile?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://content-manager.io';
      const approvalLink = `${baseUrl}/dashboard/client/${clientId}/autopilot`;

      const formatWeekDate = (d: Date) =>
        d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });

      await sendAutopilotPlanReadyEmail({
        to: userProfile.email,
        userName: userProfile.full_name || 'there',
        clientName: brandCtx.client?.name || clientId,
        planSummary: parsedResult.plan_summary || `${createdCandidates.length} candidates generated for review.`,
        postsCount: createdCandidates.length,
        weekStart: formatWeekDate(startDate),
        weekEnd: formatWeekDate(endDate),
        approvalLink,
      });

      await admin
        .from('autopilot_plans')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', planRow.id);
    }
  } catch (emailErr) {
    logger.error('Autopilot v2: failed to send plan-ready email:', emailErr);
  }

  logger.info('Autopilot v2: candidates generated', {
    planId: planRow.id,
    candidatesCreated: createdCandidates.length,
    creditsUsed: totalCredits,
  });

  return {
    plan: (finalPlan ?? { ...planRow, status: 'pending_approval' }) as AutopilotPlan,
    candidates: createdCandidates,
  };
}

// ── Caption regeneration (used by swap-photo) ─────────────────────────────────

export async function regenerateCaption(params: {
  clientId: string;
  galleryItem: GalleryItem;
  postType: string;
  platforms: string[];
}): Promise<string> {
  const { clientId, galleryItem, postType, platforms } = params;
  const brandCtx = await fetchBrandContext(clientId);
  const client = brandCtx.client;

  const prompt = `You are a social media copywriter. Write a single caption for a ${postType} post on ${platforms.join(' and ')}.

Brand: ${client?.name || 'the business'}
Tone: ${client?.brand_tone || 'engaging and authentic'}
Target audience: ${client?.target_audience || 'general'}
Caption dos: ${client?.caption_dos || 'none'}
Caption don'ts: ${client?.caption_donts || 'none'}

Photo details:
- Description: ${galleryItem.ai_description || 'none'}
- Tags: ${(galleryItem.ai_tags || []).join(', ')}
- Mood: ${galleryItem.ai_mood || 'none'}
- Context: ${galleryItem.user_context || 'none'}

Write ONLY the caption text (with hashtags). No explanation.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.8,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}
