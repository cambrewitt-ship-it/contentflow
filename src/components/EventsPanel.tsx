'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ContentEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  useContentEvents,
} from '@/components/EventsCalendarLayer';

type Tab = 'upcoming' | 'all' | 'custom';

const REGIONS = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'IE', label: 'Ireland' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
];

interface EventsPanelProps {
  clientId: string;
  onClose: () => void;
}

export default function EventsPanel({ clientId, onClose }: EventsPanelProps) {
  const { getAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSeedSection, setShowSeedSection] = useState(false);
  const [seedRegion, setSeedRegion] = useState('GB');
  const [seedYear, setSeedYear] = useState(new Date().getFullYear());
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const { events, loading, error, refetch } = useContentEvents(clientId, start, end);

  // Add event form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    eventDate: '',
    eventType: 'custom' as ContentEvent['event_type'],
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const filteredEvents = events.filter(event => {
    const dateKey = event.occurrence_date || event.event_date;
    if (tab === 'upcoming') return dateKey >= today;
    if (tab === 'custom') return event.event_source === 'user';
    return true;
  });

  const handleAddEvent = useCallback(async () => {
    if (!newEvent.title || !newEvent.eventDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId,
          title: newEvent.title,
          eventDate: newEvent.eventDate,
          eventType: newEvent.eventType,
          description: newEvent.description || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create event');
      setNewEvent({ title: '', eventDate: '', eventType: 'custom', description: '' });
      setShowAddForm(false);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }, [clientId, getAccessToken, newEvent, refetch]);

  const handleDelete = useCallback(
    async (event: ContentEvent) => {
      setDeletingId(event.id);
      try {
        const token = getAccessToken();
        await fetch(`/api/events/${event.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        refetch();
      } finally {
        setDeletingId(null);
      }
    },
    [getAccessToken, refetch]
  );

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/events/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId, region: seedRegion, year: seedYear }),
      });
      const data = await res.json();
      if (data.success) {
        setSeedResult({ inserted: data.inserted, skipped: data.skipped });
        refetch();
      }
    } finally {
      setSeeding(false);
    }
  }, [clientId, getAccessToken, seedRegion, seedYear, refetch]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Events</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['upcoming', 'all', 'custom'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 flex gap-2 border-b border-gray-100">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => setShowAddForm(v => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Event
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2"
          onClick={() => setShowSeedSection(v => !v)}
          title="Seed public holidays"
        >
          <Globe className="h-3 w-3" />
        </Button>
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <div className="px-3 py-3 border-b border-gray-100 space-y-2 bg-gray-50">
          <Input
            placeholder="Event title"
            value={newEvent.title}
            onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
            className="h-7 text-xs"
          />
          <Input
            type="date"
            value={newEvent.eventDate}
            onChange={e => setNewEvent(prev => ({ ...prev, eventDate: e.target.value }))}
            className="h-7 text-xs"
          />
          <Select
            value={newEvent.eventType}
            onValueChange={v =>
              setNewEvent(prev => ({ ...prev, eventType: v as ContentEvent['event_type'] }))
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EVENT_TYPE_LABELS) as ContentEvent['event_type'][]).map(type => (
                <SelectItem key={type} value={type} className="text-xs">
                  {EVENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Description (optional)"
            value={newEvent.description}
            onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
            className="h-7 text-xs"
          />
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleAddEvent}
              disabled={saving || !newEvent.title || !newEvent.eventDate}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Seed Holidays Section */}
      {showSeedSection && (
        <div className="px-3 py-3 border-b border-gray-100 space-y-2 bg-blue-50">
          <p className="text-xs font-medium text-blue-800">Seed Public Holidays</p>
          <Select value={seedRegion} onValueChange={setSeedRegion}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => (
                <SelectItem key={r.code} value={r.code} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={seedYear.toString()}
            onValueChange={v => setSeedYear(parseInt(v))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={y.toString()} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {seedResult && (
            <p className="text-xs text-blue-700">
              Added {seedResult.inserted}, skipped {seedResult.skipped} existing
            </p>
          )}
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {seeding ? 'Seeding...' : 'Import Holidays'}
          </Button>
        </div>
      )}

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-xs text-red-600">{error}</div>
        )}
        {!loading && !error && filteredEvents.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400">
            {tab === 'upcoming' ? 'No upcoming events' : 'No events found'}
          </div>
        )}
        {!loading && filteredEvents.map(event => {
          const dateKey = event.occurrence_date || event.event_date;
          return (
            <div
              key={`${event.id}-${dateKey}`}
              className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 group"
            >
              <span
                className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${EVENT_TYPE_COLORS[event.event_type]}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(dateKey)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </span>
                  {event.priority === 'high' && (
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                      High
                    </span>
                  )}
                </div>
                {event.content_angle && (
                  <p className="text-[11px] text-gray-500 mt-1 italic truncate">
                    {event.content_angle}
                  </p>
                )}
                {event.relevance_tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Tag className="h-2.5 w-2.5 text-gray-300 flex-shrink-0" />
                    {event.relevance_tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(event)}
                disabled={deletingId === event.id}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                {deletingId === event.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
