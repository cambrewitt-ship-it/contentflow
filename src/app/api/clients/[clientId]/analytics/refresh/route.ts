import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { generateRecommendations, readSnapshot, refreshSnapshot } from '@/lib/analytics/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// "Refresh" on the Analytics page: re-read results from Zernio now and, when asked,
// write fresh recommendations. Throttled so it can't hammer Zernio or the AI.

type Params = { params: Promise<{ clientId: string }> };
const MIN_SYNC_GAP_MS = 10 * 60 * 1000;
const MIN_RECOMMENDATION_GAP_MS = 6 * 60 * 60 * 1000;

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const admin = createSupabaseAdmin();
    const current = await readSnapshot(admin, clientId);
    if (current === 'missing_table') {
      return NextResponse.json({ success: false, error: 'Analytics needs migrations/034-client-analytics.sql' }, { status: 503 });
    }

    if (!current?.syncedAt || Date.now() - Date.parse(current.syncedAt) > MIN_SYNC_GAP_MS) {
      await refreshSnapshot(admin, clientId);
    }

    let recommendationsRefreshed = false;
    if (body?.recommendations) {
      const latest = await readSnapshot(admin, clientId);
      const at = latest && latest !== 'missing_table' ? latest.recommendationsAt : null;
      if (!at || Date.now() - Date.parse(at) > MIN_RECOMMENDATION_GAP_MS) {
        recommendationsRefreshed = !!(await generateRecommendations(admin, clientId));
      }
    }
    return NextResponse.json({ success: true, recommendationsRefreshed });
  } catch (error) {
    logger.error('POST analytics refresh error:', error);
    return NextResponse.json({ success: false, error: 'Failed to refresh analytics' }, { status: 500 });
  }
}
