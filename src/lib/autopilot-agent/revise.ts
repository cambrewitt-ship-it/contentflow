import OpenAI from 'openai';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { formatTovPromptSection } from '@/lib/brandVoice';
import { formatPlaybookPromptSection } from '@/lib/captionPlaybook';
import { fetchBrandContext } from './context';
import type { BrandContext } from './context';
import { formatRunBriefPrompt } from './runBrief';
import type { RunBrief } from './runBrief';

// One-shot revisions of a single Content Agent candidate, driven by the
// account manager's feedback in swipe review: rewrite the copy, explain why
// the agent wrote it that way, and distil the feedback into a reusable
// playbook rule.

// Bounded so a slow completion fails with an error instead of hanging the request
const openai = new OpenAI({ timeout: 45_000, maxRetries: 1 });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export interface CandidateForRevision {
  id: string;
  client_id: string;
  media_gallery_id: string | null;
  caption: string;
  hashtags: string[] | null;
  platforms: string[] | null;
  post_type: string | null;
  ai_reasoning: string | null;
  ad_headline: string | null;
  ad_primary_text: string | null;
  ad_description: string | null;
  ad_platform: string | null;
}

export interface RevisedCopy {
  caption: string;
  hashtags: string[];
  ad_headline: string | null;
  ad_primary_text: string | null;
  ad_description: string | null;
}

export interface RevisionResult {
  explanation: string | null;
  rule: string | null;
  copy: RevisedCopy | null;
  totalTokens: number;
}

async function photoDescription(mediaGalleryId: string | null): Promise<string | null> {
  if (!mediaGalleryId) return null;
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('media_gallery')
    .select('ai_description, user_context')
    .eq('id', mediaGalleryId)
    .maybeSingle();
  if (!data) return null;
  return [data.ai_description, data.user_context].filter(Boolean).join(' — ') || null;
}

function brandSection(brandCtx: BrandContext): string {
  const c = brandCtx.client;
  if (!c) return '';
  return [
    `Brand: ${c.name}`,
    c.brand_tone && `Tone: ${c.brand_tone}`,
    c.target_audience && `Audience: ${c.target_audience}`,
    c.caption_dos && `Caption do's: ${c.caption_dos}`,
    c.caption_donts && `Caption don'ts: ${c.caption_donts}`,
    c.brand_voice_examples && `Brand voice examples:\n${c.brand_voice_examples}`,
    formatTovPromptSection(c.brand_tov),
  ].filter(Boolean).join('\n');
}

function currentCopy(candidate: CandidateForRevision): string {
  if (candidate.post_type === 'paid_ad') {
    return JSON.stringify({
      ad_platform: candidate.ad_platform,
      ad_headline: candidate.ad_headline,
      ad_primary_text: candidate.ad_primary_text,
      ad_description: candidate.ad_description,
    }, null, 2);
  }
  return JSON.stringify({
    caption: candidate.caption,
    hashtags: candidate.hashtags ?? [],
    post_type: candidate.post_type,
    platforms: candidate.platforms ?? [],
  }, null, 2);
}

export async function reviseCandidate(params: {
  candidate: CandidateForRevision;
  feedback: string;
  rules: string[];
  runBrief: RunBrief | null;
  rewrite: boolean;
  explain: boolean;
  deriveRule: boolean;
  brandCtx?: BrandContext;
}): Promise<RevisionResult> {
  const { candidate, feedback, rules, runBrief, rewrite, explain, deriveRule } = params;
  const isAd = candidate.post_type === 'paid_ad';
  const [brandCtx, photo] = await Promise.all([
    params.brandCtx ?? fetchBrandContext(candidate.client_id),
    photoDescription(candidate.media_gallery_id),
  ]);

  const outputFields: string[] = [];
  if (explain) {
    outputFields.push(
      '"explanation": 1-2 plain sentences on why the original was written this way. Be honest and specific: point at the instruction, preference or habit that caused it (e.g. "the run brief asked for a call to action on every post"). Don\'t apologise.'
    );
  }
  if (deriveRule) {
    outputFields.push(
      '"rule": the feedback as ONE short, reusable instruction for all future copy for this client (imperative, under 30 words). Use "" if the feedback only applies to this one post (e.g. a factual fix or a photo complaint).'
    );
  }
  if (rewrite) {
    outputFields.push(
      isAd
        ? '"ad_headline", "ad_primary_text", "ad_description": the rewritten ad copy, keeping the same platform limits.'
        : '"caption": the rewritten caption WITHOUT hashtags, and "hashtags": an array of hashtags (keep, trim or replace the originals; max 5, none if the rules say none).'
    );
  }

  const system = `You are the senior copywriter reviewing ${isAd ? 'ad copy' : 'a social media caption'} that an AI content agent wrote for a client. The account manager has given feedback on it.

${brandSection(brandCtx)}

${formatPlaybookPromptSection(rules)}

${runBrief ? `Instructions the agent was given for this run:${formatRunBriefPrompt(runBrief)}` : ''}

Rules for any rewrite: apply the feedback fully, keep what wasn't criticised, stay specific to the photo, follow the playbook and tone of voice, no corporate language ("discover", "elevate", "unlock", "seamless"...).

Respond with a JSON object containing:
${outputFields.map(f => `- ${f}`).join('\n')}`;

  const user = `Photo: ${photo ?? 'no description available'}

The agent's reasoning when it wrote this: ${candidate.ai_reasoning ?? 'none recorded'}

Current copy:
${currentCopy(candidate)}

Account manager's feedback:
${feedback}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch {
    parsed = {};
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  let copy: RevisedCopy | null = null;
  if (rewrite) {
    if (isAd) {
      const headline = str(parsed.ad_headline);
      const primary = str(parsed.ad_primary_text);
      if (headline && primary) {
        copy = {
          caption: primary,
          hashtags: [],
          ad_headline: headline,
          ad_primary_text: primary,
          ad_description: str(parsed.ad_description),
        };
      }
    } else {
      const caption = str(parsed.caption);
      if (caption) {
        copy = {
          caption,
          hashtags: Array.isArray(parsed.hashtags)
            ? (parsed.hashtags as unknown[]).filter((h): h is string => typeof h === 'string').slice(0, 5)
            : candidate.hashtags ?? [],
          ad_headline: null,
          ad_primary_text: null,
          ad_description: null,
        };
      }
    }
    if (!copy) throw new Error('The rewrite came back empty — try again.');
  }

  return {
    explanation: explain ? str(parsed.explanation) : null,
    rule: deriveRule ? str(parsed.rule) : null,
    copy,
    totalTokens: completion.usage?.total_tokens ?? 0,
  };
}
