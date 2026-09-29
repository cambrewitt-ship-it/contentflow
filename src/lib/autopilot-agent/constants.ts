// Shared tunables for the agentic autopilot engine. Centralized here (rather
// than in loop.ts or autopilot-engine.ts directly) so the pre-flight credit
// check in /api/autopilot/generate-plan/route.ts can reference the same
// numbers without creating an import cycle (engine.ts -> loop.ts -> tools.ts).

// 15 was too tight in practice: the suggested workflow alone is ~7 distinct
// context-gathering tool calls, and when the model doesn't batch them into
// parallel tool_calls per turn it can burn the whole budget before ever
// calling propose_post once (observed failure: "hit the iteration cap
// without proposing any candidates"). Raised with headroom for that plus
// drafting/critiquing/proposing 10-12 candidates.
export const MAX_ITERATIONS = 24;

// Agent runs are billed per candidate produced (1 base + 1 per candidate),
// matching the old v2 one-shot engine. Billing on raw token usage doesn't
// work for the agent loop: every iteration resends the whole conversation
// (system prompt, context briefing, prior tool results), so cumulative
// prompt tokens grow roughly quadratically with iterations and a single run
// was charged hundreds of credits.
export const BASE_CREDITS_PER_RUN = 1;

// Upper bound on candidates in one run: up to 12 organic posts (runBrief
// postCount / saved-settings cap) plus up to 10 ad copy variants
// (ad_copy_settings.variants_per_run cap). A paid-only brief is at most 12.
export const MAX_CANDIDATES_PER_RUN = 22;

export function creditsForRun(candidatesCreated: number): number {
  return BASE_CREDITS_PER_RUN + Math.max(0, candidatesCreated);
}

// Pre-flight ceiling for /api/autopilot/generate-plan and the agent panel.
export function estimateWorstCaseCredits(): number {
  return creditsForRun(MAX_CANDIDATES_PER_RUN);
}
