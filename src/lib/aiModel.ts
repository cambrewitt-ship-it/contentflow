// OpenAI models used across the app, in one place.
//
// AI_MODEL — all copy writing (captions, remix, chat, TOV, website analysis).
//   GPT-6.1 Sol is OpenAI's balanced tier: near-flagship writing quality at
//   $2 / $10 per 1M input/output tokens — cheaper than the gpt-4o it replaces
//   ($2.50 / $10). The flagship (gpt-6-astra, $10 / $50) isn't worth 5x for captions.
// AI_MODEL_FAST — high-volume, low-stakes work such as tagging gallery photos.
// AGENT_MODEL — the Content Agent loop. It relies on function calling, which
//   OpenAI doesn't offer for GPT-6 Sol/Astra on Chat Completions (they can't
//   turn reasoning off), so it stays on a non-reasoning model until the loop
//   moves to the Responses API.

export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-6.1-sol';
export const AI_MODEL_FAST = process.env.OPENAI_FAST_MODEL || 'gpt-6-luna';
export const AGENT_MODEL = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1';

// Pass these to completionParams (src/lib/openaiParams.ts), which picks the
// right length/temperature params for classic vs reasoning models.
