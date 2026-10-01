/**
 * High-level senders for lifecycle + billing emails. Each one is safe to
 * call more than once — duplicates are suppressed via email_log dedupe keys.
 * They never throw; callers can fire them without wrapping in try/catch.
 */
import logger from '@/lib/logger';
import { getUserContact, sendEmail, sendEmailOnce, type SendResult } from './client';
import {
  accountDeletedEmail,
  contactFormNotificationEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  subscriptionStartedEmail,
  trialEndingEmail,
  welcomeEmail,
} from './templates';

export { sendEmail, sendEmailOnce, getAppUrl, getUserContact } from './client';

async function safely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error(`Failed to send ${label} email:`, err);
  }
}

// Only accounts created this recently get a welcome email, so users who
// signed up before email_log existed aren't welcomed out of the blue.
const WELCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function sendWelcomeEmail(userId: string) {
  return safely('welcome', async () => {
    const user = await getUserContact(userId);
    if (!user || Date.now() - user.createdAt.getTime() > WELCOME_WINDOW_MS) return;
    await sendEmailOnce({
      ...welcomeEmail({ name: user.name }),
      to: user.email,
      type: 'welcome',
      userId,
      dedupeKey: `welcome:${userId}`,
    });
  });
}

export function sendSubscriptionStartedEmail(p: {
  userId: string;
  subscriptionId: string;
  planName: string;
  trialEnd?: Date | null;
}) {
  return safely('subscription_started', async () => {
    const user = await getUserContact(p.userId);
    if (!user) return;
    await sendEmailOnce({
      ...subscriptionStartedEmail({ name: user.name, planName: p.planName, trialEnd: p.trialEnd }),
      to: user.email,
      type: 'subscription_started',
      userId: p.userId,
      dedupeKey: `subscription_started:${p.subscriptionId}`,
    });
  });
}

export function sendTrialEndingEmail(p: {
  userId: string;
  subscriptionId: string;
  planName: string;
  trialEnd: Date;
}) {
  return safely('trial_ending', async () => {
    const user = await getUserContact(p.userId);
    if (!user) return;
    await sendEmailOnce({
      ...trialEndingEmail({ name: user.name, planName: p.planName, trialEnd: p.trialEnd }),
      to: user.email,
      type: 'trial_ending',
      userId: p.userId,
      dedupeKey: `trial_ending:${p.subscriptionId}:${p.trialEnd.getTime()}`,
    });
  });
}

export function sendPaymentFailedEmail(p: {
  userId: string;
  invoiceId: string;
  attempt: number;
  amount: string;
  nextAttempt?: Date | null;
  invoiceUrl?: string | null;
}) {
  return safely('payment_failed', async () => {
    const user = await getUserContact(p.userId);
    if (!user) return;
    await sendEmailOnce({
      ...paymentFailedEmail({
        name: user.name,
        amount: p.amount,
        nextAttempt: p.nextAttempt,
        invoiceUrl: p.invoiceUrl,
      }),
      to: user.email,
      type: 'payment_failed',
      userId: p.userId,
      dedupeKey: `payment_failed:${p.invoiceId}:${p.attempt}`,
    });
  });
}

export function sendSubscriptionCanceledEmail(p: { userId: string; subscriptionId: string }) {
  return safely('subscription_canceled', async () => {
    const user = await getUserContact(p.userId);
    if (!user) return;
    await sendEmailOnce({
      ...subscriptionCanceledEmail({ name: user.name }),
      to: user.email,
      type: 'subscription_canceled',
      userId: p.userId,
      dedupeKey: `subscription_canceled:${p.subscriptionId}`,
    });
  });
}

/** Call after the auth user is gone, with details captured beforehand. */
export function sendAccountDeletedEmail(p: { email: string; name?: string | null }) {
  return safely('account_deleted', async () => {
    await sendEmail({ ...accountDeletedEmail({ name: p.name }), to: p.email, type: 'account_deleted' });
  });
}

/** Notify the team inbox about a contact form submission. */
export async function sendContactFormNotification(p: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<SendResult | { success: true; skipped: true }> {
  const to = process.env.SUPPORT_EMAIL || process.env.RESEND_REPLY_TO;
  if (!to || !process.env.RESEND_API_KEY) {
    // Not configured yet: the submission is still logged by the caller.
    logger.warn('SUPPORT_EMAIL/RESEND_API_KEY not set — contact form notification not sent');
    return { success: true as const, skipped: true };
  }
  return sendEmail({
    ...contactFormNotificationEmail(p),
    to,
    type: 'contact_form',
    replyTo: p.email,
  });
}
