import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { listContentEvents } from '@/lib/contentEvents';

export const dynamic = 'force-dynamic';

/**
 * Content events (the board's Events panel) for the client portal. Same data as /api/events,
 * authed by the portal token instead of the agency session. Portal users can list events,
 * add custom ones, and delete the custom ones — holidays and other system events are read-only.
 */

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const createSchema = z.object({
  token: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(255),
  eventDate: dateString,
  eventType: z.enum(['public_holiday', 'cultural', 'sports', 'industry', 'custom']).default('custom'),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolvePortalToken(searchParams.get('token') ?? '');
    if (!resolved) {
      return NextResponse.json({ success: false, error: 'Invalid portal token' }, { status: 401 });
    }

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const startDate = startDateParam ? new Date(startDateParam + 'T00:00:00Z') : new Date();
    const endDate = endDateParam
      ? new Date(endDateParam + 'T23:59:59Z')
      : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    const { events, error } = await listContentEvents(createSupabaseAdmin(), resolved.clientId, startDate, endDate);
    if (error) {
      logger.error('Error fetching portal content events:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ success: true, events });
  } catch (error) {
    logger.error('GET /api/portal/content-events error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const resolved = await resolvePortalToken(d.token);
    if (!resolved) {
      return NextResponse.json({ success: false, error: 'Invalid portal token' }, { status: 401 });
    }

    const { data: event, error } = await createSupabaseAdmin()
      .from('content_events')
      .insert({
        client_id: resolved.clientId,
        title: d.title,
        description: d.description || null,
        event_date: d.eventDate,
        event_type: d.eventType,
        event_source: 'user',
        relevance_tags: [],
        priority: 'normal',
        is_recurring: false,
        added_by: 'user',
      })
      .select('*')
      .single();

    if (error || !event) {
      logger.error('Error creating portal content event:', error);
      return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/portal/content-events error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { token, id } = await request.json();
    if (!token || !id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ success: false, error: 'Invalid portal token' }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { data: event } = await admin
      .from('content_events')
      .select('id, event_source')
      .eq('id', id)
      .eq('client_id', resolved.clientId)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    if (event.event_source !== 'user') {
      return NextResponse.json({ success: false, error: 'Only custom events can be deleted' }, { status: 403 });
    }

    const { error } = await admin.from('content_events').delete().eq('id', id);
    if (error) {
      logger.error('Error deleting portal content event:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/portal/content-events error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
