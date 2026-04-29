import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

interface ContentEvent {
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

function expandRecurring(event: ContentEvent, startDate: Date, endDate: Date): ContentEvent[] {
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

const createSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be YYYY-MM-DD'),
  eventEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventTime: z.string().optional(),
  eventType: z.enum(['public_holiday', 'cultural', 'sports', 'industry', 'custom']),
  category: z.string().optional(),
  relevanceTags: z.array(z.string()).default([]),
  contentAngle: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  recurrenceDay: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const eventType = searchParams.get('eventType');

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'clientId is required' }, { status: 400 });
    }

    // Verify client ownership
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const startDate = startDateParam ? new Date(startDateParam + 'T00:00:00Z') : new Date();
    const endDate = endDateParam
      ? new Date(endDateParam + 'T23:59:59Z')
      : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

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

    if (error) {
      logger.error('Error fetching content events:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
    }

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

    return NextResponse.json({ success: true, events: expanded });
  } catch (error) {
    logger.error('GET /api/events error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const d = parsed.data;

    // Verify client ownership
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', d.clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const { data: event, error } = await supabase
      .from('content_events')
      .insert({
        client_id: d.clientId,
        title: d.title,
        description: d.description ?? null,
        event_date: d.eventDate,
        event_end_date: d.eventEndDate ?? null,
        event_time: d.eventTime ?? null,
        event_type: d.eventType,
        event_source: 'user',
        category: d.category ?? null,
        relevance_tags: d.relevanceTags,
        content_angle: d.contentAngle ?? null,
        priority: d.priority,
        is_recurring: d.isRecurring,
        recurrence_rule: d.recurrenceRule ?? null,
        recurrence_day: d.recurrenceDay ?? null,
        added_by: 'user',
      })
      .select('*')
      .single();

    if (error || !event) {
      logger.error('Error creating content event:', error);
      return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/events error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
