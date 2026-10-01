/**
 * Branded HTML shell for transactional emails. Table-based with inline
 * styles so it renders in Gmail, Outlook and Apple Mail.
 */
import { getAppUrl } from './client';

const BRAND = '#3B7FE8';
const TEXT = '#1f2937';
const MUTED = '#6b7280';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  /** Hidden inbox preview text. */
  preheader: string;
  heading: string;
  /** Paragraphs of body copy (plain text — escaped here). */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Shown under the CTA in a highlighted box, e.g. an OTP code. */
  code?: string;
  /** Small print under the main content (plain text). */
  note?: string;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT};">${escapeHtml(text)}</p>`;
}

export function renderLayout(opts: LayoutOptions): string {
  const appUrl = getAppUrl();
  const year = new Date().getFullYear();

  const cta = opts.cta
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
            <tr>
              <td style="border-radius:8px;background:${BRAND};">
                <a href="${escapeHtml(opts.cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${MUTED};">Button not working? Paste this link into your browser:<br /><a href="${escapeHtml(opts.cta.url)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(opts.cta.url)}</a></p>`
    : '';

  const code = opts.code
    ? `<div style="margin:8px 0 24px;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;font-size:28px;font-weight:700;letter-spacing:6px;color:${TEXT};font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(opts.code)}</div>`
    : '';

  const note = opts.note
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(opts.note)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 20px;text-align:center;">
              <a href="${appUrl}" target="_blank"><img src="${appUrl}/cm-logo.png" alt="Content Manager" width="160" style="display:inline-block;max-width:160px;height:auto;border:0;" /></a>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${TEXT};">${escapeHtml(opts.heading)}</h1>
              ${opts.paragraphs.map(p).join('\n              ')}
              ${code}
              ${cta}
              ${note}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;">
              &copy; ${year} Content Manager &middot; <a href="${appUrl}" style="color:#9ca3af;">content-manager.io</a><br />
              You're receiving this because of activity on your Content Manager account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative — improves deliverability and accessibility. */
export function renderText(opts: LayoutOptions): string {
  const parts = [opts.heading, '', ...opts.paragraphs.flatMap((line) => [line, ''])];
  if (opts.code) parts.push(opts.code, '');
  if (opts.cta) parts.push(`${opts.cta.label}: ${opts.cta.url}`, '');
  if (opts.note) parts.push(opts.note, '');
  parts.push('— The Content Manager team', getAppUrl());
  return parts.join('\n');
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(subject: string, opts: LayoutOptions): RenderedEmail {
  return { subject, html: renderLayout(opts), text: renderText(opts) };
}
