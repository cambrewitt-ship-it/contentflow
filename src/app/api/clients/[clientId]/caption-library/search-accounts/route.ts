import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { accountSearchConfigured, searchInstagramAccounts } from '@/lib/captionAccountSearch';

export const dynamic = 'force-dynamic';
// Apify's search takes a few seconds (up to ~45s on a cold start)
export const maxDuration = 60;

// Instagram account search for the caption box @ menu (Apify + exact-handle check).
// GET ?q=joes coffee

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().replace(/^@+/, '');
  if (q.length < 2) {
    return NextResponse.json({ success: false, error: 'Type at least 2 characters to search.' }, { status: 400 });
  }

  try {
    const results = await searchInstagramAccounts(q);
    return NextResponse.json({ success: true, results, searchConfigured: accountSearchConfigured().search });
  } catch (error) {
    logger.error('Caption account search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Instagram search failed' },
      { status: 502 }
    );
  }
}
