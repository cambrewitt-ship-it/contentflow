import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePortalToken } from '@/lib/portalAuth';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: NextRequest) {
  try {
    const { token, date, title, notes, type, color } = await request.json();

    if (!token || !date || !title?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        client_id: resolved.clientId,
        date,
        title: title.trim(),
        notes: notes || null,
        type: type || 'note',
        color: color || 'purple',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating portal event:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    logger.error('Portal events POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { token, id, title, notes, type, color } = await request.json();

    if (!token || !id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    // Verify the event belongs to this client
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('id', id)
      .eq('client_id', resolved.clientId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (notes !== undefined) updates.notes = notes || null;
    if (type !== undefined) updates.type = type;
    if (color !== undefined) updates.color = color;

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating portal event:', error);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    logger.error('Portal events PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { token, id } = await request.json();

    if (!token || !id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    // Verify the event belongs to this client
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('id', id)
      .eq('client_id', resolved.clientId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting portal event:', error);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Portal events DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
