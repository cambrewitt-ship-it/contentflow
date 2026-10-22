import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { getMentionables } from '@/lib/commentNotifications';

// GET /api/portal/members/mentionables?token=xxx
// Everyone who can be @mentioned on this client's posts, for the portal composer.
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    return NextResponse.json({ mentionables: await getMentionables(resolved.clientId) });
  } catch (error) {
    logger.error('Portal mentionables error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
