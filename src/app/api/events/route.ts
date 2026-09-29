import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { listContentEvents } from '@/lib/contentEvents';

export const dynamic = 'force-dynamic';

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

    const { events, error } = await listContentEvents(supabase, clientId, startDate, endDate, eventType);

    if (error) {
      logger.error('Error fetching content events:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ success: true, events });
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
