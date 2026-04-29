import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

const seedSchema = z.object({
  clientId: z.string().uuid(),
  region: z.string().min(2).max(3).default('GB'),
  year: z.number().int().min(2020).max(2030).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const body = await request.json();
    const parsed = seedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { clientId, region, year: yearParam } = parsed.data;
    const year = yearParam ?? new Date().getFullYear();

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

    // Fetch holidays from Nager
    const nagerUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${region}`;
    const res = await fetch(nagerUrl, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch holidays for region "${region}"` },
        { status: 502 }
      );
    }

    const raw: Array<{
      date: string;
      name: string;
      localName: string;
      global: boolean;
    }> = await res.json();

    const globalHolidays = raw.filter(h => h.global);

    if (globalHolidays.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, skipped: 0 });
    }

    // Fetch existing holidays for this client/year to dedup
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data: existing } = await supabase
      .from('content_events')
      .select('event_date, title')
      .eq('client_id', clientId)
      .eq('event_type', 'public_holiday')
      .gte('event_date', yearStart)
      .lte('event_date', yearEnd);

    const existingKeys = new Set(
      (existing || []).map(e => `${e.event_date}::${e.title}`)
    );

    const toInsert = globalHolidays
      .filter(h => !existingKeys.has(`${h.date}::${h.name}`))
      .map(h => ({
        client_id: clientId,
        title: h.name,
        description: h.localName !== h.name ? h.localName : null,
        event_date: h.date,
        event_type: 'public_holiday',
        event_source: 'system',
        priority: 'normal',
        is_recurring: false,
        added_by: 'system',
        relevance_tags: ['public-holiday', region.toLowerCase()],
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        skipped: globalHolidays.length,
      });
    }

    const { data: inserted, error } = await supabase
      .from('content_events')
      .insert(toInsert)
      .select('id');

    if (error) {
      logger.error('Error seeding holidays:', error);
      return NextResponse.json({ success: false, error: 'Failed to seed holidays' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: inserted?.length ?? 0,
      skipped: globalHolidays.length - (inserted?.length ?? 0),
    });
  } catch (error) {
    logger.error('POST /api/events/seed error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
