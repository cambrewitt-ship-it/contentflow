// Brand voice sources the AI copy prompts can draw on:
//   - Tone of Voice (TOV) guide, stored as markdown on clients.brand_tov
//   - Brand voice examples (best captions)
//   - Caption do's / don'ts
// Each source can be switched on/off per client (use_* columns).

export const BRAND_VOICE_COLUMNS =
  'caption_dos, caption_donts, brand_voice_examples, brand_tov, use_brand_tov, use_voice_examples, use_caption_rules';

// Keeps prompts a sensible size if someone uploads a very long guide.
const MAX_TOV_PROMPT_CHARS = 20000;

export interface BrandVoiceRow {
  caption_dos?: string | null;
  caption_donts?: string | null;
  brand_voice_examples?: string | null;
  brand_tov?: string | null;
  use_brand_tov?: boolean | null;
  use_voice_examples?: boolean | null;
  use_caption_rules?: boolean | null;
}

export interface ResolvedBrandVoice {
  tov: string | null;
  voice_examples: string | null;
  dos: string | null;
  donts: string | null;
}

// Returns only the voice sources that are switched on and non-empty.
// A missing flag (e.g. migration not yet run) counts as on.
export function resolveBrandVoice(row: BrandVoiceRow | null | undefined): ResolvedBrandVoice {
  const clean = (v?: string | null) => (v && v.trim() ? v : null);
  const rulesOn = row?.use_caption_rules !== false;
  const tov = row?.use_brand_tov !== false ? clean(row?.brand_tov) : null;

  return {
    tov: tov && tov.length > MAX_TOV_PROMPT_CHARS ? tov.slice(0, MAX_TOV_PROMPT_CHARS) : tov,
    voice_examples: row?.use_voice_examples !== false ? clean(row?.brand_voice_examples) : null,
    dos: rulesOn ? clean(row?.caption_dos) : null,
    donts: rulesOn ? clean(row?.caption_donts) : null,
  };
}

// Prompt block for the TOV guide. The guide is the brand's copy rulebook;
// examples show it in practice and do's/don'ts are specific overrides.
export function formatTovPromptSection(tov: string | null): string {
  if (!tov) return '';
  return `📘 BRAND TONE OF VOICE GUIDE (MANDATORY COPY RULES):
The brand's official tone-of-voice guide is below. Every word you write must follow it — personality, vocabulary, grammar, punctuation, emoji use, formatting and any words or phrases it prefers or bans. If brand voice examples are also provided, use them to see the guide applied in practice. Specific do's/don'ts take precedence over the guide where they conflict.

<tone_of_voice_guide>
${tov}
</tone_of_voice_guide>`;
}
