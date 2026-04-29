/**
 * Email utility using Resend.
 * Requires RESEND_API_KEY in environment variables.
 * RESEND_FROM_EMAIL defaults to 'noreply@content-manager.io'.
 */
import { Resend } from 'resend';
import logger from '@/lib/logger';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — email notifications disabled');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'Content Manager <noreply@content-manager.io>';

export interface ApprovalEmailParams {
  to: string;
  partyName: string;
  clientName: string;
  postCaption: string;
  postImageUrl: string | null;
  portalToken: string; // The party's portal_token
  scheduledDate: string | null;
  stepLabel: string | null;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://content-manager.io';
}

export async function sendApprovalRequestEmail(
  params: ApprovalEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const {
    to,
    partyName,
    clientName,
    postCaption,
    postImageUrl,
    portalToken,
    scheduledDate,
    stepLabel,
  } = params;

  const portalUrl = `${getAppUrl()}/portal/${portalToken}/kanban`;
  const captionPreview =
    postCaption.length > 200 ? postCaption.substring(0, 200) + '…' : postCaption;
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleDateString('en-NZ', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Approval Required — ${clientName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; }
    .header h1 { color: #ffffff; font-size: 18px; margin: 0; font-weight: 600; }
    .header p { color: #94a3b8; font-size: 14px; margin: 4px 0 0; }
    .body { padding: 32px; }
    .step-badge { display: inline-block; background: #f1f5f9; color: #475569; border-radius: 20px; padding: 4px 14px; font-size: 13px; margin-bottom: 20px; }
    .post-image { width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 16px; }
    .caption { background: #f8fafc; border-left: 3px solid #e2e8f0; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px; }
    .date { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .cta { display: block; background: #6366f1; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Action Required — ${clientName}</h1>
        <p>Hi ${partyName}, a post is waiting for your review.</p>
      </div>
      <div class="body">
        ${stepLabel ? `<div class="step-badge">Step: ${stepLabel}</div>` : ''}
        ${postImageUrl ? `<img src="${postImageUrl}" alt="Post preview" class="post-image" />` : ''}
        <div class="caption">${captionPreview}</div>
        ${dateStr ? `<p class="date">Scheduled for: ${dateStr}</p>` : ''}
        <a href="${portalUrl}" class="cta">Review &amp; Approve →</a>
      </div>
      <div class="footer">
        <p>You received this email because you are a reviewer on the ${clientName} content portal. <a href="${portalUrl}" style="color:#6366f1;">Open portal</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Review required: ${clientName} content${dateStr ? ` (${dateStr})` : ''}`,
      html,
    });

    if (error) {
      logger.error('Resend email error:', error);
      return { success: false, error: error.message };
    }

    logger.debug('Approval email sent', {
      to,
      partyName,
      emailId: data?.id,
    });

    return { success: true };
  } catch (err) {
    logger.error('Email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

// ── Autopilot emails ──────────────────────────────────────────────────────────

export interface AutopilotPlanEmailParams {
  to: string;
  userName: string;
  clientName: string;
  planSummary: string;
  postsCount: number;
  weekStart: string; // e.g. "June 8, 2026"
  weekEnd: string;
  approvalLink: string;
}

export async function sendAutopilotPlanReadyEmail(
  params: AutopilotPlanEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const { to, userName, clientName, planSummary, postsCount, weekStart, weekEnd, approvalLink } =
    params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Content plan ready — ${clientName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; }
    .header h1 { color: #ffffff; font-size: 18px; margin: 0; font-weight: 600; }
    .header p { color: #94a3b8; font-size: 14px; margin: 4px 0 0; }
    .body { padding: 32px; }
    .summary { background: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
    .badge { display: inline-block; background: #ede9fe; color: #6d28d9; border-radius: 20px; padding: 6px 16px; font-size: 14px; font-weight: 600; margin-bottom: 24px; }
    .cta { display: block; background: #6366f1; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>✨ Your content plan is ready!</h1>
        <p>${clientName} — Week of ${weekStart}</p>
      </div>
      <div class="body">
        <p style="font-size:15px;color:#1e293b;margin-top:0;">Hi ${userName},</p>
        <p style="font-size:14px;color:#475569;margin-bottom:20px;">
          Autopilot has generated a content plan for <strong>${clientName}</strong> covering
          <strong>${weekStart}</strong> to <strong>${weekEnd}</strong>.
        </p>
        <div class="summary">${planSummary}</div>
        <div class="badge">📅 ${postsCount} post${postsCount === 1 ? '' : 's'} generated</div>
        <a href="${approvalLink}" class="cta">Review &amp; Approve Plan →</a>
      </div>
      <div class="footer">
        <p>This plan was generated by Content Manager Autopilot. Posts won't be published until you approve them. <a href="${approvalLink}" style="color:#6366f1;">Open Autopilot</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `✨ Content plan ready: ${clientName} — Week of ${weekStart}`,
      html,
    });

    if (error) {
      logger.error('Resend autopilot plan email error:', error);
      return { success: false, error: error.message };
    }

    logger.debug('Autopilot plan ready email sent', { to, clientName, emailId: data?.id });
    return { success: true };
  } catch (err) {
    logger.error('Autopilot plan email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

export interface AutopilotPublishedEmailParams {
  to: string;
  userName: string;
  clientName: string;
  publishedCount: number;
  weekStart: string;
  autopilotLink: string;
}

export async function sendAutopilotPublishedEmail(
  params: AutopilotPublishedEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const { to, userName, clientName, publishedCount, weekStart, autopilotLink } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Posts published — ${clientName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; }
    .header h1 { color: #ffffff; font-size: 18px; margin: 0; font-weight: 600; }
    .header p { color: #94a3b8; font-size: 14px; margin: 4px 0 0; }
    .body { padding: 32px; }
    .badge { display: inline-block; background: #dcfce7; color: #166534; border-radius: 20px; padding: 6px 16px; font-size: 14px; font-weight: 600; margin-bottom: 24px; }
    .cta { display: block; background: #16a34a; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>🚀 Your posts are live!</h1>
        <p>${clientName} — Week of ${weekStart}</p>
      </div>
      <div class="body">
        <p style="font-size:15px;color:#1e293b;margin-top:0;">Hi ${userName},</p>
        <p style="font-size:14px;color:#475569;margin-bottom:20px;">
          Great news! Your approved content for <strong>${clientName}</strong> has been scheduled
          and is now live on your connected social accounts.
        </p>
        <div class="badge">✅ ${publishedCount} post${publishedCount === 1 ? '' : 's'} published for ${clientName}</div>
        <a href="${autopilotLink}" class="cta">View Autopilot Dashboard →</a>
      </div>
      <div class="footer">
        <p>Managed by Content Manager Autopilot. <a href="${autopilotLink}" style="color:#16a34a;">Open Autopilot</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🚀 ${publishedCount} post${publishedCount === 1 ? '' : 's'} published: ${clientName}`,
      html,
    });

    if (error) {
      logger.error('Resend autopilot published email error:', error);
      return { success: false, error: error.message };
    }

    logger.debug('Autopilot published email sent', { to, clientName, emailId: data?.id });
    return { success: true };
  } catch (err) {
    logger.error('Autopilot published email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
