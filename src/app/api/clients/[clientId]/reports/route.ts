import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { generateReport, listReports, ReportError, REPORTS_SETUP_MESSAGE } from '@/lib/analytics/reports';

export const dynamic = 'force-dynamic';
// Building a report reads the month from Zernio and writes the summary with AI
export const maxDuration = 120;

// A client's monthly reports: list them, or build one for a month ({ month: "YYYY-MM" }).
// Rebuilding a month keeps its share link.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  try {
    const reports = await listReports(createSupabaseAdmin(), clientId);
    if (reports === 'missing_table') return NextResponse.json({ success: true, reports: [], setupRequired: REPORTS_SETUP_MESSAGE });
    return NextResponse.json({ success: true, reports });
  } catch (error) {
    logger.error('GET reports error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load reports' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  try {
    const body = await request.json().catch(() => null);
    const report = await generateReport(createSupabaseAdmin(), clientId, String(body?.month ?? ''), auth.user.id);
    return NextResponse.json({ success: true, id: report.id, shareToken: report.shareToken });
  } catch (error) {
    if (error instanceof ReportError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    logger.error('POST report error:', error);
    return NextResponse.json({ success: false, error: 'Failed to build the report' }, { status: 500 });
  }
}
