// Older chat models (gpt-4o, gpt-4-turbo, gpt-3.5) accept max_tokens and a custom
// temperature. Reasoning models (o-series, gpt-5 and later) reject both: they take
// max_completion_tokens, only allow the default temperature, and spend part of the
// completion budget on hidden reasoning before writing any visible text.
const LEGACY_MODEL = /^(ft:)?(gpt-4|gpt-3\.5|chatgpt-4o)/;

// Extra completion budget so reasoning tokens don't crowd out the visible answer.
const REASONING_HEADROOM = 4000;

export function isReasoningModel(model: string): boolean {
  return !LEGACY_MODEL.test(model);
}

export function completionParams(
  model: string,
  opts: { maxTokens?: number; temperature?: number } = {}
) {
  if (!isReasoningModel(model)) {
    return {
      model,
      ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    };
  }
  return {
    model,
    reasoning_effort: 'low' as const,
    ...(opts.maxTokens !== undefined && {
      max_completion_tokens: opts.maxTokens + REASONING_HEADROOM,
    }),
  };
}
