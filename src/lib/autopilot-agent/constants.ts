// Shared tunables for the agentic autopilot engine. Centralized here (rather
// than in loop.ts or autopilot-engine.ts directly) so the pre-flight credit
// check in /api/autopilot/generate-plan/route.ts can reference the same
// numbers without creating an import cycle (engine.ts -> loop.ts -> tools.ts).

export const MAX_ITERATIONS = 15;

// Calibrated against the old v2 one-shot engine's implied cost (1 base + N
// candidates credits for a ~6-7k token prompt+completion). Not an exact
// science — revisit once real agent-run token usage data exists.
export const TOKENS_PER_CREDIT = 500;

// Conservative per-iteration token estimate (growing message history + tool
// results) used only for the pre-flight credit-check ceiling — actual usage
// is trued up afterward via trackAICreditUsage with real token counts, which
// in practice should be well below this worst case since most runs finalize
// long before hitting MAX_ITERATIONS.
const AVG_TOKENS_PER_ITERATION_ESTIMATE = 1800;

export function estimateWorstCaseCredits(): number {
  return Math.ceil((MAX_ITERATIONS * AVG_TOKENS_PER_ITERATION_ESTIMATE) / TOKENS_PER_CREDIT);
}
