'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface ContentEvent {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_end_date: string | null;
  event_time: string | null;
  event_type: 'public_holiday' | 'cultural' | 'sports' | 'industry' | 'custom';
  event_source: 'system' | 'suggested' | 'user';
  category: string | null;
  relevance_tags: string[];
  content_angle: string | null;
  priority: 'high' | 'normal' | 'low';
  is_recurring: boolean;
  recurrence_rule: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day: string | null;
  is_active: boolean;
  added_by: string;
  created_at: string;
  updated_at: string;
  occurrence_date?: string;
}

export const EVENT_TYPE_COLORS: Record<ContentEvent['event_type'], string> = {
  public_holiday: 'bg-red-500',
  cultural: 'bg-purple-500',
  sports: 'bg-green-500',
  industry: 'bg-blue-500',
  custom: 'bg-orange-500',
};

export const EVENT_TYPE_LABELS: Record<ContentEvent['event_type'], string> = {
  public_holiday: 'Holiday',
  cultural: 'Cultural',
  sports: 'Sports',
  industry: 'Industry',
  custom: 'Custom',
};

interface UseContentEventsResult {
  events: ContentEvent[];
  eventsByDate: Record<string, ContentEvent[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useContentEvents(
  clientId: string,
  startDate?: Date,
  endDate?: Date
): UseContentEventsResult {
  const { getAccessToken } = useAuth();
  const [events, setEvents] = useState<ContentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!clientId) return;

    const start = startDate ?? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const end = endDate ?? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      clientId,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });

    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    fetch(`/api/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setEvents(data.events ?? []);
        } else {
          setError(data.error || 'Failed to load events');
        }
      })
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, tick]);

  const eventsByDate: Record<string, ContentEvent[]> = {};
  for (const event of events) {
    const key = event.occurrence_date || event.event_date;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  }

  return { events, eventsByDate, loading, error, refetch };
}

interface EventIndicatorsProps {
  events: ContentEvent[];
  maxDots?: number;
}

export function EventIndicators({ events, maxDots = 4 }: EventIndicatorsProps) {
  if (!events || events.length === 0) return null;

  const visible = events.slice(0, maxDots);
  const overflow = events.length - maxDots;

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {visible.map(event => (
        <span
          key={`${event.id}-${event.occurrence_date || event.event_date}`}
          className={`inline-block w-1.5 h-1.5 rounded-full ${EVENT_TYPE_COLORS[event.event_type]} flex-shrink-0`}
          title={event.title}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-gray-400 leading-none">+{overflow}</span>
      )}
    </div>
  );
}
