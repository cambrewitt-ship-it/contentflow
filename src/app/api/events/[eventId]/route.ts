import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventTime: z.string().optional(),
  eventType: z.enum(['public_holiday', 'cultural', 'sports', 'industry', 'custom']).optional(),
  category: z.string().optional(),
  relevanceTags: z.array(z.string()).optional(),
  contentAngle: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  recurrenceDay: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function getOwnedEvent(supabase: SupabaseClient, eventId: string, userId: string) {
  const { data: event, error } = await supabase
    .from('content_events')
    .select('*, clients(id, user_id)')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) return { event: null, notFound: true };

  const clientUserId = Array.isArray(event.clients)
    ? event.clients[0]?.user_id
    : (event.clients as { user_id?: string } | null)?.user_id;

  if (clientUserId !== userId) return { event: null, notFound: false };

  return { event, notFound: false };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { event, notFound } = await getOwnedEvent(supabase, eventId, user.id);

    if (notFound) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    if (!event) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const d = parsed.data;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.title !== undefined) updates.title = d.title;
    if (d.description !== undefined) updates.description = d.description;
    if (d.eventDate !== undefined) updates.event_date = d.eventDate;
    if (d.eventEndDate !== undefined) updates.event_end_date = d.eventEndDate;
    if (d.eventTime !== undefined) updates.event_time = d.eventTime;
    if (d.eventType !== undefined) updates.event_type = d.eventType;
    if (d.category !== undefined) updates.category = d.category;
    if (d.relevanceTags !== undefined) updates.relevance_tags = d.relevanceTags;
    if (d.contentAngle !== undefined) updates.content_angle = d.contentAngle;
    if (d.priority !== undefined) updates.priority = d.priority;
    if (d.isRecurring !== undefined) updates.is_recurring = d.isRecurring;
    if (d.recurrenceRule !== undefined) updates.recurrence_rule = d.recurrenceRule;
    if (d.recurrenceDay !== undefined) updates.recurrence_day = d.recurrenceDay;
    if (d.isActive !== undefined) updates.is_active = d.isActive;

    const { data: updated, error: updateError } = await supabase
      .from('content_events')
      .update(updates)
      .eq('id', eventId)
      .select('*')
      .single();

    if (updateError || !updated) {
      logger.error('Error updating content event:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    logger.error('PATCH /api/events/[eventId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const { event, notFound } = await getOwnedEvent(supabase, eventId, user.id);

    if (notFound) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    if (!event) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Hard delete for user events, soft delete for system/suggested
    if (event.event_source === 'user') {
      const { error: deleteError } = await supabase
        .from('content_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        logger.error('Error deleting content event:', deleteError);
        return NextResponse.json({ success: false, error: 'Failed to delete event' }, { status: 500 });
      }
    } else {
      const { error: updateError } = await supabase
        .from('content_events')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', eventId);

      if (updateError) {
        logger.error('Error deactivating content event:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to remove event' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/events/[eventId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
