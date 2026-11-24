import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { containsLink, toFeedCheck } from '@/lib/feedChecker/check';
import { editPublishedPost, replyToComment, ZernioError } from '@/lib/zernio/api';
import type { FeedIssue } from '@/lib/comments/types';

export const dynamic = 'force-dynamic';

// Act on a Feed Checker finding. Body: { action, link?, caption? }
//   resolve | ignore | reopen
//   add_link_comment  published post: comment the link from the account now
//   set_first_comment upcoming post: save the link as its first comment
//   apply_fix         upcoming post: use the corrected caption; published Facebook post
//                     the app published: edit the caption in place

type Params = { params: Promise<{ clientId: string; checkId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId, checkId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '');
  const admin = createSupabaseAdmin();
  const { data: raw } = await admin.from('client_feed_checks').select('*').eq('id', checkId).eq('client_id', clientId).maybeSingle();
  if (!raw) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const check = toFeedCheck(raw);
  const now = new Date().toISOString();

  const dropIssues = (types: string[]) => {
    const remaining = check.issues.filter((i: FeedIssue) => !types.includes(i.type));
    return { issues: remaining, status: remaining.length ? 'open' : 'resolved', resolved_at: remaining.length ? null : now };
  };

  try {
    let patch: Record<string, unknown>;
    switch (action) {
      case 'resolve':
      case 'ignore':
        patch = { status: action === 'resolve' ? 'resolved' : 'ignored', resolved_at: now };
        break;
      case 'reopen':
        patch = { status: 'open', resolved_at: null };
        break;
      case 'add_link_comment': {
        const link = String(body?.link ?? '').trim().slice(0, 1000);
        if (!containsLink(link)) return NextResponse.json({ success: false, error: 'Add a link (e.g. https://…)' }, { status: 400 });
        if (check.source !== 'published' || !check.accountId) return NextResponse.json({ success: false, error: 'Only for published posts' }, { status: 400 });
        await replyToComment(check.postRef, check.accountId, link);
        patch = dropIssues(['missing_link']);
        break;
      }
      case 'set_first_comment': {
        const link = String(body?.link ?? '').trim().slice(0, 1000);
        if (!containsLink(link)) return NextResponse.json({ success: false, error: 'Add a link (e.g. https://…)' }, { status: 400 });
        if (!check.calendarPostId) return NextResponse.json({ success: false, error: 'Only for upcoming posts' }, { status: 400 });
        const { error } = await admin.from('calendar_scheduled_posts').update({ first_comment: link }).eq('id', check.calendarPostId).eq('client_id', clientId);
        if (error) throw error;
        patch = dropIssues(['link_reminder']);
        break;
      }
      case 'apply_fix': {
        const caption = String(body?.caption ?? check.suggestedCaption ?? '').trim();
        if (!caption) return NextResponse.json({ success: false, error: 'No corrected caption' }, { status: 400 });
        if (check.source === 'scheduled' && check.calendarPostId) {
          if (check.latePostId) {
            return NextResponse.json(
              { success: false, error: 'This post is already scheduled with Zernio — edit the caption in the calendar so it’s updated there too.' },
              { status: 400 }
            );
          }
          const { error } = await admin.from('calendar_scheduled_posts').update({ caption }).eq('id', check.calendarPostId).eq('client_id', clientId);
          if (error) throw error;
        } else if (check.canApplyFix && check.latePostId) {
          await editPublishedPost(check.latePostId, 'facebook', caption, check.accountId ?? undefined);
        } else {
          return NextResponse.json({ success: false, error: 'This caption can’t be edited automatically — copy the fix instead.' }, { status: 400 });
        }
        patch = { ...dropIssues(['spelling', 'grammar']), post_text: caption, suggested_caption: null };
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
    const { data: updated } = await admin.from('client_feed_checks').update(patch).eq('id', checkId).select('*').single();
    return NextResponse.json({ success: true, check: toFeedCheck(updated ?? raw) });
  } catch (error) {
    if (error instanceof ZernioError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    logger.error('Feed check action error:', error);
    return NextResponse.json({ success: false, error: 'That didn’t work — try again' }, { status: 500 });
  }
}
