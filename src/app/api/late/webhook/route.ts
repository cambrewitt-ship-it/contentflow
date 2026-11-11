import { NextRequest, NextResponse, after } from 'next/server';
import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyWebhookSignature } from '@/lib/zernio/webhook';
import { autoModerate, getFeedAgentSettings, ingestCommentEvent, syncAdThread, triageComments } from '@/lib/comments/store';

export const dynamic = 'force-dynamic';

// Zernio (LATE) webhooks. Signed with a secret derived from LATE_API_KEY (see
// src/lib/zernio/webhook.ts); answered within Zernio's 5 seconds, with the work
// (AI triage, Feed Checker moderation) done after the response.

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get('x-zernio-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = String(event.event ?? request.headers.get('x-zernio-event') ?? '');
  if (name === 'webhook.test' || event.test === true) return NextResponse.json({ ok: true });

  const admin = createSupabaseAdmin();
  const eventId = String(event.id ?? request.headers.get('x-zernio-event-id') ?? '');
  if (eventId) {
    const { error } = await admin.from('zernio_webhook_events').insert({ id: eventId, event: name });
    if (error?.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
  }

  if (name === 'comment.received') {
    try {
      const ingested = await ingestCommentEvent(admin, event);
      if (ingested) {
        const { clientId, adPost } = ingested;
        after(async () => {
          try {
            // A comment on an ad: read the ad's whole thread too (older comments included)
            if (adPost) await syncAdThread(admin, clientId, adPost).catch((err) => logger.warn('Ad thread backfill failed', { err: String(err) }));
            await triageComments(admin, clientId);
            await autoModerate(admin, clientId, await getFeedAgentSettings(admin, clientId));
          } catch (err) {
            logger.error('Webhook comment follow-up failed:', err);
          }
        });
      }
    } catch (err) {
      logger.error('Webhook comment ingest failed:', err);
      // 2xx anyway: a retry would hit the same problem; the daily sync backfills
    }
  }
  return NextResponse.json({ ok: true });
}
