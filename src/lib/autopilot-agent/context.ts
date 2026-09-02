import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────
// Moved out of autopilot-engine.ts so both the orchestrator (engine.ts) and the
// tool layer (tools.ts) can depend on this shared data-access module without a
// circular import between engine -> loop -> tools -> engine.

export interface GalleryItem {
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

export interface ContentEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  content_angle: string | null;
  relevance_tags: string[];
}

export interface RegionalHoliday {
  id: string;
  name: string;
  holiday_date: string;
}

export interface BrandContext {
  client: {
    name: string;
    company_description: string | null;
    website_url: string | null;
    brand_tone: string | null;
    target_audience: string | null;
    value_proposition: string | null;
    caption_dos: string | null;
    caption_donts: string | null;
    brand_voice_examples: string | null;
    region: string | null;
    timezone: string | null;
    business_context: Record<string, unknown> | null;
    posting_preferences: Record<string, unknown> | null;
    operating_hours: Record<string, unknown> | null;
    ad_copy_settings: Record<string, unknown> | null;
  } | null;
  documents: Array<{ extracted_text?: string; original_filename?: string }>;
  website: { page_title?: string; scraped_content?: string } | null;
}

// ── Hemisphere / season ─────────────────────────────────────────────────────

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

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ── Data fetchers ────────────────────────────────────────────────────────────

export async function getOrCreateDefaultProject(
  clientId: string,
  userId: string
): Promise<{ id: string; name: string }> {
  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from('projects')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // projects table has no user_id column (keyed by client_id only)
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

export async function fetchBrandContext(clientId: string): Promise<BrandContext> {
  const admin = createSupabaseAdmin();

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select(
      'name, company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples, region, timezone, business_context, posting_preferences, operating_hours, ad_copy_settings'
    )
    .eq('id', clientId)
    .single();

  if (clientError && clientError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch client ${clientId}: ${clientError.message}`);
  }

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
    client: (client as BrandContext['client']) ?? null,
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

/**
 * Maps a free-text client.region value to the canonical region key used in
 * regional_holidays.region. Mirrors the 'new zealand'/'nz' matching already
 * used by inferHemisphere above, since client.region can be a country name,
 * a country code, or a city ("Auckland, New Zealand").
 */
function normalizeRegionKey(region: string): string {
  const lower = region.toLowerCase();
  if (lower.includes('new zealand') || /\bnz\b/.test(lower)) return 'new zealand';
  return lower;
}

/**
 * Fetches national/regional public holidays for the agent's `get_nz_context` tool.
 * Window extends 21 days past `end` so the agent can reference an upcoming
 * holiday ("Labour Day is coming up") even if it falls just after the posting week.
 */
export async function getRegionalHolidays(
  region: string | null | undefined,
  start: Date,
  end: Date
): Promise<RegionalHoliday[]> {
  if (!region) return [];
  const admin = createSupabaseAdmin();
  const lookaheadEnd = addDays(end, 21);

  const { data } = await admin
    .from('regional_holidays')
    .select('id, name, holiday_date')
    .eq('region', normalizeRegionKey(region))
    .gte('holiday_date', formatDate(start))
    .lte('holiday_date', formatDate(lookaheadEnd))
    .order('holiday_date', { ascending: true });

  return (data ?? []) as RegionalHoliday[];
}
