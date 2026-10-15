import { NextRequest, NextResponse, after } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { getResearchProfile } from '@/lib/competitor-research/profile';
import {
  DISCOVERY_CREDITS,
  MAX_TRACKED_ACCOUNTS,
  RESEARCH_RUN_CREDITS,
  RETENTION_DAYS,
  isStaleRun,
  processDueQueuedRuns,
  researchConfig,
} from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Page visits also start queued runs that are due (any client's), via after()
export const maxDuration = 300;

type Params = { params: Promise<{ clientId: string }> };

const TIMED_OUT = 'Research timed out — please try again.';

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
        .select('id, status, progress, accounts_analyzed, posts_analyzed, error, queued_until, started_at, created_at, completed_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Runs whose function invocation died never get marked failed; do it here.
    const staleIds = (reports.data ?? []).filter(isStaleRun).map(r => r.id);
    if (staleIds.length) {
      await admin
        .from('competitor_research_reports')
        .update({ status: 'failed', progress: null, error: TIMED_OUT })
        .in('id', staleIds);
    }

    // Queued runs only start when something triggers them; a page visit is
    // one of those triggers (this client's first, then anyone's).
    if ((reports.data ?? []).some(r => r.status === 'queued')) {
      after(() => processDueQueuedRuns({ clientId, limit: 1 }));
    } else {
      after(() => processDueQueuedRuns({ limit: 1 }));
    }

    return NextResponse.json({
      success: true,
      profile: profile.profile,
      profileSaved: profile.saved,
      accounts: accounts.data ?? [],
      reports: (reports.data ?? []).map(r =>
        staleIds.includes(r.id) ? { ...r, status: 'failed', progress: null, error: TIMED_OUT } : r
      ),
      config: researchConfig(),
      limits: {
        maxAccounts: MAX_TRACKED_ACCOUNTS,
        researchCredits: RESEARCH_RUN_CREDITS,
        discoveryCredits: DISCOVERY_CREDITS,
        retentionDays: RETENTION_DAYS,
      },
    });
  } catch (error) {
    logger.error('GET /api/clients/[clientId]/competitor-research error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
