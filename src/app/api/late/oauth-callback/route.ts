// app/api/late/oauth-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

const APP_DASHBOARD_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Server-side logging for debugging (check your dev console / terminal)
    console.log('=== LATE OAuth callback received ===');
    console.log('Query params:', params);
    console.log('Full url:', req.url);
    console.log('Headers snapshot (partial):', {
      host: req.headers.get('host'),
      referer: req.headers.get('referer'),
      'user-agent': req.headers.get('user-agent'),
    });

    // If LATE returned a profileId, redirect the user to that client's dashboard page
    const profileId = params.profileId || params.profile_id || params.accountId || params.account_id || null;

    if (profileId) {
      // Build a safe redirect URL to your dashboard/client page
      // We use the dashboard base from NEXT_PUBLIC_APP_URL (or fallback localhost:3002).
      // Adjust path if your dashboard route differs.
      const redirectTo = `${APP_DASHBOARD_BASE.replace(/\/$/, '')}/dashboard/client/${encodeURIComponent(profileId)}?lateConnect=success`;
      console.log('Redirecting to:', redirectTo);
      return NextResponse.redirect(redirectTo);
    }

    // If no profileId found — show debug HTML so you can inspect what LATE actually sent
    const prettyParams = Object.entries(params).map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>LATE OAuth Callback — Debug</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
            pre { background:#f6f8fa; padding:12px; border-radius:8px; overflow:auto; }
            li { margin-bottom:6px; }
          </style>
        </head>
        <body>
          <h1>LATE OAuth Callback — Debug</h1>
          <p>No <code>profileId</code> was found in the callback query parameters.</p>
          <h2>Query parameters received</h2>
          <ul>${prettyParams || '<li><em>none</em></li>'}</ul>
          <h2>Full URL</h2>
          <pre>${req.url}</pre>
          <p>Check your server logs (terminal) for console output too.</p>
          <p>Once you see which param contains the ID (eg. <code>profileId</code> or <code>connected</code> or <code>username</code>), tell me and I'll paste the next prompt to save it into Supabase and make the redirect permanent.</p>
        </body>
      </html>
    `;
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (err: any) {
    console.error('OAuth callback handler error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
