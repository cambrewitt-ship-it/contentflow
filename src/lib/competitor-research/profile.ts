import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { researchProfileSchema, type ResearchPlatform, type ResearchProfile } from './types';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  retail: 'Retail',
  service: 'Service business',
  fitness: 'Fitness / gym',
  beauty: 'Beauty / salon',
  professional: 'Professional services',
  creative: 'Creative / agency',
};

interface ClientProfileRow {
  name: string | null;
  company_description: string | null;
  target_audience: string | null;
  region: string | null;
  business_context: { business_type?: string; key_offerings?: string[] } | null;
  research_profile: Partial<ResearchProfile> | null;
}

export interface ResolvedResearchProfile {
  clientName: string;
  profile: ResearchProfile;
  // false until the user saves the research profile themselves
  saved: boolean;
}

export const RESEARCH_SETUP_MESSAGE =
  'Competitor Research needs its database tables — run migrations/039-competitor-research.sql and 040-competitor-research-scale.sql in Supabase.';

export class ResearchSetupError extends Error {}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Fit free-form brand-profile data into the research profile's limits. Brand profiles
 * often hold long "key offerings" (sentences, not keywords) or a long region, which
 * would otherwise fail validation and break the page.
 */
function toResearchProfile(raw: Partial<Record<keyof ResearchProfile, unknown>>): ResearchProfile {
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .map(k => text(k, 60))
    .filter(Boolean)
    .slice(0, 15);
  return researchProfileSchema.parse({
    category: text(raw.category, 120),
    description: text(raw.description, 1000),
    location: text(raw.location, 120),
    target_audience: text(raw.target_audience, 500),
    keywords,
    language: raw.language,
    include_trends: raw.include_trends,
  });
}

// The saved research profile, or one pre-filled from the brand profile so the
// page and the agent have something sensible before the user edits it.
export async function getResearchProfile(clientId: string): Promise<ResolvedResearchProfile> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('clients')
    .select('name, company_description, target_audience, region, business_context, research_profile')
    .eq('id', clientId)
    .single();
  if (error?.code === '42703') throw new ResearchSetupError(RESEARCH_SETUP_MESSAGE);
  if (error || !data) throw new Error(`Failed to load client ${clientId}: ${error?.message}`);

  const row = data as ClientProfileRow;
  const clientName = row.name || 'this business';

  if (row.research_profile) {
    const saved = researchProfileSchema.safeParse(row.research_profile);
    if (saved.success) return { clientName, profile: saved.data, saved: true };
    // A stored profile that no longer fits the schema is cleaned up rather than failing the page
    return { clientName, profile: toResearchProfile(row.research_profile), saved: true };
  }

  const businessType = row.business_context?.business_type;
  return {
    clientName,
    saved: false,
    profile: toResearchProfile({
      category: businessType && businessType !== 'other' ? BUSINESS_TYPE_LABELS[businessType] ?? businessType : '',
      description: row.company_description ?? '',
      location: row.region ?? '',
      target_audience: row.target_audience ?? '',
      keywords: Array.isArray(row.business_context?.key_offerings) ? row.business_context.key_offerings : [],
    }),
  };
}

export async function saveResearchProfile(clientId: string, profile: ResearchProfile) {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from('clients').update({ research_profile: profile }).eq('id', clientId);
  if (error) throw new Error(`Failed to save research profile: ${error.message}`);
}

export function describeProfile(clientName: string, profile: ResearchProfile): string {
  return [
    `Business: ${clientName}`,
    profile.category && `Category: ${profile.category}`,
    profile.description && `About: ${profile.description}`,
    profile.location && `Location: ${profile.location}`,
    profile.target_audience && `Target audience: ${profile.target_audience}`,
    profile.keywords.length > 0 && `Niche keywords: ${profile.keywords.join(', ')}`,
    `Language: ${profile.language}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// Accepts "@handle", "handle" or a profile URL; returns the bare handle or null.
export function normalizeHandle(platform: ResearchPlatform, input: string): string | null {
  let value = input.trim();
  const host = platform === 'instagram' ? /instagram\.com\/([^/?#]+)/i : /tiktok\.com\/@?([^/?#]+)/i;
  const match = value.match(host);
  if (match) value = match[1];
  value = value.replace(/^@/, '').toLowerCase();
  // Instagram: letters, digits, '.', '_' (max 30). TikTok: same set, max 24.
  const max = platform === 'instagram' ? 30 : 24;
  return new RegExp(`^[a-z0-9._]{1,${max}}$`).test(value) ? value : null;
}
