import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { endMemberSession } from '@/lib/portalMembers';

const LogoutSchema = z.object({ token: z.string().min(1) });

// POST /api/portal/members/logout — signs this device out of the portal profile
export async function POST(request: NextRequest) {
  try {
    const parsed = LogoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(parsed.data.token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    await endMemberSession(request, resolved.clientId, response);
    return response;
  } catch (error) {
    logger.error('Portal member logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
