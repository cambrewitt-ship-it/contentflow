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
          Content Agent has generated a content plan for <strong>${clientName}</strong> covering
          <strong>${weekStart}</strong> to <strong>${weekEnd}</strong>.
        </p>
        <div class="summary">${planSummary}</div>
        <div class="badge">📅 ${postsCount} post${postsCount === 1 ? '' : 's'} generated</div>
        <a href="${approvalLink}" class="cta">Review &amp; Approve Plan →</a>
      </div>
      <div class="footer">
        <p>This plan was generated by Content Agent. Posts won't be published until you approve them. <a href="${approvalLink}" style="color:#6366f1;">Open Content Agent</a></p>
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
        <a href="${autopilotLink}" class="cta">View Content Agent →</a>
      </div>
      <div class="footer">
        <p>Managed by Content Agent. <a href="${autopilotLink}" style="color:#16a34a;">Open Content Agent</a></p>
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

// ── Portal profile emails ─────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PORTAL_EMAIL_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; }
    .header h1 { color: #ffffff; font-size: 18px; margin: 0; font-weight: 600; }
    .header p { color: #94a3b8; font-size: 14px; margin: 4px 0 0; }
    .body { padding: 32px; }
    .code { font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #0f172a; background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0 24px; }
    .quote { background: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap; }
    .post { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .post img { display: block; width: 100%; max-width: 360px; height: auto; border-radius: 8px; margin: 0 auto 8px; }
    .video-placeholder { display: block; background: #0f172a; color: #ffffff !important; text-decoration: none; text-align: center; padding: 48px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .cta { display: block; background: #6366f1; color: #ffffff !important; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
`;

export interface PortalLoginCodeEmailParams {
  to: string;
  name: string;
  clientName: string;
  code: string;
  expiresInMinutes: number;
}

export async function sendPortalLoginCodeEmail(
  params: PortalLoginCodeEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const { to, name, clientName, code, expiresInMinutes } = params;
  const safeClient = escapeHtml(clientName);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your sign-in code — ${safeClient}</title>
  <style>${PORTAL_EMAIL_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Your sign-in code</h1>
        <p>${safeClient} content portal</p>
      </div>
      <div class="body">
        <p style="font-size:15px;color:#1e293b;margin-top:0;">Hi ${escapeHtml(name)},</p>
        <p style="font-size:14px;color:#475569;margin:0;">Enter this code in the portal to confirm it's you:</p>
        <div class="code">${code}</div>
        <p style="font-size:13px;color:#64748b;margin:0;">It expires in ${expiresInMinutes} minutes. If you didn't try to sign in, you can ignore this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${code} is your ${clientName} portal code`,
      html,
    });
    if (error) {
      logger.error('Resend portal login code error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    logger.error('Portal login code send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

export interface CommentNotificationEmailParams {
  to: string;
  recipientName: string;
  authorName: string;
  clientName: string;
  reason: 'mention' | 'reply';
  commentText: string; // plain text, mentions already flattened
  postCaption: string | null;
  postImageUrl: string | null;
  /** The post's media is a video — postImageUrl (if set) is a thumbnail of it. */
  postIsVideo?: boolean;
  link: string;
}

export async function sendCommentNotificationEmail(
  params: CommentNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email not configured' };

  const { to, recipientName, authorName, clientName, reason, commentText, postCaption, postImageUrl, postIsVideo, link } = params;
  const action = reason === 'mention' ? 'mentioned you' : 'replied to your comment';
  const caption = postCaption
    ? postCaption.length > 160 ? postCaption.substring(0, 160) + '…' : postCaption
    : null;
  const safeLink = escapeHtml(link);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(authorName)} ${action}</title>
  <style>${PORTAL_EMAIL_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>${escapeHtml(authorName)} ${action}</h1>
        <p>${escapeHtml(clientName)}</p>
      </div>
      <div class="body">
        <p style="font-size:15px;color:#1e293b;margin-top:0;">Hi ${escapeHtml(recipientName)},</p>
        <div class="quote">${escapeHtml(commentText)}</div>
        ${postImageUrl || postIsVideo || caption ? `
        <div class="post">
          ${postImageUrl
            ? `<a href="${safeLink}"><img src="${escapeHtml(postImageUrl)}" alt="${postIsVideo ? 'Video' : 'Post'}" /></a>`
            : postIsVideo
              ? `<a href="${safeLink}" class="video-placeholder">&#9654;&nbsp; Watch the video in the portal</a>`
              : ''}
          ${caption ? `<div>${escapeHtml(caption)}</div>` : ''}
        </div>` : ''}
        <a href="${safeLink}" class="cta">Reply in the portal →</a>
      </div>
      <div class="footer">
        <p>You're getting this because someone ${reason === 'mention' ? 'tagged you' : 'replied to you'} on a post for ${escapeHtml(clientName)}.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${authorName} ${action} — ${clientName}`,
      html,
    });
    if (error) {
      logger.error('Resend comment notification error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    logger.error('Comment notification send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
