import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Machine-to-machine auth for /api/ingest/*: scheduled drafting agents (cloud
// routines with no browser session) push finished posts into the calendar
// with one bearer token, instead of ever holding the Supabase service key.
// The token can only reach the clients listed in INGEST_ALLOWED_CLIENT_IDS.
//
//   INGEST_API_TOKEN=<long random string>
//   INGEST_ALLOWED_CLIENT_IDS=<client uuid>[,<client uuid>...]

export function allowedIngestClientIds(): Set<string> {
  return new Set(
    (process.env.INGEST_ALLOWED_CLIENT_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/** Returns an error response when the request isn't authorised, else null. */
export function checkIngestAuth(req: Request): NextResponse | null {
  const expected = process.env.INGEST_API_TOKEN;
  if (!expected || expected.length < 32) {
    return NextResponse.json({ error: 'Ingest is not configured' }, { status: 503 });
  }
  const header = req.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function checkIngestClient(clientId: string): NextResponse | null {
  if (!allowedIngestClientIds().has(clientId)) {
    return NextResponse.json({ error: 'Client not allowed for ingest' }, { status: 403 });
  }
  return null;
}
