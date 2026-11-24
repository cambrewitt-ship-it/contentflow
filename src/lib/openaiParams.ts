// Older chat models (gpt-4o, gpt-4-turbo, gpt-3.5) accept max_tokens and a custom
// temperature. Reasoning models (o-series, gpt-5 and later) reject both: they take
// max_completion_tokens, only allow the default temperature, and spend part of the
// completion budget on hidden reasoning before writing any visible text.
const LEGACY_MODEL = /^(ft:)?(gpt-4|gpt-3\.5|chatgpt-4o)/;

// Extra completion budget so reasoning tokens don't crowd out the visible answer.
const REASONING_HEADROOM = 4000;

// gpt-5.1 and later accept reasoning_effort 'none'. On newer models (e.g. gpt-6.x)
// /v1/chat/completions rejects function tools combined with any other effort, so
// tool-calling requests (the Content Agent loop) must send 'none' there.
const SUPPORTS_NO_REASONING = /^(ft:)?gpt-(5\.[1-9]|[6-9]|\d{2,})/;

export function isReasoningModel(model: string): boolean {
  return !LEGACY_MODEL.test(model);
}

export function completionParams(
  model: string,
  opts: { maxTokens?: number; temperature?: number; tools?: boolean } = {}
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
    // 'none' is valid for the API but missing from the openai SDK 5.x type, hence the cast.
    reasoning_effort:
      opts.tools && SUPPORTS_NO_REASONING.test(model) ? ('none' as unknown as 'low') : ('low' as const),
    ...(opts.maxTokens !== undefined && {
      max_completion_tokens: opts.maxTokens + REASONING_HEADROOM,
    }),
  };
}
