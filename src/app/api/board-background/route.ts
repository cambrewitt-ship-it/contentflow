import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { isValidBoardBackground } from '@/lib/boardBackgrounds';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
// The board shrinks photos in the browser before upload, so this is a generous ceiling.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const BUCKET = 'client-logos';

/**
 * Set the Board view background for a client — a preset id, or a photo uploaded here.
 *
 * Saved in clients.portal_settings.board_background, so the agency's calendar board and the
 * client portal board show the same one. Auth is either a portal token (`token`) or the
 * agency's Bearer session plus `clientId`.
 *
 * Body: { token? | clientId?, background? } to pick a preset, or { ..., imageData, filename }
 * (a data: URL) to upload a photo and use it.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, clientId: bodyClientId, background, imageData, filename } = await request.json();

    let clientId: string;
    if (token) {
      const resolved = await resolvePortalToken(token);
      if (!resolved) return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      clientId = resolved.clientId;
    } else if (typeof bodyClientId === 'string' && bodyClientId) {
      const auth = await requireClientOwnership(request, bodyClientId);
      if (auth.error) return auth.error;
      clientId = bodyClientId;
    } else {
      return NextResponse.json({ error: 'Portal token or clientId is required' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    let value: string;

    if (imageData) {
      const mimeType = typeof imageData === 'string' ? imageData.match(/^data:([^;]+);base64,/)?.[1] : undefined;
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: 'Please upload a JPG, PNG or WebP image' }, { status: 400 });
      }
      const buffer = Buffer.from(imageData.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'That image is too large (max 4MB)' }, { status: 400 });
      }

      const safeName = String(filename || 'background').replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `board-backgrounds/${clientId}-${Date.now()}-${safeName}`;
      const { error: storageError } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
      if (storageError) {
        logger.error('❌ Board background upload failed:', storageError);
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }
      value = admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    } else if (isValidBoardBackground(background)) {
      value = background;
    } else {
      return NextResponse.json({ error: 'Invalid background' }, { status: 400 });
    }

    const { data: current, error: readError } = await admin
      .from('clients')
      .select('portal_settings')
      .eq('id', clientId)
      .single();
    if (readError) {
      logger.error('❌ Failed to read portal settings:', readError);
      return NextResponse.json({ error: 'Failed to save background' }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from('clients')
      .update({
        portal_settings: {
          ...((current?.portal_settings as Record<string, unknown> | null) ?? {}),
          board_background: value,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);
    if (updateError) {
      logger.error('❌ Failed to save board background:', updateError);
      return NextResponse.json({ error: 'Failed to save background' }, { status: 500 });
    }

    return NextResponse.json({ success: true, background: value });
  } catch (error) {
    logger.error('❌ Board background error:', error);
    return NextResponse.json({ error: 'Failed to save background' }, { status: 500 });
  }
}
