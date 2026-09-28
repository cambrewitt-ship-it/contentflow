'use client';

import { useState } from 'react';
import { CalendarDays, Check, FileText, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  drafts: AutopilotCandidate[];
  loading: boolean;
  /** Called after a draft leaves the list (moved to the calendar or removed). */
  onDraftRemoved: (candidateId: string) => void;
}

/**
 * The Drafts section on the Content Agent page: every post the user kept and
 * saved rather than sending to the calendar. Each draft shows its photo and its
 * full caption up front — nothing to expand.
 */
export default function AutopilotDrafts({ drafts, loading, onDraftRemoved }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <SectionHeading count={null} />
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <SectionHeading count={drafts.length} />
      {drafts.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No drafts yet. Run the agent, then choose “Save to Drafts” to park posts here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {drafts.map(draft => (
            <DraftCard key={draft.id} draft={draft} onRemoved={onDraftRemoved} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ count }: { count: number | null }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
      <FileText className="h-3.5 w-3.5" />
      Drafts{count != null && count > 0 ? ` (${count})` : ''}
    </h2>
  );
}

function DraftCard({
  draft,
  onRemoved,
}: {
  draft: AutopilotCandidate;
  onRemoved: (candidateId: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState<'calendar' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Caption editing — the draft keeps its own copy so an edit sticks without
  // refetching the whole list.
  const [caption, setCaption] = useState(draft.caption);
  const [editing, setEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(draft.caption);
  const [savingCaption, setSavingCaption] = useState(false);

  function startEditing() {
    setCaptionDraft(caption);
    setEditing(true);
    setError(null);
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim();
    if (!trimmed || trimmed === caption) {
      setEditing(false);
      return;
    }
    setSavingCaption(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/candidates/${draft.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: trimmed }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save caption');
      setCaption(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save caption');
    } finally {
      setSavingCaption(false);
    }
  }

  async function addToCalendar() {
    setBusy('calendar');
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/drafts/${draft.id}/to-calendar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to add to calendar');
      onRemoved(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  async function removeDraft() {
    setBusy('delete');
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/autopilot/drafts/${draft.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to remove draft');
      onRemoved(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <img src={draft.media_url} alt="" className="w-full aspect-square object-cover" />

      <div className="p-3 space-y-2 flex-1">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={captionDraft}
              onChange={e => setCaptionDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveCaption();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
              rows={6}
              maxLength={5000}
              className="w-full text-sm text-gray-700 border border-purple-300 rounded-lg p-2 resize-y focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveCaption} disabled={savingCaption}>
                {savingCaption ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={savingCaption}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
              <span className="text-xs text-gray-400 ml-auto">⌘↵ to save</span>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <p className="text-sm text-gray-700 whitespace-pre-wrap pr-6">{caption}</p>
            <button
              type="button"
              onClick={startEditing}
              className="absolute top-0 right-0 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              title="Edit caption"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {draft.hashtags?.length > 0 && (
          <p className="text-xs text-blue-500 break-words">{draft.hashtags.join(' ')}</p>
        )}
      </div>

      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          onClick={addToCalendar}
          disabled={busy !== null || editing}
          title={editing ? 'Save your caption first' : undefined}
        >
          {busy === 'calendar' ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          )}
          Add to Calendar
        </Button>
        <button
          type="button"
          onClick={removeDraft}
          disabled={busy !== null || editing}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Remove from drafts"
        >
          {busy === 'delete' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
