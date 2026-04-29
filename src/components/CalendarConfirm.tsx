'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, CalendarDays, Check, Loader2, Pencil, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { AutopilotCandidate } from '@/types/autopilot';

interface Props {
  planId: string;
  clientId: string;
  keptCandidates: AutopilotCandidate[];
  planWeekStart: string;
  onConfirm: () => void;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const parts = time.split(':');
  const h = parseInt(parts[0] ?? '12', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

const POST_TYPE_STYLES: Record<string, string> = {
  promotional: 'bg-orange-100 text-orange-700',
  engagement: 'bg-purple-100 text-purple-700',
  seasonal: 'bg-teal-100 text-teal-700',
  educational: 'bg-blue-100 text-blue-700',
};

// ── Draggable post card ───────────────────────────────────────────────────────

interface PostCardProps {
  candidate: AutopilotCandidate;
  isEditing: boolean;
  editCaption: string;
  savedId: string | null;
  onEditStart: (c: AutopilotCandidate) => void;
  onEditChange: (v: string) => void;
  onEditSave: (id: string) => void;
}

function DraggableCard({
  candidate,
  isEditing,
  editCaption,
  savedId,
  onEditStart,
  onEditChange,
  onEditSave,
}: PostCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Thumbnail + drag handle */}
        <div
          className="relative h-20 bg-gray-100 flex-shrink-0 cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <img
            src={candidate.media_url}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between">
            <span className="text-white text-xs font-medium">{formatTime(candidate.suggested_time)}</span>
            {candidate.post_type && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                  POST_TYPE_STYLES[candidate.post_type] ?? 'bg-gray-100 text-gray-700'
                }`}
                style={{ fontSize: '10px' }}
              >
                {candidate.post_type}
              </span>
            )}
          </div>
        </div>

        {/* Caption area */}
        <div className="p-2">
          {isEditing ? (
            <div className="space-y-1">
              <textarea
                ref={textareaRef}
                value={editCaption}
                onChange={e => onEditChange(e.target.value)}
                onBlur={() => onEditSave(candidate.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onEditSave(candidate.id);
                  if (e.key === 'Escape') onEditSave(candidate.id);
                }}
                autoFocus
                rows={4}
                className="w-full text-xs border border-blue-300 rounded p-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400">⌘+Enter to save</p>
            </div>
          ) : (
            <div className="group relative">
              <p className="text-xs text-gray-700 line-clamp-3">{candidate.caption}</p>
              <button
                onClick={() => onEditStart(candidate)}
                className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded"
                title="Edit caption"
              >
                <Pencil className="h-3 w-3 text-gray-400" />
              </button>
              {savedId === candidate.id && (
                <span className="text-xs text-green-600 flex items-center gap-0.5 mt-0.5">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Droppable day column ──────────────────────────────────────────────────────

function DayColumn({
  date,
  label,
  isToday,
  candidates,
  editingId,
  editCaption,
  savedId,
  onEditStart,
  onEditChange,
  onEditSave,
}: {
  date: string;
  label: string;
  isToday: boolean;
  candidates: AutopilotCandidate[];
  editingId: string | null;
  editCaption: string;
  savedId: string | null;
  onEditStart: (c: AutopilotCandidate) => void;
  onEditChange: (v: string) => void;
  onEditSave: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-w-[148px] flex-1 rounded-xl p-2 border transition-colors ${
        isOver
          ? 'bg-blue-50 border-blue-300'
          : candidates.length > 0
          ? 'bg-gray-50 border-gray-200'
          : 'bg-gray-50/50 border-dashed border-gray-200'
      }`}
    >
      <div className={`text-center pb-1 border-b border-gray-200 ${isToday ? 'border-blue-300' : ''}`}>
        <p className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>{label}</p>
      </div>

      {candidates.map(c => (
        <DraggableCard
          key={c.id}
          candidate={c}
          isEditing={editingId === c.id}
          editCaption={editCaption}
          savedId={savedId}
          onEditStart={onEditStart}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
        />
      ))}

      {candidates.length === 0 && (
        <div className="flex-1 min-h-[60px] flex items-center justify-center">
          <p className="text-xs text-gray-300">Drop here</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarConfirm({
  planId,
  clientId,
  keptCandidates,
  planWeekStart,
  onConfirm,
  onBack,
}: Props) {
  const { getAccessToken } = useAuth();

  const [localCandidates, setLocalCandidates] = useState<AutopilotCandidate[]>(keptCandidates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const [scheduling, setScheduling] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);

  // Build week days (Mon-Sun) from planWeekStart
  const weekDays = useMemo(() => {
    const days: Array<{ date: string; label: string; isToday: boolean }> = [];
    const today = isoDate(new Date());
    for (let i = 0; i < 7; i++) {
      const d = new Date(planWeekStart + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const dateStr = isoDate(d);
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }),
        isToday: dateStr === today,
      });
    }
    return days;
  }, [planWeekStart]);

  // Map candidates to day columns
  const byDay = useMemo(() => {
    const map: Record<string, AutopilotCandidate[]> = {};
    for (const c of localCandidates) {
      if (!map[c.suggested_date]) map[c.suggested_date] = [];
      map[c.suggested_date]!.push(c);
    }
    return map;
  }, [localCandidates]);

  // Unplaced candidates (date outside the week)
  const weekDates = new Set(weekDays.map(d => d.date));
  const unplaced = localCandidates.filter(c => !weekDates.has(c.suggested_date));

  // ── Edit handlers ────────────────────────────────────────────────────────────

  const handleEditStart = useCallback((c: AutopilotCandidate) => {
    setEditingId(c.id);
    setEditCaption(c.caption);
  }, []);

  const handleEditSave = useCallback(
    async (candidateId: string) => {
      const trimmed = editCaption.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      setLocalCandidates(prev =>
        prev.map(c => (c.id === candidateId ? { ...c, caption: trimmed } : c))
      );
      setEditingId(null);
      setSavedId(candidateId);
      setTimeout(() => setSavedId(null), 2000);

      const token = getAccessToken();
      if (token) {
        fetch(`/api/autopilot/candidates/${candidateId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: trimmed }),
        }).catch(() => {});
      }
    },
    [editCaption, getAccessToken]
  );

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const candidateId = active.id as string;
      const newDate = over.id as string;

      setLocalCandidates(prev =>
        prev.map(c => (c.id === candidateId ? { ...c, suggested_date: newDate } : c))
      );

      const token = getAccessToken();
      if (token) {
        fetch(`/api/autopilot/candidates/${candidateId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggested_date: newDate }),
        }).catch(() => {});
      }
    },
    [getAccessToken]
  );

  // ── Add to calendar (no publish) ────────────────────────────────────────────

  const handleAddToCalendar = async () => {
    setAddingToCalendar(true);
    setScheduleError(null);
    const token = getAccessToken();
    try {
      const confirmRes = await fetch(`/api/autopilot/plans/${planId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) throw new Error(confirmData.error || 'Failed to save posts');
      if (!confirmData.posts || confirmData.posts.length === 0) {
        throw new Error('No posts were saved. Check that you kept at least one post during review.');
      }
      onConfirm();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAddingToCalendar(false);
    }
  };

  // ── Schedule + Publish ───────────────────────────────────────────────────────

  const handleSchedule = async () => {
    setScheduling(true);
    setScheduleError(null);
    setPublishWarning(null);
    const token = getAccessToken();

    try {
      setProgressMsg('Creating calendar posts…');
      const confirmRes = await fetch(`/api/autopilot/plans/${planId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) throw new Error(confirmData.error || 'Failed to confirm plan');

      setProgressMsg('Publishing to social media…');
      const publishRes = await fetch(`/api/autopilot/plans/${planId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const publishData = await publishRes.json();

      if (publishData.success) {
        onConfirm();
      } else {
        // Posts saved but couldn't publish (e.g. no social accounts connected)
        setPublishWarning(
          publishData.error ||
            'Posts saved to calendar, but could not publish to social media. Connect accounts in settings.'
        );
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setScheduling(false);
      setProgressMsg('');
    }
  };

  const activeDragCandidate = activeDragId
    ? localCandidates.find(c => c.id === activeDragId)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
            Your plan for the week
            <span className="text-yellow-400">✨</span>
          </h2>
          <p className="text-sm text-gray-500">
            {localCandidates.length} post{localCandidates.length !== 1 ? 's' : ''} selected · drag to
            reschedule, click caption to edit
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to review
        </button>
      </div>

      {/* Week calendar */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max sm:min-w-0 sm:grid sm:grid-cols-7">
            {weekDays.map(day => (
              <DayColumn
                key={day.date}
                date={day.date}
                label={day.label}
                isToday={day.isToday}
                candidates={byDay[day.date] ?? []}
                editingId={editingId}
                editCaption={editCaption}
                savedId={savedId}
                onEditStart={handleEditStart}
                onEditChange={setEditCaption}
                onEditSave={handleEditSave}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragCandidate ? (
            <div className="w-36 opacity-90 rotate-3 shadow-2xl rounded-xl overflow-hidden">
              <img
                src={activeDragCandidate.media_url}
                alt=""
                className="w-full h-20 object-cover"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Unplaced posts (outside the week range) */}
      {unplaced.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700 mb-2">
            {unplaced.length} post{unplaced.length !== 1 ? 's' : ''} outside this week — drag them onto a
            day above
          </p>
          <div className="flex gap-2 flex-wrap">
            {unplaced.map(c => (
              <div key={c.id} className="w-16 h-16 rounded-lg overflow-hidden border border-amber-200">
                <img src={c.media_url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors / warnings */}
      {scheduleError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {scheduleError}
        </div>
      )}
      {publishWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-1">
          <p className="font-medium">Posts saved to calendar</p>
          <p>{publishWarning}</p>
          <button
            onClick={onConfirm}
            className="text-xs underline text-amber-700 hover:text-amber-900"
          >
            Continue anyway →
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 hidden sm:block">
          Drag posts between days to reschedule
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleAddToCalendar}
            disabled={addingToCalendar || scheduling || localCandidates.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {addingToCalendar ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4" />
                Add To Calendar
              </>
            )}
          </button>
          <button
            onClick={handleSchedule}
            disabled={scheduling || addingToCalendar || localCandidates.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {scheduling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressMsg || 'Scheduling…'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Schedule & Publish
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
