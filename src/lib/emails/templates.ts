/**
 * Copy for every transactional email. Each function returns
 * { subject, html, text } ready to hand to sendEmail().
 */
import { getAppUrl } from './client';
import { renderEmail, type RenderedEmail } from './layout';

const greet = (name?: string | null) => (name ? `Hi ${name.split(' ')[0]},` : 'Hi there,');

// ── Auth (sent via the Supabase Send Email Hook) ─────────────────────────────

export function confirmSignupEmail(p: { name?: string | null; url: string }): RenderedEmail {
  return renderEmail('Confirm your email for Content Manager', {
    preheader: 'One click to confirm your email and get started.',
    heading: 'Confirm your email',
    paragraphs: [
      greet(p.name),
      'Thanks for signing up for Content Manager. Please confirm your email address to activate your account.',
    ],
    cta: { label: 'Confirm email', url: p.url },
    note: "If you didn't create a Content Manager account, you can safely ignore this email.",
  });
}

export function resetPasswordEmail(p: { name?: string | null; url: string }): RenderedEmail {
  return renderEmail('Reset your Content Manager password', {
    preheader: 'Use this link to choose a new password.',
    heading: 'Reset your password',
    paragraphs: [
      greet(p.name),
      'We received a request to reset the password for your Content Manager account. Click the button below to choose a new one. This link expires in 1 hour and can only be used once.',
    ],
    cta: { label: 'Reset password', url: p.url },
    note: "If you didn't request a password reset, you can ignore this email — your password won't change.",
  });
}

export function magicLinkEmail(p: { name?: string | null; url: string; code?: string }): RenderedEmail {
  return renderEmail('Your Content Manager sign-in link', {
    preheader: 'Your secure sign-in link is inside.',
    heading: 'Sign in to Content Manager',
    paragraphs: [greet(p.name), 'Click the button below to sign in. This link expires shortly and can only be used once.'],
    cta: { label: 'Sign in', url: p.url },
    note: "If you didn't try to sign in, you can safely ignore this email.",
  });
}

export function inviteEmail(p: { url: string }): RenderedEmail {
  return renderEmail("You've been invited to Content Manager", {
    preheader: 'Accept your invitation to get started.',
    heading: "You've been invited",
    paragraphs: [
      'Hi there,',
      "You've been invited to join Content Manager. Click below to accept the invitation and set up your account.",
    ],
    cta: { label: 'Accept invitation', url: p.url },
    note: "If you weren't expecting this invitation, you can ignore this email.",
  });
}

export function emailChangeEmail(p: {
  name?: string | null;
  url: string;
  newEmail: string;
  toCurrentAddress: boolean;
}): RenderedEmail {
  return renderEmail('Confirm your new email address', {
    preheader: `Confirm ${p.newEmail} as your Content Manager email.`,
    heading: 'Confirm your email change',
    paragraphs: [
      greet(p.name),
      p.toCurrentAddress
        ? `We received a request to change your Content Manager email to ${p.newEmail}. Click below to approve this change from your current address.`
        : `Click below to confirm ${p.newEmail} as the new email address for your Content Manager account.`,
    ],
    cta: { label: 'Confirm email change', url: p.url },
    note: "If you didn't request this change, ignore this email and consider resetting your password.",
  });
}

export function reauthenticationEmail(p: { name?: string | null; code: string }): RenderedEmail {
  return renderEmail('Your Content Manager verification code', {
    preheader: `Your verification code is ${p.code}`,
    heading: 'Confirm it’s you',
    paragraphs: [greet(p.name), 'Enter this code to confirm a sensitive change to your account:'],
    code: p.code,
    note: "If you didn't request this code, someone may be trying to change your account. Reset your password to be safe.",
  });
}

const SECURITY_NOTICES: Record<string, { subject: string; heading: string; body: string }> = {
  password_changed_notification: {
    subject: 'Your Content Manager password was changed',
    heading: 'Your password was changed',
    body: 'The password for your Content Manager account was just changed.',
  },
  email_changed_notification: {
    subject: 'Your Content Manager email was changed',
    heading: 'Your email address was changed',
    body: 'The email address on your Content Manager account was just changed.',
  },
  phone_changed_notification: {
    subject: 'Your Content Manager phone number was changed',
    heading: 'Your phone number was changed',
    body: 'The phone number on your Content Manager account was just changed.',
  },
  identity_linked_notification: {
    subject: 'A new sign-in method was added to your account',
    heading: 'New sign-in method linked',
    body: 'A new sign-in method was just linked to your Content Manager account.',
  },
  identity_unlinked_notification: {
    subject: 'A sign-in method was removed from your account',
    heading: 'Sign-in method removed',
    body: 'A sign-in method was just removed from your Content Manager account.',
  },
  mfa_factor_enrolled_notification: {
    subject: 'Two-factor authentication was added to your account',
    heading: 'Two-factor method added',
    body: 'A new two-factor authentication method was added to your Content Manager account.',
  },
  mfa_factor_unenrolled_notification: {
    subject: 'Two-factor authentication was removed from your account',
    heading: 'Two-factor method removed',
    body: 'A two-factor authentication method was removed from your Content Manager account.',
  },
};

export function isSecurityNotice(type: string): boolean {
  return type in SECURITY_NOTICES;
}

export function securityNoticeEmail(p: { type: string; name?: string | null }): RenderedEmail {
  const notice = SECURITY_NOTICES[p.type] ?? {
    subject: 'Security alert for your Content Manager account',
    heading: 'Account security notice',
    body: 'A security-related change was made to your Content Manager account.',
  };
  return renderEmail(notice.subject, {
    preheader: notice.body,
    heading: notice.heading,
    paragraphs: [greet(p.name), notice.body, 'If this was you, no action is needed.'],
    cta: { label: 'Secure my account', url: `${getAppUrl()}/auth/forgot-password` },
    note: "If you didn't make this change, reset your password immediately and contact support by replying to this email.",
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export function welcomeEmail(p: { name?: string | null }): RenderedEmail {
  const appUrl = getAppUrl();
  return renderEmail('Welcome to Content Manager 👋', {
    preheader: "You're all set — here's how to get the most out of Content Manager.",
    heading: 'Welcome to Content Manager',
    paragraphs: [
      greet(p.name),
      "Thanks for joining Content Manager — we're glad you're here. Here's the fastest way to get value in your first week:",
      '1. Add your first client and fill in their brand information so AI captions sound like them.',
      '2. Connect their social accounts so you can schedule straight from the calendar.',
      '3. Create a week of content in the Content Suite, then share the client portal for approvals.',
      'Questions or feedback? Just reply to this email — it comes straight to our team.',
    ],
    cta: { label: 'Go to your dashboard', url: `${appUrl}/dashboard` },
  });
}

export function accountDeletedEmail(p: { name?: string | null }): RenderedEmail {
  return renderEmail('Your Content Manager account has been deleted', {
    preheader: 'Your account and data have been removed.',
    heading: 'Your account has been deleted',
    paragraphs: [
      greet(p.name),
      'This confirms that your Content Manager account and its data have been permanently deleted.',
      "We're sorry to see you go. If you have a moment, reply and let us know what we could have done better.",
    ],
    note: "If you didn't request this, reply to this email immediately.",
  });
}

// ── Billing (sent from the Stripe webhook) ───────────────────────────────────

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const billingUrl = () => `${getAppUrl()}/settings/billing`;

export function subscriptionStartedEmail(p: {
  name?: string | null;
  planName: string;
  trialEnd?: Date | null;
}): RenderedEmail {
  const trial = p.trialEnd && p.trialEnd.getTime() > Date.now();
  return renderEmail(
    trial ? `Your Content Manager trial has started` : `You're subscribed to Content Manager ${p.planName}`,
    {
      preheader: trial
        ? `Your free trial runs until ${formatDate(p.trialEnd!)}.`
        : `Your ${p.planName} plan is now active.`,
      heading: trial ? 'Your free trial has started' : 'Your subscription is active',
      paragraphs: [
        greet(p.name),
        trial
          ? `You're on the ${p.planName} plan with full access until ${formatDate(p.trialEnd!)}. You won't be charged until then, and you can cancel any time from your billing settings.`
          : `Thanks for subscribing! Your ${p.planName} plan is now active. Receipts and invoices are available in your billing settings.`,
      ],
      cta: { label: 'Manage billing', url: billingUrl() },
    }
  );
}

export function trialEndingEmail(p: { name?: string | null; planName: string; trialEnd: Date }): RenderedEmail {
  return renderEmail('Your Content Manager trial ends soon', {
    preheader: `Your trial ends on ${formatDate(p.trialEnd)}.`,
    heading: 'Your trial ends soon',
    paragraphs: [
      greet(p.name),
      `Just a heads-up: your free trial of the ${p.planName} plan ends on ${formatDate(p.trialEnd)}. After that, your subscription will start automatically using the card on file — no action needed to keep going.`,
      'Want to change plans or cancel? You can do that any time from your billing settings.',
    ],
    cta: { label: 'Review my plan', url: billingUrl() },
  });
}

export function paymentFailedEmail(p: {
  name?: string | null;
  amount: string;
  nextAttempt?: Date | null;
  invoiceUrl?: string | null;
}): RenderedEmail {
  return renderEmail('Action needed: your Content Manager payment failed', {
    preheader: 'Please update your payment method to keep your account active.',
    heading: "We couldn't process your payment",
    paragraphs: [
      greet(p.name),
      `We tried to charge ${p.amount} for your Content Manager subscription, but the payment didn't go through. This usually happens when a card expires or the bank declines the charge.`,
      p.nextAttempt
        ? `We'll try again on ${formatDate(p.nextAttempt)}. To avoid any interruption, please update your payment method before then.`
        : 'Please update your payment method to avoid any interruption to your account.',
    ],
    cta: { label: 'Update payment method', url: p.invoiceUrl || billingUrl() },
  });
}

export function subscriptionCanceledEmail(p: { name?: string | null }): RenderedEmail {
  return renderEmail('Your Content Manager subscription has ended', {
    preheader: "Your subscription has been cancelled. You can come back any time.",
    heading: 'Your subscription has ended',
    paragraphs: [
      greet(p.name),
      "Your Content Manager subscription has been cancelled and paid features are no longer available. Your clients and content are still in your account if you decide to come back.",
      "We'd love to know why you left — just reply to this email.",
    ],
    cta: { label: 'Resubscribe', url: `${getAppUrl()}/pricing` },
  });
}

// ── Internal ─────────────────────────────────────────────────────────────────

export function contactFormNotificationEmail(p: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): RenderedEmail {
  return renderEmail(`[Contact] ${p.subject}`, {
    preheader: `New message from ${p.name}`,
    heading: 'New contact form message',
    paragraphs: [`From: ${p.name} <${p.email}>`, `Subject: ${p.subject}`, ...p.message.split(/\n{2,}/)],
    note: 'Reply directly to this email to respond to the sender.',
  });
}
