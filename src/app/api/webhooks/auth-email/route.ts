/**
 * Supabase Auth "Send Email Hook".
 *
 * Supabase calls this instead of its built-in mailer for every auth email
 * (signup confirmation, password reset, magic link, invite, email change,
 * reauthentication and security notifications). We render our own branded
 * templates and send them through Resend from our verified domain.
 *
 * Setup: Supabase Dashboard → Authentication → Hooks → Send Email hook →
 * HTTPS → https://<your-domain>/api/webhooks/auth-email, then copy the
 * generated secret ("v1,whsec_...") into SEND_EMAIL_HOOK_SECRET.
 * See EMAIL_SETUP.md.
 */
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { sendEmail } from '@/lib/emails/client';
import {
  confirmSignupEmail,
  emailChangeEmail,
  inviteEmail,
  isSecurityNotice,
  magicLinkEmail,
  reauthenticationEmail,
  resetPasswordEmail,
  securityNoticeEmail,
} from '@/lib/emails/templates';
import type { RenderedEmail } from '@/lib/emails/layout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface HookPayload {
  user: {
    id: string;
    email: string;
    new_email?: string;
    user_metadata?: { full_name?: string; name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string;
  };
}

const TOLERANCE_SECONDS = 5 * 60;

/** Standard Webhooks signature check (https://www.standardwebhooks.com). */
function verifySignature(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatureHeader = headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return signatureHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const received = Buffer.from(sig, 'base64');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  });
}

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

function verifyUrl(tokenHash: string, type: string, redirectTo: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo });
  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
}

function buildEmails(payload: HookPayload): { to: string; email: RenderedEmail }[] {
  const { user, email_data: d } = payload;
  const name = (user.user_metadata?.full_name || user.user_metadata?.name || '').trim() || null;
  const redirectTo = d.redirect_to || d.site_url;
  const type = d.email_action_type;

  switch (type) {
    case 'signup':
      return [{ to: user.email, email: confirmSignupEmail({ name, url: verifyUrl(d.token_hash, type, redirectTo) }) }];
    case 'recovery':
      return [{ to: user.email, email: resetPasswordEmail({ name, url: verifyUrl(d.token_hash, type, redirectTo) }) }];
    case 'magiclink':
      return [{ to: user.email, email: magicLinkEmail({ name, url: verifyUrl(d.token_hash, type, redirectTo) }) }];
    case 'invite':
      return [{ to: user.email, email: inviteEmail({ url: verifyUrl(d.token_hash, type, redirectTo) }) }];
    case 'reauthentication':
      return [{ to: user.email, email: reauthenticationEmail({ name, code: d.token }) }];
    case 'email_change': {
      // Supabase's field naming is reversed here: token_hash goes to the NEW
      // address, token_hash_new goes to the CURRENT address.
      const newEmail = user.new_email || user.email;
      const out = [
        {
          to: newEmail,
          email: emailChangeEmail({
            name,
            newEmail,
            toCurrentAddress: false,
            url: verifyUrl(d.token_hash, type, redirectTo),
          }),
        },
      ];
      if (d.token_hash_new && user.new_email) {
        out.push({
          to: user.email,
          email: emailChangeEmail({
            name,
            newEmail,
            toCurrentAddress: true,
            url: verifyUrl(d.token_hash_new, type, redirectTo),
          }),
        });
      }
      return out;
    }
    default:
      if (isSecurityNotice(type)) {
        return [{ to: user.email, email: securityNoticeEmail({ type, name }) }];
      }
      logger.warn('Unhandled auth email action type', { type });
      return [];
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    logger.error('SEND_EMAIL_HOOK_SECRET not set — cannot verify auth email hook');
    return hookError(500, 'Email hook not configured');
  }

  const body = await req.text();
  if (!verifySignature(body, req.headers, secret)) {
    return hookError(401, 'Invalid signature');
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, 'Invalid payload');
  }

  const emails = buildEmails(payload);
  for (const { to, email } of emails) {
    const result = await sendEmail({
      ...email,
      to,
      type: `auth_${payload.email_data.email_action_type}`,
    });
    if (!result.success) {
      // Returning an error makes Supabase surface it to the user (e.g. the
      // signup/reset form shows "Error sending email") instead of silently
      // pretending an email went out.
      return hookError(500, `Failed to send email: ${result.error}`);
    }
  }

  return NextResponse.json({});
}
