import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { uuidSchema } from '@/lib/validators';
import { checkIngestAuth, checkIngestClient } from '@/lib/ingestAuth';

export const dynamic = 'force-dynamic';

const MEDIA_BUCKET = 'media';
const MAX_BYTES = 3 * 1024 * 1024; // keeps the base64 body under Vercel's 4.5MB request limit

const CONTENT_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const;

const bodySchema = z.object({
  client_id: uuidSchema,
  content_type: z.enum(['image/png', 'image/jpeg']),
  data_base64: z.string().min(1),
  filename: z
    .string()
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
});

// Uploads one image for a post that /api/ingest/scheduled-posts will insert,
// and returns its public URL. One image per request keeps each body small.
export async function POST(req: Request) {
  const authError = checkIngestAuth(req);
  if (authError) return authError;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const clientError = checkIngestClient(body.client_id);
  if (clientError) return clientError;

  const buffer = Buffer.from(body.data_base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: `Image must be between 1 byte and ${MAX_BYTES} bytes` }, { status: 413 });
  }

  const ext = CONTENT_TYPES[body.content_type];
  const base = (body.filename || 'image').replace(/\.[A-Za-z0-9]+$/, '');
  const storagePath = `uploads/ingest/${body.client_id}/${randomUUID()}-${base}.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType: body.content_type,
    upsert: false,
  });
  if (error) {
    logger.error('Ingest media upload failed', { error: error.message });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: data.publicUrl });
}
