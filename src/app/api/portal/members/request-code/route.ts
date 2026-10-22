import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { isEmailConfigured, sendPortalLoginCodeEmail } from '@/lib/email';
import {
  LOGIN_CODE_TTL_MINUTES,
  generateLoginCode,
  hashLoginCode,
  normalizeEmail,
  startMemberSession,
  toPublicMember,
  upsertMember,
} from '@/lib/portalMembers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const RequestCodeSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
});

// Max codes per email per client in the window below
const MAX_CODES_PER_WINDOW = 5;
const CODE_WINDOW_MINUTES = 15;

// POST /api/portal/members/request-code
// Step 1 of signing in to the portal as a person: emails a 6-digit code.
export async function POST(request: NextRequest) {
  try {
    const parsed = RequestCodeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter your name and a valid email address.' },
        { status: 400 }
      );
    }

    const { token, name } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    // Without Resend we can't verify emails — sign the person straight in so the
    // portal stays usable, and flag it loudly in the logs.
    if (!isEmailConfigured()) {
      logger.warn('RESEND_API_KEY not set — portal sign-in skipped email verification');
      const member = await upsertMember({
        clientId: resolved.clientId,
        partyId: resolved.party?.id ?? null,
        email,
        name,
      });
      if (!member) {
        return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
      }
      const response = NextResponse.json({ verification_required: false, member: toPublicMember(member) });
      if (!(await startMemberSession(member, response))) {
        return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
      }
      return response;
    }

    const windowStart = new Date(Date.now() - CODE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('portal_login_codes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', resolved.clientId)
      .eq('email', email)
      .gte('created_at', windowStart);

    if ((count ?? 0) >= MAX_CODES_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many codes requested. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const code = generateLoginCode();
    const { error: insertError } = await supabase.from('portal_login_codes').insert({
      client_id: resolved.clientId,
      email,
      code_hash: hashLoginCode(code, resolved.clientId, email),
      expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    });

    if (insertError) {
      logger.error('Failed to store portal login code:', insertError);
      return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', resolved.clientId)
      .maybeSingle();

    const sent = await sendPortalLoginCodeEmail({
      to: email,
      name,
      clientName: client?.name ?? 'Content',
      code,
      expiresInMinutes: LOGIN_CODE_TTL_MINUTES,
    });

    if (!sent.success) {
      return NextResponse.json(
        { error: "We couldn't send the code. Please check your email address and try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ verification_required: true });
  } catch (error) {
    logger.error('Portal request-code error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
