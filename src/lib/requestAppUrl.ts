import type { NextRequest } from 'next/server';

/**
 * Base URL of the domain the user is actually on for this request.
 *
 * OAuth redirect targets must come back to the same host the user signed in on,
 * otherwise the session cookie isn't sent and middleware bounces them to login
 * (e.g. NEXT_PUBLIC_APP_URL=https://example.com while the user is on www.example.com).
 * NEXT_PUBLIC_APP_URL is only a fallback when the request carries no host.
 */
export function getRequestAppUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');

  if (host && host.includes('localhost')) {
    return `http://${host}`;
  }

  if (host) {
    const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https';
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}
