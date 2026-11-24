import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { getMentionables } from '@/lib/commentNotifications';

// GET /api/clients/[clientId]/mentionables
// Everyone who can be @mentioned on this client's posts, for the agency composer.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    return NextResponse.json({ mentionables: await getMentionables(clientId) });
  } catch (error) {
    logger.error('Agency mentionables error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
