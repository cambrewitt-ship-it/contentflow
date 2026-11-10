import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { fetchDashboard, ZernioAnalyticsError } from '@/lib/analytics/zernio';
import {
  ANALYTICS_SETUP_MESSAGE,
  RECOMMENDATIONS_STALE_MS,
  generateRecommendations,
  getSnapshot,
  isStale,
  runAfterResponse,
} from '@/lib/analytics/store';
import type { AnalyticsDashboard, ClientAnalyticsResponse } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
// A first visit reads up to a year of posts from Zernio before responding
export const maxDuration = 120;

// The client's Analytics page: totals and daily series for the chosen range (live from
// Zernio), plus the stored snapshot's insights, recommendations and recent post results.

type Params = { params: Promise<{ clientId: string }> };
const RANGES = new Set([7, 30, 90, 365]);

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const rangeParam = Number(request.nextUrl.searchParams.get('range'));
  const range = RANGES.has(rangeParam) ? rangeParam : 30;

  try {
    const admin = createSupabaseAdmin();
    const snapshot = await getSnapshot(admin, clientId);
    if (snapshot === 'missing_table') {
      const body: ClientAnalyticsResponse = {
        status: 'setup_required',
        message: ANALYTICS_SETUP_MESSAGE,
        range,
        dashboard: null,
        insights: null,
        recommendations: [],
        recommendationsAt: null,
        syncedAt: null,
        recentPosts: [],
      };
      return NextResponse.json({ success: true, ...body });
    }

    let dashboard: AnalyticsDashboard | null = null;
    let status = snapshot.status;
    let message = snapshot.message ?? undefined;
    if (status !== 'not_connected') {
      const { data: client } = await admin.from('clients').select('late_profile_id').eq('id', clientId).maybeSingle();
      if (client?.late_profile_id) {
        try {
          dashboard = await fetchDashboard(client.late_profile_id, range);
        } catch (err) {
          if (err instanceof ZernioAnalyticsError && err.unavailable) {
            status = 'unavailable';
            message = "The Zernio plan doesn't include analytics.";
          } else {
            logger.error('Analytics dashboard fetch failed:', err);
          }
        }
      }
    }

    // Proactive: new recommendations weekly, generated after the response
    if (snapshot.insights && snapshot.insights.postCount >= 5 && isStale(snapshot.recommendationsAt, RECOMMENDATIONS_STALE_MS)) {
      runAfterResponse(() => generateRecommendations(createSupabaseAdmin(), clientId));
    }

    const body: ClientAnalyticsResponse = {
      status,
      ...(message ? { message } : {}),
      range,
      dashboard,
      insights: snapshot.insights,
      recommendations: snapshot.recommendations,
      recommendationsAt: snapshot.recommendationsAt,
      syncedAt: snapshot.syncedAt,
      recentPosts: snapshot.posts.slice(0, 40),
    };
    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    logger.error('GET client analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load analytics' }, { status: 500 });
  }
}
