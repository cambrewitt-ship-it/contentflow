import type { SupabaseClient } from '@supabase/supabase-js';

// Content events (holidays, industry dates, custom events) — shared by /api/events (agency)
// and /api/portal/content-events (client portal).

export interface ContentEvent {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_end_date: string | null;
  event_time: string | null;
  event_type: string;
  event_source: string;
  category: string | null;
  relevance_tags: string[];
  content_angle: string | null;
  priority: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_day: string | null;
  is_active: boolean;
  added_by: string;
  created_at: string;
  updated_at: string;
  occurrence_date?: string;
}

export function expandRecurring(event: ContentEvent, startDate: Date, endDate: Date): ContentEvent[] {
  const results: ContentEvent[] = [];
  const rule = event.recurrence_rule;
  if (!rule) return [event];

  const originDate = new Date(event.event_date + 'T00:00:00Z');
  const cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    let matches = false;

    if (rule === 'weekly') {
      matches = cursor.getUTCDay() === originDate.getUTCDay();
    } else if (rule === 'monthly') {
      matches = cursor.getUTCDate() === originDate.getUTCDate();
    } else if (rule === 'yearly') {
      matches =
        cursor.getUTCMonth() === originDate.getUTCMonth() &&
        cursor.getUTCDate() === originDate.getUTCDate();
    }

    if (matches) {
      const iso = cursor.toISOString().split('T')[0];
      results.push({ ...event, occurrence_date: iso });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

/** Active events for a client in [startDate, endDate], with recurring ones expanded, sorted by date. */
export async function listContentEvents(
  supabase: SupabaseClient,
  clientId: string,
  startDate: Date,
  endDate: Date,
  eventType?: string | null
): Promise<{ events: ContentEvent[] | null; error: unknown }> {
  let query = supabase
    .from('content_events')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true);

  if (eventType) query = query.eq('event_type', eventType);

  // Fetch non-recurring in range + all recurring
  const { data: events, error } = await query.or(
    `and(is_recurring.eq.false,event_date.gte.${startDate.toISOString().split('T')[0]},event_date.lte.${endDate.toISOString().split('T')[0]}),is_recurring.eq.true`
  );
  if (error) return { events: null, error };

  const expanded: ContentEvent[] = [];
  for (const event of events || []) {
    if (event.is_recurring) {
      expanded.push(...expandRecurring(event as ContentEvent, startDate, endDate));
    } else {
      expanded.push(event as ContentEvent);
    }
  }

  expanded.sort((a, b) => {
    const dateA = a.occurrence_date || a.event_date;
    const dateB = b.occurrence_date || b.event_date;
    return dateA.localeCompare(dateB);
  });

  return { events: expanded, error: null };
}
