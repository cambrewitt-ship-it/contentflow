import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePortalToken } from '@/lib/portalAuth';
import { ApprovalSessionError, buildApprovalShareUrl, createApprovalSession } from '@/lib/approvalSessions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, postIds, expiresInDays = 30 } = body;

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: 'Post IDs are required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });

    const session = await createApprovalSession(supabase, {
      clientId: resolved.clientId,
      postIds,
      expiresInDays,
    });

    return NextResponse.json({ session, share_url: buildApprovalShareUrl(request, session.share_token) });
  } catch (error) {
    if (error instanceof ApprovalSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Portal approval link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
