'use client';

import { useState } from 'react';
import { HelpCircle, Lightbulb, Loader2, MessageSquare, Wand2, X } from 'lucide-react';
import { authedFetchJson } from '@/lib/authedFetch';
import { FEEDBACK_TAGS, FEEDBACK_TAG_IDS } from '@/lib/captionFeedback';
import type { FeedbackTag } from '@/lib/captionFeedback';
import type { AutopilotCandidate } from '@/types/autopilot';

interface PostFeedbackPanelProps {
  candidate: AutopilotCandidate;
  clientName: string;
  onUpdated: (candidate: AutopilotCandidate) => void;
  /** Rules this feedback added to the client's caption playbook. */
  onRulesSaved: (rules: string[]) => void;
  /** Called once skip feedback is saved; the parent then skips the post. */
  onSkip: () => void;
}

type Busy = 'rewrite' | 'explain' | 'skip' | null;

export default function PostFeedbackPanel({
  candidate,
  clientName,
  onUpdated,
  onRulesSaved,
  onSkip,
}: PostFeedbackPanelProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [note, setNote] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  const hasFeedback = tags.length > 0 || note.trim().length > 0;

  async function send(action: 'rewrite' | 'explain' | 'skip') {
    setBusy(action);
    setError(null);
    try {
      const data = await authedFetchJson<{
        candidate?: AutopilotCandidate;
        explanation?: string | null;
        savedRules?: string[];
      }>(`/api/autopilot/candidates/${candidate.id}/feedback`, {
        method: 'POST',
        body: { action, tags, note, remember },
      });

      if (data.candidate) onUpdated(data.candidate);
      if (data.explanation) setExplanation(data.explanation);
      if (data.savedRules?.length) onRulesSaved(data.savedRules);

      if (action === 'skip') {
        onSkip();
        return;
      }
      if (action === 'rewrite') {
        setTags([]);
        setNote('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          Not quite right? Tell the agent
        </button>
        <button
          type="button"
          onClick={() => send('explain')}
          disabled={busy !== null}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-50"
        >
          {busy === 'explain' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
          Why this?
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_TAG_IDS.map(tag => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTags(prev => (active ? prev.filter(t => t !== tag) : [...prev, tag]))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {FEEDBACK_TAGS[tag].label}
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="What should change? e.g. stop ending every post with a question, mention the courtyard seating…"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
          />

          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>Remember this for future {clientName || 'client'} posts (adds a rule to their caption playbook)</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => send('rewrite')}
              disabled={!hasFeedback || busy !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
              {busy === 'rewrite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Rewrite this post
            </button>
            <button
              type="button"
              onClick={() => send('skip')}
              disabled={!hasFeedback || busy !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              {busy === 'skip' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Skip with feedback
            </button>
          </div>
        </div>
      )}

      {explanation && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-900 flex gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            <span className="font-medium">Why it wrote it this way: </span>
            {explanation}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
