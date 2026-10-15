import OpenAI from 'openai';
import { AI_MODEL, completionParams } from '@/lib/aiModel';

// Reads a scraped website and fills in the business profile, plus a draft
// Tone of Voice guide (markdown, stored on clients.brand_tov) written from the
// site's own copy, so new clients get on-brand captions from day one.

export interface WebsiteAnalysis {
  company_name: string;
  company_description: string;
  value_proposition: string;
  brand_tone: string;
  target_audience: string;
  brand_tov: string;
}

export interface ScrapedSite {
  url: string;
  page_title?: string | null;
  meta_description?: string | null;
  scraped_content?: string | null;
}

// Marks a TOV that came from the website rather than an uploaded guide.
export function websiteTovSource(url: string): string {
  return `Generated from website (${url})`;
}

const SYSTEM_PROMPT = `You are a brand strategist and copywriter. Read the website content and return ONLY a JSON object with these fields:

{
  "company_name": "The official business name",
  "company_description": "2-3 sentences on what the business does and its mission",
  "value_proposition": "Their main benefit or unique selling point for customers",
  "brand_tone": "A short phrase describing how they write (e.g. 'warm, cheeky and down-to-earth')",
  "target_audience": "Who they serve",
  "brand_tov": "A draft Tone of Voice guide in markdown (see below)"
}

The brand_tov guide is given to an AI copywriter as the rules for writing this brand's social media captions. Base it on how the website is ACTUALLY written — quote their real phrases. Don't invent facts, offers or products. Use these sections:

# Tone of Voice (draft from website)
## Voice in a nutshell — 2-3 sentences
## Personality — 3-4 traits, each as "We are X, not Y" with one line on what it means in a caption
## Vocabulary — words and phrases they use (quoted from the site); words and phrases to avoid (corporate jargon, clichés that clash with their voice)
## Grammar and style — spelling variant (US/UK/NZ/AU English, judged from the site), sentence length, contractions, capitalisation, punctuation habits
## Emoji and hashtags — what fits this voice; if the site gives no signal, give a conservative default and say it's a default
## Example lines — 3-5 lines quoted word-for-word from the site that best capture the voice
## Writing social captions — 4-6 practical do's and don'ts for captions in this voice

Keep the guide under 500 words. If something is unclear, make a reasonable inference from the content.`;

export function formatScrapeForAnalysis(site: ScrapedSite): string {
  return `Website: ${site.url}
Title: ${site.page_title || ''}
Meta Description: ${site.meta_description || ''}
Content: ${site.scraped_content || ''}`;
}

export async function analyzeWebsite(content: string): Promise<WebsiteAnalysis> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000 });

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this website content:\n\n${content}` },
    ],
    response_format: { type: 'json_object' },
    ...completionParams(AI_MODEL, { maxTokens: 3000, temperature: 0.3 }),
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('No analysis content received from OpenAI');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const analysis: WebsiteAnalysis = {
    company_name: str(parsed.company_name),
    company_description: str(parsed.company_description),
    value_proposition: str(parsed.value_proposition),
    brand_tone: str(parsed.brand_tone),
    target_audience: str(parsed.target_audience),
    brand_tov: str(parsed.brand_tov),
  };

  const required = ['company_name', 'company_description', 'value_proposition', 'brand_tone', 'target_audience'] as const;
  for (const field of required) {
    if (!analysis[field]) throw new Error(`Missing required field: ${field}`);
  }
  return analysis;
}
