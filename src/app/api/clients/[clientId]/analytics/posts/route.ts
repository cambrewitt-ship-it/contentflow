import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { getSnapshot } from '@/lib/analytics/store';
import type { AnalyticsPost } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Results for posts published through the app, by Zernio post id (late_post_id),
// for the calendar. ?ids=a,b,c — returns { results: { [latePostId]: AnalyticsPost[] } }
// (one entry per platform), plus the client's median engagement for comparison.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const ids = new Set(
    (request.nextUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200)
  );

  try {
    const snapshot = await getSnapshot(createSupabaseAdmin(), clientId);
    if (snapshot === 'missing_table') return NextResponse.json({ success: true, results: {}, medianEngagementRate: null });

    const results: Record<string, AnalyticsPost[]> = {};
    for (const post of snapshot.posts) {
      if (!post.latePostId || (ids.size && !ids.has(post.latePostId))) continue;
      (results[post.latePostId] ??= []).push(post);
    }
    return NextResponse.json({
      success: true,
      results,
      medianEngagementRate: snapshot.insights?.baseline.medianEngagementRate ?? null,
      syncedAt: snapshot.syncedAt,
    });
  } catch (error) {
    logger.error('GET analytics posts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load post results' }, { status: 500 });
  }
}
