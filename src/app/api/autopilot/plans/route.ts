import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'clientId is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();
    const { data: plans, error } = await admin
      .from('autopilot_plans')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('Error fetching autopilot plans:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch plans' }, { status: 500 });
    }

    return NextResponse.json({ success: true, plans: plans ?? [] });
  } catch (error) {
    logger.error('GET /api/autopilot/plans error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
