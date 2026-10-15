import OpenAI from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import logger from '@/lib/logger';
import type { BrandContext } from '@/lib/autopilot-agent/context';
import { describeProfile } from './profile';
import type {
  AccountStats,
  PostIdea,
  RankedPost,
  ResearchProfile,
  ResearchReport,
  TrendFindings,
} from './types';

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// Images sent to the vision model; detail "low" keeps each at a flat ~85 tokens.
const MAX_IMAGES = 12;

export interface SynthesisInput {
  clientName: string;
  profile: ResearchProfile;
  brand: BrandContext;
  ownRecentCaptions: string[];
  posts: RankedPost[];
  stats: AccountStats[];
  trends: TrendFindings | null;
}

type SynthesisOutput = Omit<ResearchReport, 'posts' | 'account_stats' | 'trend_sources' | 'trending_formats'>;

function brandVoice(brand: BrandContext): string {
  const c = brand.client;
  if (!c) return '';
  return [
    c.brand_tone && `Brand tone: ${c.brand_tone}`,
    c.brand_tov && `Tone of voice guide: ${c.brand_tov.slice(0, 1500)}`,
    c.brand_voice_examples && `Example captions in their voice:\n${c.brand_voice_examples.slice(0, 1200)}`,
    c.caption_dos && `Caption do's: ${c.caption_dos}`,
    c.caption_donts && `Caption don'ts: ${c.caption_donts}`,
    c.value_proposition && `Value proposition: ${c.value_proposition}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function postBlock(p: RankedPost): string {
  const metrics = [
    `${p.likes} likes`,
    `${p.comments} comments`,
    p.shares !== null && `${p.shares} shares`,
    p.saves !== null && `${p.saves} saves`,
    p.views !== null && `${p.views} views`,
    p.engagement_rate !== null && `${p.engagement_rate}% engagement`,
    `${p.relative_score}x the account's median`,
  ].filter(Boolean);
  return [
    `[${p.ref}] ${p.platform} @${p.handle} — ${p.format}${p.posted_at ? `, posted ${p.posted_at.slice(0, 10)}` : ''}`,
    `Metrics: ${metrics.join(', ')}`,
    p.sound && `Sound: ${p.sound}`,
    `Caption: ${p.caption.slice(0, 900) || '(no caption)'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function statsBlock(s: AccountStats): string {
  const mix = Object.entries(s.format_mix).map(([k, v]) => `${k} ${v}`).join(', ');
  return `${s.platform} @${s.handle}: ${s.followers ?? '?'} followers, ${s.posts_sampled} posts sampled, ${s.posts_per_week ?? '?'} posts/week, avg engagement ${s.avg_engagement_rate ?? '?'}%, formats: ${mix}, avg caption ${s.avg_caption_words} words, ${s.avg_hashtags} hashtags/post, emojis in ${Math.round(s.emoji_share * 100)}% of captions, questions in ${Math.round(s.question_share * 100)}%, top hashtags: ${s.top_hashtags.join(' ') || 'none'}, most active days: ${s.top_days.join(', ') || '?'}`;
}

function buildPrompt(input: SynthesisInput): string {
  const { clientName, profile, brand, ownRecentCaptions, posts, stats, trends } = input;
  const trendText = trends
    ? [
        'Trending formats:',
        ...trends.trending_formats.map(t => `- ${t.title}: ${t.description}`),
        'Engagement tactics in use right now:',
        ...trends.engagement_tactics.map(t => `- ${t.title}: ${t.description}`),
        'Caption trends:',
        ...trends.caption_trends.map(t => `- ${t.title}: ${t.description}`),
      ].join('\n')
    : 'No web trend research for this run.';

  return `You are a senior social media strategist doing competitor research for ${clientName}.

## The business
${describeProfile(clientName, profile)}
${brandVoice(brand)}

## Their own recent captions
${ownRecentCaptions.length ? ownRecentCaptions.map(c => `- ${c.slice(0, 200)}`).join('\n') : '(none yet)'}

## Tracked accounts (competitors and accounts in the niche)
${stats.map(statsBlock).join('\n')}

## Top-performing posts (ranked by performance vs. each account's own median)
Images for posts that have one are attached in the same order, each labelled with its ref.
${posts.map(postBlock).join('\n\n')}

## Live web trend research
${trendText}

## Your task
Study the posts (visuals AND captions AND metrics), the account stats and the trends. Explain what is actually driving engagement, then turn it into specific, usable direction for ${clientName}'s organic social content. Ground every claim in the data — cite post refs like P3. Be specific about visuals: composition, people vs. product, text overlays, colour, lighting, editing style, meme templates.

Then write post ideas ${clientName} could make with what a small business realistically has (phone camera, their own space, products, staff, customers). Captions must be ready to post and written in ${clientName}'s brand voice (follow the tone and do's/don'ts above), not copied from competitors.

Write every text value — insights and captions — in ${profile.language}${profile.location ? `, using the spelling and conventions of ${profile.location}` : ''}. Keep the JSON keys in English.

Return ONLY a JSON object:
{
  "summary": "3-5 sentence executive summary of what's working and the biggest opportunity",
  "top_posts": [{"ref":"P1","why_it_works":"","visual_style":"","hook":"the opening line/first-second hook"}],
  "visual_trends": [{"title":"","description":"","examples":["P1"]}],
  "caption_patterns": [{"title":"","description":"","example":"short quoted or paraphrased example"}],
  "engagement_tactics": [{"title":"","description":"","evidence":"which posts/accounts show it"}],
  "opportunities": ["gap or opportunity for ${clientName} compared with their own recent posts"],
  "post_ideas": [{"title":"","platform":"instagram|tiktok|both","format":"reel|carousel|image|video|story","visual_direction":"what to shoot and how it should look","hook":"","caption":"full ready-to-post caption","hashtags":["#tag"],"inspired_by":"post refs or trend name"}]
}
Cover up to 8 top_posts, 3-5 visual_trends, 3-5 caption_patterns, 3-5 engagement_tactics, 3-5 opportunities and 6-8 post_ideas.`;
}

function arr<T>(v: unknown, map: (o: Record<string, unknown>) => T | null, max: number): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(item => map((item ?? {}) as Record<string, unknown>))
    .filter((x): x is T => x !== null)
    .slice(0, max);
}

const s = (v: unknown, max = 1500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, max) : [];

function parseOutput(raw: Record<string, unknown>): SynthesisOutput {
  return {
    summary: s(raw.summary, 2000),
    top_posts: arr(raw.top_posts, o => (s(o.ref) ? { ref: s(o.ref, 10), why_it_works: s(o.why_it_works), visual_style: s(o.visual_style), hook: s(o.hook, 300) } : null), 10),
    visual_trends: arr(raw.visual_trends, o => (s(o.title) ? { title: s(o.title, 120), description: s(o.description), examples: strList(o.examples, 6) } : null), 6),
    caption_patterns: arr(raw.caption_patterns, o => (s(o.title) ? { title: s(o.title, 120), description: s(o.description), example: s(o.example, 400) } : null), 6),
    engagement_tactics: arr(raw.engagement_tactics, o => (s(o.title) ? { title: s(o.title, 120), description: s(o.description), evidence: s(o.evidence, 400) } : null), 6),
    opportunities: strList(raw.opportunities, 6),
    post_ideas: arr<PostIdea>(raw.post_ideas, o =>
      s(o.caption)
        ? {
            title: s(o.title, 120),
            platform: s(o.platform, 20) || 'instagram',
            format: s(o.format, 20),
            visual_direction: s(o.visual_direction),
            hook: s(o.hook, 300),
            caption: s(o.caption, 2200),
            hashtags: strList(o.hashtags, 15).map(h => (h.startsWith('#') ? h : `#${h}`)),
            inspired_by: s(o.inspired_by, 200),
          }
        : null,
    10),
  };
}

export async function synthesizeReport(input: SynthesisInput): Promise<{ output: SynthesisOutput; tokens: number }> {
  const prompt = buildPrompt(input);
  const withImages = input.posts.filter(p => p.image_url).slice(0, MAX_IMAGES);

  const call = async (includeImages: boolean) => {
    const content: ChatCompletionContentPart[] = [{ type: 'text', text: prompt }];
    if (includeImages) {
      for (const p of withImages) {
        content.push({ type: 'text', text: `Image for ${p.ref} (@${p.handle}):` });
        content.push({ type: 'image_url', image_url: { url: p.image_url!, detail: 'low' } });
      }
    }
    return openai.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 6000,
      messages: [{ role: 'user', content }],
    });
  };

  let completion;
  try {
    completion = await call(withImages.length > 0);
  } catch (err) {
    // Social CDN image URLs expire or block fetching; one bad URL fails the
    // whole request, so fall back to captions + metrics only.
    if (withImages.length === 0) throw err;
    logger.warn('Competitor research: vision call failed, retrying without images', {
      error: err instanceof Error ? err.message : String(err),
    });
    completion = await call(false);
  }

  const text = completion.choices[0]?.message?.content ?? '{}';
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The research agent returned an unreadable report');
  }

  return { output: parseOutput(raw), tokens: completion.usage?.total_tokens ?? 0 };
}
