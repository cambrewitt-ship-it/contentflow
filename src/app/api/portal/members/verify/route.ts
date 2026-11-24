import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import {
  LOGIN_CODE_MAX_ATTEMPTS,
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

const VerifySchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
});

// POST /api/portal/members/verify
// Step 2: checks the emailed code, creates/updates the profile and signs this device in.
export async function POST(request: NextRequest) {
  try {
    const parsed = VerifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter the 6-digit code from the email.' }, { status: 400 });
    }

    const { token, name, code } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    // Only the most recent unused code counts
    const { data: loginCode } = await supabase
      .from('portal_login_codes')
      .select('id, code_hash, attempts, expires_at')
      .eq('client_id', resolved.clientId)
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!loginCode || new Date(loginCode.expires_at) < new Date()) {
      return NextResponse.json({ error: 'That code has expired. Please request a new one.' }, { status: 400 });
    }
    if (loginCode.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 });
    }

    const expected = Buffer.from(loginCode.code_hash, 'hex');
    const actual = Buffer.from(hashLoginCode(code, resolved.clientId, email), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await supabase
        .from('portal_login_codes')
        .update({ attempts: loginCode.attempts + 1 })
        .eq('id', loginCode.id);
      return NextResponse.json({ error: "That code isn't right. Please try again." }, { status: 400 });
    }

    await supabase
      .from('portal_login_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', loginCode.id);

    const member = await upsertMember({
      clientId: resolved.clientId,
      partyId: resolved.party?.id ?? null,
      email,
      name,
    });
    if (!member) {
      return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
    }

    const response = NextResponse.json({ member: toPublicMember(member) });
    if (!(await startMemberSession(member, response))) {
      return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
    }
    return response;
  } catch (error) {
    logger.error('Portal verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
