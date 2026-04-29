import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface PublicHoliday {
  date: string;
  name: string;
  localName: string;
  countryCode: string;
  global: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'GB';
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const nagerUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${region}`;
    const res = await fetch(nagerUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { success: false, error: `No holidays found for region "${region}"` },
          { status: 404 }
        );
      }
      throw new Error(`Nager API returned ${res.status}`);
    }

    const raw: NagerHoliday[] = await res.json();

    const holidays: PublicHoliday[] = raw
      .filter(h => h.global)
      .map(h => ({
        date: h.date,
        name: h.name,
        localName: h.localName,
        countryCode: h.countryCode,
        global: h.global,
      }));

    return NextResponse.json({ success: true, holidays, region, year: parseInt(year) });
  } catch (error) {
    logger.error('GET /api/events/holidays error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch holidays' }, { status: 500 });
  }
}
