'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, FileText, Loader2, PenSquare, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PostSocialPreview } from '@/components/PostSocialPreview';
import { authedFetchJson } from '@/lib/authedFetch';
import { publishedCaption } from '@/lib/candidateCaption';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  clientId: string;
  drafts: AutopilotCandidate[];
  loading: boolean;
  /** Called after a draft leaves the list (moved to the calendar or removed). */
  onDraftRemoved: (candidateId: string) => void;
  /** Called after a draft's caption is edited. */
  onDraftUpdated: (draft: AutopilotCandidate) => void;
  /** Open a draft in the Content Suite editor. */
  onEditDraft: (draft: AutopilotCandidate) => void;
}

// Thumbnails shown before the grid collapses into a "+N" tile
const MAX_THUMBNAILS = 11;

/**
 * The Drafts section on the Content Agent: every post the user kept and saved
 * rather than sending to the calendar. Shown as a compact grid of thumbnails;
 * clicking opens a modal with each draft as a full social preview to scroll
 * through, edit, open in the Content Suite or add to the calendar.
 */
export default function AutopilotDrafts({
  clientId,
  drafts,
  loading,
  onDraftRemoved,
  onDraftUpdated,
  onEditDraft,
}: Props) {
  // Id of the draft to scroll to when the modal opens; null = closed
  const [openAt, setOpenAt] = useState<string | null>(null);

  // Close once the last draft leaves the list
  useEffect(() => {
    if (openAt && drafts.length === 0) setOpenAt(null);
  }, [openAt, drafts.length]);

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

  const shown = drafts.length > MAX_THUMBNAILS + 1 ? drafts.slice(0, MAX_THUMBNAILS) : drafts;
  const hidden = drafts.length - shown.length;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading count={drafts.length} />
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenAt(drafts[0].id)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            View all
          </button>
        )}
      </div>
      {drafts.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No drafts yet. Run the agent, then choose “Save to Drafts” to park posts here.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5">
          {shown.map(draft => (
            <button
              key={draft.id}
              type="button"
              onClick={() => setOpenAt(draft.id)}
              title={draft.caption}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-shadow"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setOpenAt(drafts[MAX_THUMBNAILS].id)}
              className="aspect-square rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-600 flex items-center justify-center transition-colors"
            >
              +{hidden}
            </button>
          )}
        </div>
      )}

      {openAt && (
        <DraftsModal
          clientId={clientId}
          drafts={drafts}
          initialId={openAt}
          onClose={() => setOpenAt(null)}
          onDraftRemoved={onDraftRemoved}
          onDraftUpdated={onDraftUpdated}
          onEditDraft={draft => {
            setOpenAt(null);
            onEditDraft(draft);
          }}
        />
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

// ── Modal: every draft as a full social preview ──────────────────────────────

function DraftsModal({
  clientId,
  drafts,
  initialId,
  onClose,
  onDraftRemoved,
  onDraftUpdated,
  onEditDraft,
}: {
  clientId: string;
  drafts: AutopilotCandidate[];
  initialId: string;
  onClose: () => void;
  onDraftRemoved: (candidateId: string) => void;
  onDraftUpdated: (draft: AutopilotCandidate) => void;
  onEditDraft: (draft: AutopilotCandidate) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });
  // Platform picked in one preview stays open across the others
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState(initialId);

  // Client name + logo for the previews
  useEffect(() => {
    authedFetchJson<{ client?: { name?: string; logo_url?: string | null } }>(`/api/clients/${clientId}`)
      .then(data => {
        if (data.client) setBrand({ name: data.client.name ?? '', logoUrl: data.client.logo_url ?? null });
      })
      .catch(() => {});
  }, [clientId]);

  const scrollTo = (id: string, behavior: ScrollBehavior = 'smooth') => {
    setActiveId(id);
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-draft-id="${id}"]`)
      ?.scrollIntoView({ behavior, block: 'start' });
  };

  // Open on the draft that was clicked
  useEffect(() => {
    scrollTo(initialId, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes; lock the page behind the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Highlight the thumbnail of the draft in view
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = (visible[0]?.target as HTMLElement | undefined)?.dataset.draftId;
        if (id) setActiveId(id);
      },
      { root, threshold: [0.4, 0.7] }
    );
    root.querySelectorAll('[data-draft-id]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [drafts]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Drafts"
        className="relative bg-[#fbfaf8] rounded-3xl shadow-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header + thumbnail strip for jumping between drafts */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              Drafts
              <span className="text-sm font-normal text-gray-400">{drafts.length}</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {drafts.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => scrollTo(d.id)}
                className={`h-12 w-12 shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  d.id === activeId ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Every draft, full size */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 divide-y divide-gray-200">
          {drafts.map(draft => (
            <DraftPreview
              key={draft.id}
              draft={draft}
              brand={brand}
              platform={platform}
              onPlatformChange={setPlatform}
              onRemoved={onDraftRemoved}
              onUpdated={onDraftUpdated}
              onEdit={onEditDraft}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DraftPreview({
  draft,
  brand,
  platform,
  onPlatformChange,
  onRemoved,
  onUpdated,
  onEdit,
}: {
  draft: AutopilotCandidate;
  brand: { name: string; logoUrl: string | null };
  platform: string | undefined;
  onPlatformChange: (platform: string) => void;
  onRemoved: (candidateId: string) => void;
  onUpdated: (draft: AutopilotCandidate) => void;
  onEdit: (draft: AutopilotCandidate) => void;
}) {
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState<'calendar' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick caption edit — the preview follows the text as it's typed
  const [editing, setEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(draft.caption);
  const [savingCaption, setSavingCaption] = useState(false);

  function startEditing() {
    setCaptionDraft(draft.caption);
    setEditing(true);
    setError(null);
  }

  async function saveCaption() {
    const trimmed = captionDraft.trim();
    if (!trimmed || trimmed === draft.caption) {
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
      onUpdated({ ...draft, caption: trimmed });
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

  const previewCaption = publishedCaption(editing ? { ...draft, caption: captionDraft } : draft);
  const disabled = busy !== null || editing;

  return (
    <div data-draft-id={draft.id} className="py-8 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start md:justify-center gap-5">
      <div className="w-full max-w-[420px] mx-auto md:mx-0 shrink-0">
        <PostSocialPreview
          imageUrl={draft.media_url}
          caption={previewCaption}
          businessName={brand.name}
          logoUrl={brand.logoUrl}
          targetPlatforms={draft.platforms}
          platform={platform}
          onPlatformChange={onPlatformChange}
        />
      </div>

      <div className="w-full max-w-[420px] mx-auto md:mx-0 md:w-64 md:flex-none space-y-3">
        <Button
          onClick={() => onEdit(draft)}
          disabled={disabled}
          className="w-full justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-950 text-white hover:brightness-110"
        >
          <PenSquare className="h-4 w-4 mr-1.5" />
          Edit in Content Suite
        </Button>
        <Button
          variant="outline"
          onClick={addToCalendar}
          disabled={disabled}
          className="w-full justify-center rounded-full"
          title={editing ? 'Save your caption first' : 'Adds it to the calendar’s unscheduled posts'}
        >
          {busy === 'calendar' ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <CalendarDays className="h-4 w-4 mr-1.5" />
          )}
          Add to Calendar
        </Button>

        {editing ? (
          <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
            <textarea
              value={captionDraft}
              onChange={e => setCaptionDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveCaption();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setEditing(false);
                }
              }}
              autoFocus
              rows={8}
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
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={savingCaption}>
                Cancel
              </Button>
              <span className="text-xs text-gray-400 ml-auto">⌘↵ to save</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={startEditing}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit caption
            </button>
            <button
              type="button"
              onClick={removeDraft}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-400 hover:text-red-500 disabled:opacity-50"
              title="Remove from drafts"
            >
              {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
