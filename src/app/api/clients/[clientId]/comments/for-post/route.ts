import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { listAccounts, getPostComments } from '@/lib/zernio/api';
import { isMissingTable, toCommentRow, triageComments } from '@/lib/comments/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Comments on one post published from the calendar (by its Zernio post id, which the
// Comments API resolves), for the calendar post modal. New comments are stored and
// triaged so they get AI reply drafts; existing rows keep their platform ids.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const latePostId = request.nextUrl.searchParams.get('latePostId') ?? '';
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(latePostId)) return NextResponse.json({ success: false, error: 'Missing post' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: client } = await admin.from('clients').select('late_profile_id').eq('id', clientId).maybeSingle();
  if (!client?.late_profile_id) return NextResponse.json({ success: true, comments: [] });

  try {
    const accounts = (await listAccounts(client.late_profile_id)).filter((a) =>
      ['instagram', 'facebook', 'linkedin', 'threads', 'tiktok'].includes(a.platform)
    );
    const ids: string[] = [];
    for (const account of accounts) {
      try {
        const { comments, post } = await getPostComments(latePostId, account._id);
        const flat: Array<Record<string, unknown>> = [];
        const walk = (list: typeof comments, parent: string | null) => {
          for (const c of list) {
            flat.push({
              client_id: clientId,
              platform: account.platform,
              account_id: account._id,
              platform_comment_id: c.id,
              platform_post_id: latePostId,
              parent_comment_id: c.parentId ?? parent,
              post_text: post?.message ?? post?.text ?? null,
              post_url: post?.permalink ?? null,
              post_thumbnail: post?.thumbnailUrl ?? null,
              author_id: c.from?.id ?? null,
              author_name: c.from?.name ?? null,
              author_username: c.from?.username ?? null,
              author_picture: c.from?.picture ?? null,
              is_own: c.from?.isOwner === true,
              message: (c.message ?? '').slice(0, 5000),
              comment_url: c.url ?? null,
              commented_at: c.createdTime ?? null,
              can_reply: c.canReply !== false,
              can_hide: c.canHide === true,
              can_like: c.canLike === true,
              can_delete: c.canDelete === true,
              is_hidden: c.isHidden === true,
              is_liked: c.isLiked === true,
            });
            if (c.replies?.length) walk(c.replies, c.id);
          }
        };
        walk(comments, null);
        if (flat.length) {
          const { error } = await admin
            .from('client_comments')
            .upsert(flat, { onConflict: 'client_id,platform,platform_comment_id', ignoreDuplicates: true });
          if (error && isMissingTable(error)) return NextResponse.json({ success: true, comments: [], setupRequired: true });
          ids.push(...flat.map((f) => f.platform_comment_id as string));
        }
      } catch {
        // The post isn't on this account
      }
    }
    if (!ids.length) return NextResponse.json({ success: true, comments: [] });

    const fetchRows = async () =>
      (
        await admin
          .from('client_comments')
          .select('*')
          .eq('client_id', clientId)
          .in('platform_comment_id', ids)
          .order('commented_at', { ascending: true })
      ).data ?? [];
    let rows = await fetchRows();
    const untriaged = rows.filter((r) => !r.triaged_at && !r.is_own).map((r) => r.id as string);
    if (untriaged.length) {
      await triageComments(admin, clientId, untriaged);
      rows = await fetchRows();
    }
    return NextResponse.json({ success: true, comments: rows.map(toCommentRow) });
  } catch (error) {
    logger.error('GET comments for post error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load comments' }, { status: 500 });
  }
}
