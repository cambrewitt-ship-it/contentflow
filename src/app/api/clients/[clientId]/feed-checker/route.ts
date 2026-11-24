import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { listFeedChecks, runFeedChecker } from '@/lib/feedChecker/check';
import { listComments } from '@/lib/comments/store';
import { normalizeFeedAgentSettings } from '@/lib/comments/types';

export const dynamic = 'force-dynamic';
// "Run now" checks posts with AI and syncs comments
export const maxDuration = 300;

// The Feed Checker for one client. GET: settings, last run, open findings and recent
// automatic comment actions. PUT { settings }: save settings. POST: run it now.

type Params = { params: Promise<{ clientId: string }> };
const SETUP = 'The Feed Checker needs a one-off database update (migrations/036-comments-and-feed-checker.sql).';

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const view = request.nextUrl.searchParams.get('view') === 'all' ? 'all' : 'open';
  try {
    const admin = createSupabaseAdmin();
    const [{ data: client, error }, checks, autoActions] = await Promise.all([
      admin.from('clients').select('feed_agent_settings, feed_agent_last_run').eq('id', clientId).maybeSingle(),
      listFeedChecks(admin, clientId, view),
      listComments(admin, clientId, { view: 'auto', limit: 30 }),
    ]);
    if (error?.code === '42703' || checks === 'missing_table') {
      return NextResponse.json({ success: true, setupRequired: SETUP, settings: normalizeFeedAgentSettings({}), checks: [], autoActions: [] });
    }
    const lastRun = (client?.feed_agent_last_run as Record<string, unknown> | null)?.summary ?? null;
    return NextResponse.json({
      success: true,
      settings: normalizeFeedAgentSettings(client?.feed_agent_settings),
      lastRun,
      checks,
      autoActions: autoActions === 'missing_table' ? [] : autoActions,
    });
  } catch (error) {
    logger.error('GET feed checker error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the Feed Checker' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const settings = normalizeFeedAgentSettings(body?.settings);
  const { error } = await createSupabaseAdmin().from('clients').update({ feed_agent_settings: settings }).eq('id', clientId);
  if (error) {
    if (error.code === '42703') return NextResponse.json({ success: false, error: SETUP }, { status: 503 });
    logger.error('PUT feed checker settings error:', error);
    return NextResponse.json({ success: false, error: 'Could not save settings' }, { status: 500 });
  }
  return NextResponse.json({ success: true, settings });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  try {
    const admin = createSupabaseAdmin();
    // A manual run checks posts even when automatic runs are off; moderation follows the settings
    const summary = await runFeedChecker(admin, clientId, { force: true, notify: false });
    if (!summary) return NextResponse.json({ success: false, error: 'Connect a social account first' }, { status: 400 });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    logger.error('POST feed checker run error:', error);
    return NextResponse.json({ success: false, error: 'The check didn’t finish — try again' }, { status: 500 });
  }
}
