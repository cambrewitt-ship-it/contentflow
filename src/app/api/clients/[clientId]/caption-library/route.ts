import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { captionLibrarySchema, countUsage, type CaptionLibraryResponse } from '@/lib/captionLibrary';
import {
  CAPTION_LIBRARY_SETUP_MESSAGE,
  isMissingTable,
  loadCaptionLibrary,
} from '@/lib/captionLibraryServer';

export const dynamic = 'force-dynamic';

// The client's caption library (accounts to @tag, hashtag sets) plus the @handles and
// #hashtags from their past captions, for the caption box autocomplete.

type Params = { params: Promise<{ clientId: string }> };

// How many recent captions to scan for handles and hashtags
const HISTORY_LIMIT = 500;

async function recentCaptions(admin: ReturnType<typeof createSupabaseAdmin>, clientId: string): Promise<string[]> {
  const tables = ['calendar_scheduled_posts', 'calendar_unscheduled_posts'] as const;
  const results = await Promise.all(
    tables.map((table) =>
      admin
        .from(table)
        .select('caption')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
    )
  );
  const captions: string[] = [];
  results.forEach(({ data, error }, i) => {
    if (error) {
      logger.error(`Caption history read failed (${tables[i]}):`, error);
      return;
    }
    for (const row of data ?? []) {
      if (typeof row.caption === 'string' && row.caption) captions.push(row.caption);
    }
  });
  return captions;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const admin = createSupabaseAdmin();
  const [{ library, missingTable }, captions] = await Promise.all([
    loadCaptionLibrary(admin, clientId),
    recentCaptions(admin, clientId),
  ]);
  const { usedHandles, usedHashtags } = countUsage(captions);

  const body: CaptionLibraryResponse & { success: true } = {
    success: true,
    ...library,
    usedHandles: usedHandles.slice(0, 300),
    usedHashtags: usedHashtags.slice(0, 300),
    ...(missingTable ? { setupRequired: CAPTION_LIBRARY_SETUP_MESSAGE } : {}),
  };
  return NextResponse.json(body);
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

    const admin = createSupabaseAdmin();
    const { error } = await admin.from('client_caption_libraries').upsert({
      client_id: clientId,
      accounts: parsed.data.accounts,
      hashtag_sets: parsed.data.hashtagSets,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    });

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
