import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeWatcher } from '@/lib/approvalWatchers';

export const dynamic = 'force-dynamic';

// Public: the "Stop these emails" link in approval update emails (token checked here).
// GET shows a confirm button (link scanners prefetch GETs), POST removes the address.

function page(title: string, body: string, status = 200) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" /><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:48px 16px;color:#0f172a}
.card{max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#475569;font-size:14px;line-height:1.6}
button{background:#356df3;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer}</style>
</head><body><div class="card">${body}</div></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{32,128}$/i.test(token)) {
    return page('Link not valid', '<h1>This link isn’t valid</h1><p>You may already have stopped these emails.</p>', 404);
  }
  return page(
    'Stop approval update emails',
    `<h1>Stop approval update emails?</h1><p>You won’t get emails about this client’s post approvals any more.</p>
<form method="POST"><input type="hidden" name="token" value="${escapeHtml(token)}" /><button type="submit">Stop these emails</button></form>`
  );
}

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get('token') ?? '';
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = (form?.get('token') as string | null) ?? '';
  }
  const result = await unsubscribeWatcher(token);
  if (!result.ok) {
    return page('Already stopped', '<h1>You’re not on this list</h1><p>These emails have already been stopped.</p>');
  }
  return page(
    'Emails stopped',
    `<h1>Done — emails stopped</h1><p>${escapeHtml(result.email ?? 'You')} won’t get approval updates${
      result.clientName ? ` for ${escapeHtml(result.clientName)}` : ''
    } any more.</p>`
  );
}
