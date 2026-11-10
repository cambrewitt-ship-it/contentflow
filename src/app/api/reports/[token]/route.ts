import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { reportByToken } from '@/lib/analytics/reports';

export const dynamic = 'force-dynamic';

// A shared monthly report, read-only, for whoever has the link (no login).
// The token is long and random; the report holds only what the client would see.

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const report = await reportByToken(createSupabaseAdmin(), token);
  if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
  return NextResponse.json(
    { success: true, report },
    { headers: { 'Cache-Control': 'private, max-age=300', 'X-Robots-Tag': 'noindex' } }
  );
}
