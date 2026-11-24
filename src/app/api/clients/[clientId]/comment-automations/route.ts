import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { createAutomation, listAccounts, listAutomations, ZernioError } from '@/lib/zernio/api';

export const dynamic = 'force-dynamic';

// Keyword auto-DMs (Zernio comment-to-DM automations) for a client: when someone comments
// a keyword on Instagram or Facebook, they get a DM (and optionally a public reply).

type Params = { params: Promise<{ clientId: string }> };

async function profileFor(clientId: string): Promise<string | null> {
  const { data } = await createSupabaseAdmin().from('clients').select('late_profile_id').eq('id', clientId).maybeSingle();
  return (data?.late_profile_id as string) ?? null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const profileId = await profileFor(clientId);
  if (!profileId) return NextResponse.json({ success: true, automations: [], accounts: [] });
  try {
    const [automations, accounts] = await Promise.all([listAutomations(profileId), listAccounts(profileId)]);
    return NextResponse.json({
      success: true,
      automations: automations.map((a) => ({ ...a, id: a.id ?? a._id })),
      accounts: accounts
        .filter((a) => a.platform === 'instagram' || a.platform === 'facebook')
        .map((a) => ({ id: a._id, platform: a.platform, username: a.username ?? a.displayName ?? a.platform })),
    });
  } catch (error) {
    logger.error('GET automations error:', error);
    return NextResponse.json({ success: false, error: "Couldn't load auto-DMs from Zernio" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const profileId = await profileFor(clientId);
  if (!profileId) return NextResponse.json({ success: false, error: 'Connect a social account first' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const keywords = Array.isArray(body?.keywords)
    ? (body.keywords as unknown[]).filter((k): k is string => typeof k === 'string' && !!k.trim()).map((k) => k.trim().slice(0, 50)).slice(0, 20)
    : [];
  const dmMessage = typeof body?.dmMessage === 'string' ? body.dmMessage.trim().slice(0, 1000) : '';
  const accountId = typeof body?.accountId === 'string' ? body.accountId : '';
  if (!accountId || !dmMessage || !keywords.length) {
    return NextResponse.json({ success: false, error: 'Pick an account, add at least one keyword and write the DM' }, { status: 400 });
  }
  const accounts = await listAccounts(profileId);
  if (!accounts.some((a) => a._id === accountId)) return NextResponse.json({ success: false, error: 'Unknown account' }, { status: 400 });

  try {
    const res = await createAutomation({
      profileId,
      accountId,
      trigger: 'comment',
      name: (typeof body?.name === 'string' && body.name.trim()) || `Keyword: ${keywords.join(', ')}`.slice(0, 80),
      keywords,
      matchMode: 'word',
      typoTolerance: true,
      dmMessage,
      ...(typeof body?.commentReply === 'string' && body.commentReply.trim() ? { commentReply: body.commentReply.trim().slice(0, 500) } : {}),
      ...(typeof body?.platformPostId === 'string' && body.platformPostId ? { platformPostId: body.platformPostId } : {}),
    });
    return NextResponse.json({ success: true, automation: res.automation ?? res });
  } catch (error) {
    if (error instanceof ZernioError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    logger.error('POST automation error:', error);
    return NextResponse.json({ success: false, error: 'Could not create the auto-DM' }, { status: 500 });
  }
}
