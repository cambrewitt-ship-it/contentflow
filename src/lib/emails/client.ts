/**
 * Shared Resend client + send helpers for every email the app sends.
 *
 * Env:
 *   RESEND_API_KEY      — required to send anything
 *   RESEND_FROM_EMAIL   — e.g. "Content Manager <hello@content-manager.io>"
 *                         (must be on your Resend-verified domain)
 *   RESEND_REPLY_TO     — optional reply-to for transactional emails
 *   NEXT_PUBLIC_APP_URL — used to build links in emails
 */
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

let resendClient: Resend | null = null;

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — email sending disabled');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'Content Manager <noreply@content-manager.io>';

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://content-manager.io').replace(/\/$/, '');
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Short label for logs / Resend tags, e.g. "welcome", "auth_recovery". */
  type: string;
  replyTo?: string;
}

export type SendResult = { success: true; id?: string } | { success: false; error: string };

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const replyTo = params.replyTo ?? process.env.RESEND_REPLY_TO;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(replyTo ? { replyTo } : {}),
      tags: [{ name: 'type', value: params.type.replace(/[^a-zA-Z0-9_-]/g, '_') }],
    });

    if (error) {
      logger.error(`Resend error sending ${params.type} email:`, error);
      return { success: false, error: error.message };
    }

    logger.debug('Email sent', { type: params.type, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (err) {
    logger.error(`Failed to send ${params.type} email:`, err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Send an email at most once per `dedupeKey` (e.g. "welcome:<userId>",
 * "payment_failed:<invoiceId>"). Uses the email_log table (migration 030)
 * to claim the key before sending, so retried webhooks and double-clicked
 * links don't produce duplicate emails. If the send fails the key is
 * released so a later retry can try again.
 */
export async function sendEmailOnce(
  params: SendEmailParams & { dedupeKey: string; userId?: string | null }
): Promise<SendResult | { success: true; skipped: true }> {
  const { dedupeKey, userId, ...emailParams } = params;
  const recipient = Array.isArray(emailParams.to) ? emailParams.to.join(',') : emailParams.to;

  let supabase: ReturnType<typeof createSupabaseAdmin> | null = null;
  let logId: string | null = null;

  try {
    supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_log')
      .insert({
        user_id: userId ?? null,
        email_type: emailParams.type,
        recipient,
        dedupe_key: dedupeKey,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = unique_violation → already sent (or being sent)
      if (error.code === '23505') {
        logger.debug('Email already sent, skipping', { type: emailParams.type, dedupeKey });
        return { success: true, skipped: true };
      }
      // Table missing or other DB problem: don't block the email on logging.
      logger.warn('email_log insert failed, sending without dedupe', { error: error.message });
    } else {
      logId = data.id;
    }
  } catch (err) {
    logger.warn('email_log unavailable, sending without dedupe', err);
  }

  const result = await sendEmail(emailParams);

  if (supabase && logId) {
    const update = result.success
      ? { status: 'sent', resend_id: result.id ?? null }
      : { status: 'failed', error: result.error, dedupe_key: null };
    const { error } = await supabase.from('email_log').update(update).eq('id', logId);
    if (error) logger.warn('email_log update failed', { error: error.message });
  }

  return result;
}

/** Look up an auth user's email + display name with the service role. */
export async function getUserContact(
  userId: string
): Promise<{ email: string; name: string | null; createdAt: Date } | null> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return null;
    const meta = data.user.user_metadata ?? {};
    const name = (meta.full_name || meta.name || '').toString().trim() || null;
    return { email: data.user.email, name, createdAt: new Date(data.user.created_at) };
  } catch (err) {
    logger.error('Failed to look up user for email:', err);
    return null;
  }
}
