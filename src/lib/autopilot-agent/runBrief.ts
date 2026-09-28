import { z } from 'zod';
import { TARGET_PLATFORM_IDS } from '@/lib/targetPlatforms';

// Per-run instructions for the Content Agent, set in the "Run agent" composer.
// Client-safe (no server imports) so the composer and the API share one schema.
// Cron runs send no brief and keep the client's saved autopilot settings.

export const RUN_FORMATS = ['organic', 'paid', 'both'] as const;
export const ORGANIC_GOALS = ['engagement', 'promotional', 'educational', 'seasonal'] as const;
export const AD_OBJECTIVES = ['awareness', 'traffic', 'conversions', 'leads'] as const;
export const RUN_TONES = ['brand', 'playful', 'warm', 'bold', 'informative', 'premium'] as const;
export const CAPTION_LENGTHS = ['mixed', 'short', 'medium', 'long'] as const;
export const POST_COUNTS = [6, 9, 12] as const;
export const RUN_WINDOWS = ['next_week', 'next_two_weeks'] as const;

export const runBriefSchema = z.object({
  prompt: z.string().trim().max(1000).default(''),
  format: z.enum(RUN_FORMATS).default('organic'),
  // Empty = follow the client's saved content mix
  goals: z.array(z.enum(ORGANIC_GOALS)).default([]),
  adObjective: z.enum(AD_OBJECTIVES).default('conversions'),
  adPlatform: z.enum(['meta', 'google']).default('meta'),
  // Empty = let the agent pick per the client's posting preferences
  platforms: z.array(z.enum(TARGET_PLATFORM_IDS)).default([]),
  tone: z.enum(RUN_TONES).default('brand'),
  captionLength: z.enum(CAPTION_LENGTHS).default('mixed'),
  includeCta: z.boolean().default(true),
  useEmojis: z.boolean().default(true),
  useHashtags: z.boolean().default(true),
  preferFreshMedia: z.boolean().default(true),
  postCount: z.union([z.literal(6), z.literal(9), z.literal(12)]).default(12),
  window: z.enum(RUN_WINDOWS).default('next_week'),
});

export type RunBrief = z.infer<typeof runBriefSchema>;
export type OrganicGoal = (typeof ORGANIC_GOALS)[number];
export type AdObjective = (typeof AD_OBJECTIVES)[number];

export const DEFAULT_RUN_BRIEF: RunBrief = runBriefSchema.parse({});

export const GOAL_LABELS: Record<OrganicGoal, string> = {
  engagement: 'Engagement',
  promotional: 'Promotional',
  educational: 'Educational',
  seasonal: 'Seasonal',
};

export const AD_OBJECTIVE_LABELS: Record<AdObjective, string> = {
  awareness: 'Awareness',
  traffic: 'Traffic',
  conversions: 'Sales',
  leads: 'Leads',
};

export const TONE_LABELS: Record<RunBrief['tone'], string> = {
  brand: 'Brand default',
  playful: 'Playful',
  warm: 'Warm',
  bold: 'Bold',
  informative: 'Informative',
  premium: 'Premium',
};

const GOAL_GUIDANCE: Record<OrganicGoal, string> = {
  engagement: 'engagement — invite replies, opinions, tags or saves; conversational. Vary how you invite it (a prompt to tag someone, a this-or-that, a statement people will want to react to) — not always a closing question',
  promotional: 'promotional — a specific product, offer or reason to visit/buy now, with a concrete benefit',
  educational: 'educational — teach something useful (how it\'s made, tips, behind the process) that builds trust',
  seasonal: 'seasonal — tie the photo to the current season, weather, holidays or events in the window',
};

const OBJECTIVE_GUIDANCE: Record<AdObjective, string> = {
  awareness: 'AWARENESS — introduce the brand to cold audiences: memorable, distinctive, lead with who they are and what makes them different. Soft CTA (e.g. "Learn more", "Follow").',
  traffic: 'TRAFFIC — give a strong reason to click through now: curiosity, a specific thing to see or read. CTA points to the website.',
  conversions: 'SALES — drive a purchase or booking: lead with the product/offer and its concrete benefit, add urgency only if it\'s real, direct CTA (e.g. "Shop now", "Book today").',
  leads: 'LEADS — get people to enquire or sign up: lead with the problem solved or what they get, low-friction CTA (e.g. "Get a quote", "Sign up").',
};

const TONE_GUIDANCE: Record<Exclude<RunBrief['tone'], 'brand'>, string> = {
  playful: 'playful — light, witty, a bit cheeky',
  warm: 'warm — friendly, personal, community-minded',
  bold: 'bold — confident, punchy, short sentences',
  informative: 'informative — clear, helpful, fact-led',
  premium: 'premium — refined, understated, quality-focused',
};

const LENGTH_GUIDANCE: Record<Exclude<RunBrief['captionLength'], 'mixed'>, string> = {
  short: 'short — 1-2 sentences (under ~30 words)',
  medium: 'medium — 2-4 sentences (~30-80 words)',
  long: 'long — storytelling, 80-200 words',
};

export function organicEnabled(brief: RunBrief): boolean {
  return brief.format !== 'paid';
}

export function adsEnabled(brief: RunBrief): boolean {
  return brief.format !== 'organic';
}

/** The RUN BRIEF section appended to the agent's system prompt. */
export function formatRunBriefPrompt(brief: RunBrief): string {
  const lines: string[] = [];

  if (organicEnabled(brief)) {
    lines.push('ORGANIC POSTS:');
    if (brief.goals.length > 0) {
      lines.push(
        `- Only use these post_types, spread roughly evenly across the pool (this replaces the client's content_mix for this run):\n${brief.goals.map(g => `  • ${GOAL_GUIDANCE[g]}`).join('\n')}`
      );
    }
    if (brief.platforms.length > 0) {
      lines.push(`- Target platforms: ${brief.platforms.join(', ')}. Set platforms on every post to these, and write for how each one reads.`);
    }
    lines.push(
      '- Media: favour authentic, human, in-the-moment photos (people, process, atmosphere, behind the scenes) and vary subjects across the pool.'
    );
    lines.push(brief.useHashtags ? '- Hashtags: allowed (max 5, relevant only).' : '- Hashtags: NONE. Leave the hashtags array empty.');
  }

  if (adsEnabled(brief)) {
    lines.push(`PAID ADS (${brief.adPlatform === 'google' ? 'Google Ads' : 'Meta Ads'}):`);
    lines.push(`- Objective: ${OBJECTIVE_GUIDANCE[brief.adObjective]}`);
    lines.push(
      brief.adPlatform === 'google'
        ? '- Google limits: headline max 30 characters, description max 90 characters, primary text max 90 characters.'
        : '- Meta limits: headline ~40 characters, primary text ~125 characters before truncation, description ~30 characters.'
    );
    lines.push(
      '- Media: pick scroll-stopping images with one clear subject, strong contrast and little clutter — hero product/service shots over candid or busy scenes. Avoid photos with lots of existing text. Use a different photo for each ad variant where possible.'
    );
    lines.push('- Vary the angle across ad variants (benefit-led, social proof, offer, problem/solution) so they can be A/B tested.');
  }

  lines.push('ALL COPY:');
  lines.push(
    brief.tone === 'brand'
      ? '- Tone: the brand\'s default voice.'
      : `- Tone: lean ${TONE_GUIDANCE[brief.tone]} — but stay within the brand voice and tone of voice guide.`
  );
  if (brief.captionLength !== 'mixed' && organicEnabled(brief)) {
    lines.push(`- Organic caption length: ${LENGTH_GUIDANCE[brief.captionLength]}.`);
  }
  lines.push(
    brief.includeCta
      ? '- Include a call to action where it fits, and vary its form across the pool (visit, book, order, tag a friend, save this, link in bio). A question is only one kind of CTA — no more than 1 in 3 posts may end with one.'
      : '- No hard call to action — let the content speak for itself.'
  );
  lines.push(brief.useEmojis ? '- Emojis: sparingly, only where they fit the brand.' : '- Emojis: NONE.');
  if (brief.preferFreshMedia) {
    lines.push('- Strongly prefer photos with times_used = 0; only reuse a photo if nothing unused fits.');
  }

  let section = `\n\nRUN BRIEF (set by the account manager for this run — follows brand rules, overrides defaults):\n${lines.join('\n')}`;

  if (brief.prompt) {
    section += `\n\nACCOUNT MANAGER'S INSTRUCTIONS FOR THIS RUN (highest priority after the brand's tone of voice guide and the platform rules):\n"""\n${brief.prompt}\n"""`;
  }

  return section;
}
