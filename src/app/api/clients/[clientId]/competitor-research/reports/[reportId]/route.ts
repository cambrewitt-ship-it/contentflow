import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string; reportId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { clientId, reportId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const admin = createSupabaseAdmin();
    const { data: report } = await admin
      .from('competitor_research_reports')
      .select('*')
      .eq('id', reportId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    logger.error('GET /api/clients/[clientId]/competitor-research/reports/[reportId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { clientId, reportId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from('competitor_research_reports')
      .delete()
      .eq('id', reportId)
      .eq('client_id', clientId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/clients/[clientId]/competitor-research/reports/[reportId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
