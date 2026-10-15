import OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import logger from '@/lib/logger';
import { describeProfile, normalizeHandle } from './profile';
import type { ResearchPlatform, ResearchProfile, TrendFindings, TrendItem } from './types';

// Live web research through OpenAI's Responses API web search tool: current
// trends for the niche, and candidate accounts to track.

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function monthYear(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function searchJson(prompt: string, location: string): Promise<{ json: unknown; sources: Array<{ title: string; url: string }> }> {
  const response: Response = await openai.responses.create({
    model: MODEL,
    tools: [
      {
        type: 'web_search_preview',
        search_context_size: 'medium',
        ...(location ? { user_location: { type: 'approximate' as const, city: null, region: location } } : {}),
      },
    ],
    input: prompt,
  });

  const sources = new Map<string, string>();
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const a of part.annotations) {
        if (a.type === 'url_citation') sources.set(a.url, a.title);
      }
    }
  }

  return {
    json: parseJsonLoose(response.output_text),
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
}

// The web search tool can't be combined with strict JSON mode, so the model is
// asked for JSON and we take the outermost object from its answer.
function parseJsonLoose(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function str(v: unknown, max = 600): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function trendItems(v: unknown): TrendItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(item => {
      const o = (item ?? {}) as Record<string, unknown>;
      return {
        title: str(o.title, 120),
        description: str(o.description),
        how_to_use: str(o.how_to_use),
        sources: Array.isArray(o.sources) ? o.sources.filter((s): s is string => typeof s === 'string').slice(0, 3) : [],
      };
    })
    .filter(t => t.title && t.description)
    .slice(0, 8);
}

export async function searchTrends(
  clientName: string,
  profile: ResearchProfile,
  platforms: ResearchPlatform[]
): Promise<TrendFindings> {
  const platformText = platforms.map(p => (p === 'instagram' ? 'Instagram' : 'TikTok')).join(' and ');
  const prompt = `You are a social media strategist researching what is working RIGHT NOW (${monthYear()}) in organic ${platformText} content.

${describeProfile(clientName, profile)}

Search the web for current, specific information (posts from the last ~60 days preferred: social media news, creator/marketing blogs, platform announcements, trend reports). Find:
1. trending_formats: trending content formats, meme templates, Reels/TikTok trends, audio trends and creative styles that this kind of business could use.
2. engagement_tactics: tactics accounts are using right now to increase organic reach and engagement (e.g. hooks, carousels, comment prompts, collabs, posting cadence, algorithm changes).
3. caption_trends: how captions are being written right now (length, hooks, CTAs, tone, hashtag/SEO keyword usage).

Prefer things relevant to the business's category, location and audience over generic advice. Be concrete — name the format or trend, don't just say "use video".
${profile.language !== 'English' ? `Search ${profile.language}-language sources as well as English ones — local trends matter. ` : ''}Write the text values in ${profile.language}; keep the JSON keys in English.

Answer with ONLY a JSON object, no prose:
{"trending_formats":[{"title":"","description":"what it is and why it's working now","how_to_use":"how ${clientName} could use it","sources":["url"]}],"engagement_tactics":[...same shape],"caption_trends":[...same shape]}
Give 3-6 items per list.`;

  try {
    const { json, sources } = await searchJson(prompt, profile.location);
    const o = (json ?? {}) as Record<string, unknown>;
    return {
      trending_formats: trendItems(o.trending_formats),
      engagement_tactics: trendItems(o.engagement_tactics),
      caption_trends: trendItems(o.caption_trends),
      sources: sources.slice(0, 15),
    };
  } catch (err) {
    logger.error('Competitor research: trend search failed', err);
    throw new Error('Trend search failed');
  }
}

export interface RawSuggestion {
  handle: string;
  name: string | null;
  reason: string;
  relationship: 'competitor' | 'inspiration';
}

export async function suggestAccounts(
  clientName: string,
  profile: ResearchProfile,
  platform: ResearchPlatform,
  exclude: string[],
  query?: string
): Promise<RawSuggestion[]> {
  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const prompt = `Find real, currently active ${platformName} accounts relevant to this business:

${describeProfile(clientName, profile)}
${query ? `\nThe user is specifically looking for: ${query}\n` : ''}
Search the web to find:
- "competitor": direct competitors — similar businesses${profile.location ? ` in or near ${profile.location}` : ''} with active ${platformName} accounts.
- "inspiration": accounts in the same niche (anywhere) known for strong ${platformName} content this business could learn from.

Only include accounts whose exact ${platformName} handle you found in your search results — never guess or invent a handle.${platform === 'instagram' ? ' Prefer business accounts.' : ''}
${exclude.length > 0 ? `Do not include these already-tracked handles: ${exclude.join(', ')}\n` : ''}
Answer with ONLY a JSON object, no prose:
{"accounts":[{"handle":"exact handle without @","name":"business or creator name","relationship":"competitor|inspiration","reason":"one sentence on why it's relevant"}]}
Write the "reason" values in ${profile.language}. Give up to 12 accounts, competitors first.`;

  const { json } = await searchJson(prompt, profile.location);
  const list = ((json ?? {}) as { accounts?: unknown }).accounts;
  if (!Array.isArray(list)) return [];

  const seen = new Set(exclude.map(h => h.toLowerCase()));
  const out: RawSuggestion[] = [];
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const handle = normalizeHandle(platform, str(o.handle, 120));
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    out.push({
      handle,
      name: str(o.name, 120) || null,
      reason: str(o.reason, 300),
      relationship: o.relationship === 'inspiration' ? 'inspiration' : 'competitor',
    });
  }
  return out.slice(0, 12);
}
