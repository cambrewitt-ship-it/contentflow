'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export interface CalendarEvent {
  id: string;
  client_id: string;
  date: string;
  title: string;
  notes?: string | null;
  type: 'event' | 'note';
  color: string;
  created_at: string;
  updated_at: string;
}

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { value: 'blue',   label: 'Blue',   bg: 'bg-blue-500' },
  { value: 'green',  label: 'Green',  bg: 'bg-green-500' },
  { value: 'red',    label: 'Red',    bg: 'bg-red-500' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-400' },
];

export const EVENT_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
};

interface Props {
  date: string; // YYYY-MM-DD
  event?: CalendarEvent | null;
  clientId: string;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}

export function CalendarEventModal({ date, event, clientId, onSave, onDelete, onClose }: Props) {
  const isEditing = !!event;
  const { getAccessToken } = useAuth();

  const [title, setTitle]   = useState(event?.title ?? '');
  const [notes, setNotes]   = useState(event?.notes ?? '');
  const [type, setType]     = useState<'event' | 'note'>(event?.type ?? 'event');
  const [color, setColor]   = useState(event?.color ?? 'purple');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      if (isEditing && event) {
        const res = await fetch('/api/calendar/events', {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: event.id, title: title.trim(), notes: notes || null, type, color }),
        });
        if (!res.ok) throw new Error('Failed to update');
        const data = await res.json();
        onSave(data.event);
      } else {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, date, title: title.trim(), notes: notes || null, type, color }),
        });
        if (!res.ok) throw new Error('Failed to create');
        const data = await res.json();
        onSave(data.event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Delete this event?')) return;
    setDeleting(true);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      onDelete(event.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEditing ? 'Edit' : 'Add'} to Calendar
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Type Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('event')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                type === 'event'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Event
            </button>
            <button
              type="button"
              onClick={() => setType('note')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                type === 'note'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Note
            </button>
          </div>

          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'event' ? 'Event title...' : 'Note...'}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
            />
          </div>

          {/* Notes */}
          <div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes (optional)..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Color (events only) */}
          {type === 'event' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Color</p>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={`w-7 h-7 rounded-full ${opt.bg} transition-transform ${
                      color === opt.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'
                    }`}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
