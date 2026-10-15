import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { getResearchProfile } from '@/lib/competitor-research/profile';
import {
  DISCOVERY_CREDITS,
  MAX_TRACKED_ACCOUNTS,
  RESEARCH_RUN_CREDITS,
  STALE_RUN_MS,
  researchConfig,
} from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ clientId: string }> };

// Everything the Competitor Research page needs on load: the niche profile,
// tracked accounts, recent runs (without their report bodies) and which data
// sources are configured.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const admin = createSupabaseAdmin();
    const [profile, accounts, reports] = await Promise.all([
      getResearchProfile(clientId),
      admin.from('competitor_accounts').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
      admin
        .from('competitor_research_reports')
        .select('id, status, progress, accounts_analyzed, posts_analyzed, error, created_at, completed_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Runs whose function invocation died never get marked failed; do it here.
    const staleIds = (reports.data ?? [])
      .filter(r => r.status === 'running' && Date.now() - Date.parse(r.created_at) > STALE_RUN_MS)
      .map(r => r.id);
    if (staleIds.length) {
      await admin
        .from('competitor_research_reports')
        .update({ status: 'failed', progress: null, error: 'Research timed out — please try again.' })
        .in('id', staleIds);
    }

    return NextResponse.json({
      success: true,
      profile: profile.profile,
      profileSaved: profile.saved,
      accounts: accounts.data ?? [],
      reports: (reports.data ?? []).map(r =>
        staleIds.includes(r.id) ? { ...r, status: 'failed', progress: null, error: 'Research timed out — please try again.' } : r
      ),
      config: researchConfig(),
      limits: {
        maxAccounts: MAX_TRACKED_ACCOUNTS,
        researchCredits: RESEARCH_RUN_CREDITS,
        discoveryCredits: DISCOVERY_CREDITS,
      },
    });
  } catch (error) {
    logger.error('GET /api/clients/[clientId]/competitor-research error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
