import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { ZernioError, disconnectAccount, listAccounts } from '@/lib/zernio/api';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  clientId: z.string().uuid(),
  accountId: z.string().min(1).max(100),
});

// POST /api/late/disconnect-account — remove one connected social account from a client.
// Only accounts on the client's own Zernio profile can be removed.
export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'clientId and accountId are required' }, { status: 400 });
  }
  const { clientId, accountId } = parsed.data;

  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const { data: client } = await auth.supabase
    .from('clients')
    .select('late_profile_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client?.late_profile_id) {
    return NextResponse.json({ success: false, error: 'This client has no connected accounts' }, { status: 404 });
  }

  try {
    const accounts = await listAccounts(client.late_profile_id);
    if (!accounts.some(a => a._id === accountId)) {
      return NextResponse.json({ success: false, error: 'That account isn’t connected to this client' }, { status: 404 });
    }
    await disconnectAccount(accountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZernioError && error.status === 404) {
      // Already disconnected
      return NextResponse.json({ success: true });
    }
    logger.error('Disconnect account error:', error);
    return NextResponse.json({ success: false, error: 'Couldn’t disconnect that account — please try again' }, { status: 502 });
  }
}
