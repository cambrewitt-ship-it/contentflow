import { NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { uuidSchema } from '@/lib/validators';
import { TARGET_PLATFORM_IDS } from '@/lib/targetPlatforms';
import { checkIngestAuth, checkIngestClient } from '@/lib/ingestAuth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  client_id: uuidSchema,
  caption: z.string().max(5000),
  media_urls: z.array(z.string().url()).min(1).max(20),
  target_platforms: z.array(z.enum(TARGET_PLATFORM_IDS)).max(TARGET_PLATFORM_IDS.length).optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  post_notes: z.string().max(4000).nullable().optional(),
  ai_reasoning: z.string().max(5000).nullable().optional(),
  // Stable id from the sender (e.g. "oneonethree-content/posts/110.json.md"),
  // so a retried push returns the existing post instead of duplicating it.
  external_id: z.string().min(1).max(200).regex(/^[A-Za-z0-9._\/-]+$/),
});

// Inserts one post into the calendar for an allowed client. Nothing is
// published: the post lands in calendar_scheduled_posts for a human to review
// and post from ContentFlow, exactly like a post scheduled by hand.
export async function POST(req: Request) {
  const authError = checkIngestAuth(req);
  if (authError) return authError;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const issues = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) : undefined;
    return NextResponse.json({ error: 'Invalid request body', issues }, { status: 400 });
  }

  const clientError = checkIngestClient(body.client_id);
  if (clientError) return clientError;

  // Only accept media this app's own ingest upload produced.
  const mediaPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/uploads/ingest/${body.client_id}/`;
  if (!body.media_urls.every((url) => url.startsWith(mediaPrefix))) {
    return NextResponse.json({ error: 'media_urls must come from /api/ingest/media' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const marker = `[ingest:${body.external_id}]`;

  const { data: existing, error: lookupError } = await supabase
    .from('calendar_scheduled_posts')
    .select('id')
    .eq('client_id', body.client_id)
    .like('post_notes', `%${marker}%`)
    .limit(1);
  if (lookupError) {
    logger.error('Ingest duplicate check failed', { error: lookupError.message });
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (existing && existing.length > 0) {
    return NextResponse.json({ id: existing[0].id, duplicate: true });
  }

  const { data: inserted, error } = await supabase
    .from('calendar_scheduled_posts')
    .insert({
      client_id: body.client_id,
      caption: body.caption,
      image_url: body.media_urls[0],
      media_urls: body.media_urls,
      target_platforms: body.target_platforms ?? null,
      scheduled_date: body.scheduled_date ?? null,
      scheduled_time: body.scheduled_time ?? null,
      post_notes: `${marker} ${body.post_notes ?? ''}`.trim(),
      ai_reasoning: body.ai_reasoning ?? null,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    logger.error('Ingest insert failed', { error: error?.message });
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, duplicate: false }, { status: 201 });
}
