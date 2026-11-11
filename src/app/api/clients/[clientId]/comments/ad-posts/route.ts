import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { getPostComments, listAccounts } from '@/lib/zernio/api';
import { adPostIdCandidates, isMissingTable, syncAdThread, trackAdPost, triageComments } from '@/lib/comments/store';
import { ensureZernioWebhook, webhookStatus } from '@/lib/zernio/webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Ad posts (dark posts) whose comments the inbox follows. Found automatically when an ad
// comment arrives through the webhook; this route lists them and adds one by hand from a
// pasted Facebook post link/id or Instagram media id. Body: { link, platform }.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const admin = createSupabaseAdmin();
  const [{ data, error }, live] = await Promise.all([
    admin
      .from('client_ad_posts')
      .select('id, platform, post_id, ad_title, post_text, post_url, source, last_comment_at')
      .eq('client_id', clientId)
      .order('last_comment_at', { ascending: false })
      .limit(50),
    // Not on yet? Switch it on now (one-time, app-wide) and report the result
    webhookStatus().then(async (status) => {
      if (status !== 'off') return status;
      const result = await ensureZernioWebhook();
      return result === 'skipped' ? status : 'on';
    }),
  ]);
  if (error && isMissingTable(error)) {
    return NextResponse.json({ success: true, adPosts: [], liveAlerts: live, setupRequired: 'Ad comments need migrations/037-ad-comments.sql.' });
  }
  return NextResponse.json({ success: true, adPosts: data ?? [], liveAlerts: live });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const link = typeof body?.link === 'string' ? body.link.trim().slice(0, 500) : '';
  const platform = body?.platform === 'instagram' ? 'instagram' : 'facebook';
  if (!link) return NextResponse.json({ success: false, error: 'Paste the ad post link or ID' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: client } = await admin.from('clients').select('late_profile_id').eq('id', clientId).maybeSingle();
  if (!client?.late_profile_id) return NextResponse.json({ success: false, error: 'Connect the Page first' }, { status: 400 });

  try {
    const accounts = (await listAccounts(client.late_profile_id)).filter((a) => a.platform === platform);
    if (!accounts.length) return NextResponse.json({ success: false, error: `No ${platform} account connected for this client` }, { status: 400 });

    // Page ids seen on this client's Facebook comments ("{pageId}_{postId}"), to complete a bare post id
    const { data: seen } = await admin.from('client_comments').select('platform_post_id').eq('client_id', clientId).eq('platform', 'facebook').limit(200);
    const pageIds = Array.from(new Set((seen ?? []).map((r) => String(r.platform_post_id).split('_')[0]).filter((p) => /^\d+$/.test(p))));
    const candidates = platform === 'instagram' ? (/^\d{8,}$/.test(link) ? [link] : []) : adPostIdCandidates(link, pageIds);
    if (!candidates.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            platform === 'instagram'
              ? 'Paste the Instagram media ID (a long number). Instagram ad comments are also picked up automatically.'
              : 'That doesn’t look like a Facebook post link or ID. Use the post ID (e.g. 1234567890_9876543210) or a link with numbers in it.',
        },
        { status: 400 }
      );
    }

    for (const postId of candidates.slice(0, 6)) {
      for (const account of accounts) {
        try {
          const { comments, post } = await getPostComments(postId, account._id, 5);
          const ref = {
            platform,
            accountId: account._id,
            postId,
            postText: post?.message ?? post?.text ?? null,
            postUrl: post?.permalink ?? null,
            postThumbnail: post?.thumbnailUrl ?? null,
          };
          await trackAdPost(admin, clientId, ref, 'manual');
          const synced = comments.length ? await syncAdThread(admin, clientId, ref) : 0;
          await triageComments(admin, clientId);
          return NextResponse.json({ success: true, postId, synced });
        } catch {
          // Not this id/account — try the next
        }
      }
    }
    return NextResponse.json(
      { success: false, error: 'Couldn’t open that post with the connected Page. Check it’s an ad from this client’s Page, and try the numeric post ID.' },
      { status: 404 }
    );
  } catch (error) {
    logger.error('Add ad post error:', error);
    return NextResponse.json({ success: false, error: 'Couldn’t add that ad' }, { status: 500 });
  }
}
