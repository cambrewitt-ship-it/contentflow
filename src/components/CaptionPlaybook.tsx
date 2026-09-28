'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { authedFetchJson } from '@/lib/authedFetch';

interface Rule {
  id: string;
  rule: string;
  source: 'feedback' | 'manual';
}

/**
 * The client's caption playbook: rules the Content Agent follows on every run.
 * Rules come from feedback during swipe review, or are written here.
 */
export default function CaptionPlaybook({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await authedFetchJson<{ rules: Rule[] }>(`/api/clients/${clientId}/caption-rules`);
      setRules(data.rules ?? []);
    } catch {
      setRules([]);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRule() {
    const rule = draft.trim();
    if (!rule) return;
    setSaving(true);
    setError(null);
    try {
      await authedFetchJson(`/api/clients/${clientId}/caption-rules`, { method: 'POST', body: { rule } });
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    setRules(prev => prev?.filter(r => r.id !== id) ?? null);
    try {
      await authedFetchJson(`/api/clients/${clientId}/caption-rules?id=${id}`, { method: 'DELETE' });
    } catch {
      load();
    }
  }

  const count = rules?.length ?? 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-800">Caption playbook</span>
          <span className="text-xs text-gray-400">
            {rules === null ? '' : count === 0 ? 'No rules yet' : `${count} rule${count === 1 ? '' : 's'}`}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500">
            Rules the agent follows on every run for this client. They’re added when you give feedback on a post
            during review, or you can write your own.
          </p>

          {rules === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            count > 0 && (
              <ul className="space-y-1.5">
                {rules.map(r => (
                  <li key={r.id} className="group flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    <span className="flex-1">{r.rule}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{r.source === 'feedback' ? 'from feedback' : 'manual'}</span>
                    <button
                      type="button"
                      onClick={() => removeRule(r.id)}
                      aria-label="Remove rule"
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addRule();
              }}
              maxLength={500}
              placeholder="e.g. Never use the word “delicious”"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
            />
            <button
              type="button"
              onClick={addRule}
              disabled={saving || !draft.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
