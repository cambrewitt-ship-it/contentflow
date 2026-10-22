import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { getPortalMember, toPublicMember } from '@/lib/portalMembers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const UpdateMeSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  email_notifications: z.boolean().optional(),
});

// GET /api/portal/members/me?token=xxx
// Who is signed in to this portal on this device (member is null if nobody).
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

    const member = await getPortalMember(request, resolved.clientId);
    if (member) {
      // Keep last_seen fresh without blocking the response on it
      // (query builders are lazy, so .then() is what actually sends it)
      supabase
        .from('portal_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', member.id)
        .then(({ error }) => {
          if (error) logger.warn('Failed to update portal member last_seen_at', error);
        });
    }

    return NextResponse.json({ member: member ? toPublicMember(member) : null });
  } catch (error) {
    logger.error('Portal member me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/portal/members/me — update your own name / email notification setting
export async function PATCH(request: NextRequest) {
  try {
    const parsed = UpdateMeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { token, ...updates } = parsed.data;
    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const member = await getPortalMember(request, resolved.clientId);
    if (!member) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('portal_members')
      .update(updates)
      .eq('id', member.id)
      .select('id, client_id, party_id, email, name, color, email_notifications')
      .single();

    if (error || !data) {
      logger.error('Failed to update portal member:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ member: toPublicMember(data) });
  } catch (error) {
    logger.error('Portal member PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
