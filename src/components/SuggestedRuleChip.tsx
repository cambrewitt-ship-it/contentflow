'use client';

import { useState } from 'react';
import { BookOpen, Check, Loader2 } from 'lucide-react';
import { authedFetchJson } from '@/lib/authedFetch';

/**
 * Offers to save a rule the AI distilled from a Content Suite chat
 * instruction (e.g. "no emojis") to the client's caption playbook, so every
 * future caption follows it.
 */
export function SuggestedRuleChip({
  clientId,
  rule,
  size = 'md',
}: {
  clientId: string;
  rule: string;
  size?: 'sm' | 'md';
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'dismissed' | 'error'>('idle');

  if (state === 'dismissed') return null;

  async function save() {
    setState('saving');
    try {
      await authedFetchJson(`/api/clients/${clientId}/caption-rules`, {
        method: 'POST',
        body: { rule, source: 'feedback' },
      });
      setState('saved');
    } catch {
      setState('error');
    }
  }

  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  if (state === 'saved') {
    return (
      <div className={`flex items-center gap-1.5 ${text} text-green-700 px-0.5`}>
        <Check className="w-3.5 h-3.5" />
        Saved to this client&apos;s caption rules — future captions will follow it.
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 ${text}`}>
      <BookOpen className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
      <span className="text-purple-900 flex-1 min-w-0">
        Always do this for this client? <span className="font-medium">&ldquo;{rule}&rdquo;</span>
        {state === 'error' && <span className="text-red-600"> — couldn&apos;t save, try again.</span>}
      </span>
      <button
        type="button"
        onClick={save}
        disabled={state === 'saving'}
        className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 font-medium text-white hover:bg-purple-700 disabled:opacity-60"
      >
        {state === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
        Save as rule
      </button>
      <button
        type="button"
        onClick={() => setState('dismissed')}
        className="text-purple-700 hover:text-purple-900"
      >
        No thanks
      </button>
    </div>
  );
}
