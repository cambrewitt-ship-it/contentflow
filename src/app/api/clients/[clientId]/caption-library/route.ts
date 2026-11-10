import { NextRequest, NextResponse, after } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { captionLibrarySchema, normalizeHandle } from '@/lib/captionLibrary';
import {
  CAPTION_LIBRARY_SETUP_MESSAGE,
  getCaptionLibraryForClient,
  isMissingTable,
  saveCaptionLibrary,
  syncExternalCaptionUsage,
} from '@/lib/captionLibraryServer';

export const dynamic = 'force-dynamic';
// The daily Zernio import runs after the response and can page through a year of posts
export const maxDuration = 120;

// The client's caption library (accounts to @tag, hashtag sets) plus the @handles and
// #hashtags from their past captions, for the caption box autocomplete. Handles from
// past captions are saved as accounts automatically.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  try {
    const admin = createSupabaseAdmin();
    const { response, needsExternalSync } = await getCaptionLibraryForClient(admin, clientId);
    // Once a day, read the client's Instagram posts made outside the app from Zernio.
    // Results show up on the next load.
    if (needsExternalSync) after(() => syncExternalCaptionUsage(admin, clientId));
    return NextResponse.json({ success: true, ...response });
  } catch (error) {
    logger.error('GET caption library error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load accounts and hashtags' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const parsed = captionLibrarySchema.safeParse(body?.library);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid accounts or hashtags' },
        { status: 400 }
      );
    }
    // Handles of accounts deleted in the manager, so auto-import doesn't add them back
    const removedHandles = Array.isArray(body?.removedHandles)
      ? (body.removedHandles as unknown[])
          .filter((h): h is string => typeof h === 'string')
          .map(normalizeHandle)
          .filter(Boolean)
          .slice(0, 1000)
      : [];

    const admin = createSupabaseAdmin();
    const { error } = await saveCaptionLibrary(admin, clientId, auth.user.id, parsed.data, removedHandles);

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ success: false, error: CAPTION_LIBRARY_SETUP_MESSAGE }, { status: 503 });
      }
      logger.error('PUT caption library error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save accounts and hashtags' }, { status: 500 });
    }
    return NextResponse.json({ success: true, library: parsed.data });
  } catch (error) {
    logger.error('PUT /api/clients/[clientId]/caption-library error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
