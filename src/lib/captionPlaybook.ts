import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

// A client's caption playbook: rules learned from the agency's feedback on
// past posts (client_caption_rules, migration 027). Fed to every Content
// Agent run and caption rewrite as must-follow rules.

export interface CaptionRule {
  id: string;
  rule: string;
  source: 'feedback' | 'manual';
  created_at: string;
}

// Keeps the prompt bounded if a playbook grows long; newest rules win.
const MAX_PROMPT_RULES = 30;

export async function listCaptionRules(clientId: string): Promise<CaptionRule[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('client_caption_rules')
    .select('id, rule, source, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  // Missing table (migration not run yet) just means an empty playbook
  if (error) {
    logger.warn('Caption playbook: could not load rules', { clientId, error: error.message });
    return [];
  }
  return (data ?? []) as CaptionRule[];
}

export async function getCaptionRuleTexts(clientId: string): Promise<string[]> {
  const rules = await listCaptionRules(clientId);
  return rules.slice(-MAX_PROMPT_RULES).map(r => r.rule);
}

/** Adds a rule unless the playbook already has the same text. Returns the saved rule, or null. */
export async function saveCaptionRule(params: {
  clientId: string;
  userId: string;
  rule: string;
  source: 'feedback' | 'manual';
  sourceCandidateId?: string | null;
}): Promise<CaptionRule | null> {
  const rule = params.rule.trim().slice(0, 500);
  if (!rule) return null;

  const existing = await listCaptionRules(params.clientId);
  const dupe = existing.find(r => r.rule.trim().toLowerCase() === rule.toLowerCase());
  if (dupe) return dupe;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('client_caption_rules')
    .insert({
      client_id: params.clientId,
      user_id: params.userId,
      rule,
      source: params.source,
      source_candidate_id: params.sourceCandidateId ?? null,
    })
    .select('id, rule, source, created_at')
    .single();

  if (error) {
    logger.error('Caption playbook: failed to save rule', { clientId: params.clientId, error: error.message });
    return null;
  }
  return data as CaptionRule;
}

export function formatPlaybookPromptSection(rules: string[]): string {
  if (rules.length === 0) return '';
  return `CLIENT CAPTION PLAYBOOK (rules from the account manager's feedback on past posts — follow every one; they override defaults, the run brief and learned style preferences):
${rules.map(r => `- ${r}`).join('\n')}`;
}
