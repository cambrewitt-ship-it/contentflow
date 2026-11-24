import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { FONT_MIME_BY_EXT, MAX_FONT_BYTES } from '@/lib/brandKit';

export const dynamic = 'force-dynamic';

// Upload a brand font file (woff2/woff/ttf/otf) for a client's brand kit.
// The general media upload only takes images and video, so fonts get their own route.

type Params = { params: Promise<{ clientId: string }> };

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(200),
  data: z.string().min(1), // base64, no data: prefix
});

// Font files start with one of these signatures — reject anything else
function looksLikeFont(buf: Buffer, ext: string) {
  const sig = buf.subarray(0, 4).toString('latin1');
  if (ext === 'woff2') return sig === 'wOF2';
  if (ext === 'woff') return sig === 'wOFF';
  if (ext === 'otf') return sig === 'OTTO' || buf.readUInt32BE(0) === 0x00010000;
  if (ext === 'ttf') return buf.readUInt32BE(0) === 0x00010000 || sig === 'true' || sig === 'OTTO';
  return false;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid upload' }, { status: 400 });
    }

    const { filename, data } = parsed.data;
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mime = FONT_MIME_BY_EXT[ext];
    if (!mime) {
      return NextResponse.json(
        { success: false, error: 'Upload a font file: .woff2, .woff, .ttf or .otf' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > MAX_FONT_BYTES) {
      return NextResponse.json({ success: false, error: 'Font files can be up to 2MB' }, { status: 400 });
    }
    if (buffer.length < 4 || !looksLikeFont(buffer, ext)) {
      return NextResponse.json({ success: false, error: "That file doesn't look like a font" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `brand-kits/${clientId}/fonts/${Date.now()}-${safeName}`;
    const { error } = await admin.storage
      .from('media')
      .upload(storagePath, buffer, { contentType: mime, upsert: false });

    if (error) {
      logger.error('Brand font upload failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to upload font' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(storagePath);
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    logger.error('POST brand font error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
