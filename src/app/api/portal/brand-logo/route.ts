import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
// Max logo size: 5MB (decoded)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Upload a brand logo from the client portal.
 *
 * Auth is the portal token (party or legacy client token) — same model as the
 * other /api/portal/* routes. The file lands in the shared `client-logos`
 * bucket. If the client has no logo_url yet, the uploaded logo becomes it, so
 * it shows in the portal top bar on every device — an existing client logo is
 * never overwritten from here.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, imageData, filename } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Portal token is required' }, { status: 400 });
    }
    if (!imageData || !filename) {
      return NextResponse.json({ error: 'Image data and filename are required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const mimeType = imageData.match(/^data:([^;]+);base64,/)?.[1];
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid image type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Logo too large: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB. Maximum is 5MB.` },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${resolved.clientId}-${Date.now()}-${safeName}`;

    const { error: storageError } = await admin.storage
      .from('client-logos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (storageError) {
      logger.error('❌ Portal logo upload failed:', storageError);
      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('client-logos').getPublicUrl(storagePath);

    // Only adopt this as the client logo when there isn't one already.
    const { data: existing } = await admin
      .from('clients')
      .select('logo_url')
      .eq('id', resolved.clientId)
      .single();

    const existingLogo = existing?.logo_url?.trim() || null;
    let clientLogoUrl = existingLogo;

    if (!existingLogo) {
      const { error: updateError } = await admin
        .from('clients')
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', resolved.clientId);

      if (updateError) {
        // The file uploaded fine — hand back the URL so the portal can still use it.
        logger.error('❌ Failed to save portal logo URL to client:', updateError);
      } else {
        clientLogoUrl = publicUrl;
      }
    }

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl,
      clientLogoUrl,
      adoptedAsClientLogo: clientLogoUrl === publicUrl,
    });
  } catch (error) {
    logger.error('❌ Portal brand logo error:', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
