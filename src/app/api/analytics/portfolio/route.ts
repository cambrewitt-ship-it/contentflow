import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { isStale, readSnapshot, refreshSnapshot, runAfterResponse, type AnalyticsSnapshot } from '@/lib/analytics/store';
import type { PortfolioClient } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The agency overview: for each of the user's clients, how their accounts are doing
// and what needs attention — from the stored analytics snapshots (never one Zernio
// call per client inline) plus the calendar. Stale snapshots refresh after the response.

// Snapshots refreshed per request, so a big agency doesn't hit Zernio all at once
const MAX_BACKGROUND_REFRESHES = 4;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const admin = createSupabaseAdmin();
    const { data: clients, error } = await admin
      .from('clients')
      .select('id, late_profile_id, autopilot_enabled, autopilot_settings, posting_preferences')
      .eq('user_id', auth.user.id);
    if (error) throw error;
    const ids = (clients ?? []).map((c) => c.id as string);
    if (!ids.length) return NextResponse.json({ success: true, clients: [] });

    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86_400_000);
    const [{ data: upcoming }, snapshots] = await Promise.all([
      admin
        .from('calendar_scheduled_posts')
        .select('client_id, approval_status')
        .in('client_id', ids)
        .gte('scheduled_date', ymd(today))
        .lte('scheduled_date', ymd(in7)),
      Promise.all(ids.map((id) => readSnapshot(admin, id).catch(() => null))),
    ]);

    const scheduled = new Map<string, number>();
    const awaiting = new Map<string, number>();
    for (const row of upcoming ?? []) {
      const id = row.client_id as string;
      scheduled.set(id, (scheduled.get(id) ?? 0) + 1);
      if (row.approval_status === 'pending' || row.approval_status === 'needs_attention') {
        awaiting.set(id, (awaiting.get(id) ?? 0) + 1);
      }
    }

    let refreshes = 0;
    const result: PortfolioClient[] = (clients ?? []).map((client, n) => {
      const id = client.id as string;
      const raw = snapshots[n];
      const snapshot: AnalyticsSnapshot | null = raw && raw !== 'missing_table' ? raw : null;
      const connected = !!client.late_profile_id;

      if (raw !== 'missing_table' && connected && (!snapshot || isStale(snapshot.syncedAt)) && refreshes < MAX_BACKGROUND_REFRESHES) {
        refreshes++;
        runAfterResponse(() => refreshSnapshot(createSupabaseAdmin(), id));
      }

      const i = snapshot?.insights ?? null;
      const recent = i?.trend.recent ?? null;
      const previous = i?.trend.previous ?? null;
      const engagementChange =
        recent && previous && recent.posts >= 3 && previous.posts >= 3 && previous.medianEngagementRate
          ? recent.medianEngagementRate / previous.medianEngagementRate - 1
          : null;

      const attention: PortfolioClient['attention'] = [];
      const next7 = scheduled.get(id) ?? 0;
      if (!connected) attention.push({ level: 'critical', text: 'No social accounts connected' });
      else if (next7 === 0) attention.push({ level: 'critical', text: 'Nothing scheduled for the next 7 days' });
      else {
        const target = Number((client.posting_preferences as Record<string, unknown> | null)?.posts_per_week) || 0;
        if (target && next7 < target) {
          attention.push({ level: 'warning', text: `Only ${next7} of ${target} posts scheduled for the next 7 days` });
        }
      }
      const waiting = awaiting.get(id) ?? 0;
      if (waiting > 0) attention.push({ level: 'warning', text: `${waiting} post${waiting === 1 ? '' : 's'} awaiting approval` });
      if (engagementChange !== null && engagementChange <= -0.2) {
        attention.push({ level: 'warning', text: `Engagement down ${Math.round(-engagementChange * 100)}% this month` });
      }
      if (recent && previous && previous.posts >= 4 && recent.posts < previous.posts * 0.6) {
        attention.push({ level: 'warning', text: `Posting slowed (${recent.posts} vs ${previous.posts} posts)` });
      }
      if (snapshot?.status === 'failed') attention.push({ level: 'warning', text: "Couldn't read latest results" });

      return {
        clientId: id,
        status: snapshot ? snapshot.status : connected ? 'pending' : 'not_connected',
        followers: i?.followers ?? null,
        last30: recent,
        engagementChange,
        scheduledNext7: next7,
        awaitingApproval: waiting,
        topRecommendation: snapshot?.recommendations[0]?.title ?? null,
        autoFill: client.autopilot_enabled === true && (client.autopilot_settings as Record<string, unknown> | null)?.fill_gaps === true,
        attention,
      };
    });

    return NextResponse.json({ success: true, clients: result });
  } catch (error) {
    logger.error('GET analytics portfolio error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load overview' }, { status: 500 });
  }
}
