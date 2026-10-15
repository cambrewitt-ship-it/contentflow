import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string; accountId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { clientId, accountId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from('competitor_accounts')
      .delete()
      .eq('id', accountId)
      .eq('client_id', clientId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/clients/[clientId]/competitor-research/accounts/[accountId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
