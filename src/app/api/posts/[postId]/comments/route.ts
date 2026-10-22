import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { requireAuth } from '@/lib/authHelpers';
import { getPortalMember } from '@/lib/portalMembers';
import { parseMentions } from '@/lib/mentions';
import { filterValidMentions, getAgencyUserById, notifyCommentRecipients } from '@/lib/commentNotifications';
import { getRequestAppUrl } from '@/lib/requestAppUrl';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const AddCommentSchema = z.object({
  portal_token: z.string().uuid().optional(),
  // Ignored for signed-in portal members and agency users — the server knows who they are
  author_name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000),
  post_type: z.enum(['scheduled', 'calendar_scheduled', 'portal_upload']).default('calendar_scheduled'),
  parent_comment_id: z.string().uuid().optional().nullable(),
});

const COMMENT_SELECT = `
  id,
  author_name,
  author_type,
  content,
  created_at,
  parent_comment_id,
  member_id,
  user_id,
  party:party_id (
    id,
    name,
    role,
    color
  ),
  member:member_id (
    id,
    name,
    color
  )
`;

// GET /api/posts/[postId]/comments
// Fetches thread. Accessible by agency or portal party.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');
    const postType = searchParams.get('post_type') ?? 'calendar_scheduled';

    let clientId: string | null = null;

    if (portalToken) {
      const resolved = await resolvePortalToken(portalToken);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      }
      clientId = resolved.clientId;

      // For portal_upload, verify the upload belongs to this client
      if (postType === 'portal_upload') {
        const { data: upload } = await supabaseAdmin
          .from('client_uploads')
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();
        if (!upload || upload.client_id !== clientId) {
          return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
        }
      }
    } else {
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      const { supabase, user } = auth;

      if (postType === 'portal_upload') {
        const { data: upload } = await supabase
          .from('client_uploads')
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();
        if (!upload) {
          return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
        }
        const { data: clientCheck } = await supabase
          .from('clients')
          .select('id')
          .eq('id', upload.client_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!clientCheck) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        const postTable = postType === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
        const { data: post } = await supabase
          .from(postTable)
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        const { data: clientCheck } = await supabase
          .from('clients')
          .select('id')
          .eq('id', post.client_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!clientCheck) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const { data: comments, error } = await supabaseAdmin
      .from('post_comments')
      .select(COMMENT_SELECT)
      .eq('post_id', postId)
      .eq('post_type', postType)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching post comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments ?? [] });
  } catch (error) {
    logger.error('Comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/posts/[postId]/comments
// Adds a comment. Can come from agency (Bearer) or portal party (portal_token in body).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const parsed = AddCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { portal_token, content, post_type, parent_comment_id } = parsed.data;

    let partyId: string | null = null;
    let userId: string | null = null;
    let memberId: string | null = null;
    let clientId: string;
    let authorName: string;
    let authorType: 'agency' | 'portal_party';

    if (portal_token) {
      // Portal party comment
      const resolved = await resolvePortalToken(portal_token);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      }
      // Portal comments must come from a signed-in person, not just the link
      const member = await getPortalMember(request, resolved.clientId);
      if (!member) {
        return NextResponse.json(
          { error: 'Please sign in to comment', code: 'not_signed_in' },
          { status: 401 }
        );
      }
      memberId = member.id;
      authorName = member.name;
      partyId = member.party_id ?? resolved.party?.id ?? null;
      clientId = resolved.clientId;
      authorType = 'portal_party';

      if (post_type === 'portal_upload') {
        const { data: upload } = await supabaseAdmin
          .from('client_uploads')
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();
        if (!upload || upload.client_id !== resolved.clientId) {
          return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
        }
      } else {
        const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
        const { data: post } = await supabaseAdmin
          .from(postTable)
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();
        if (!post || post.client_id !== resolved.clientId) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
      }
    } else {
      // Agency comment
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      const { supabase, user } = auth;

      userId = user.id;
      authorType = 'agency';
      const agencyUser = await getAgencyUserById(user.id);
      authorName = agencyUser?.name ?? parsed.data.author_name ?? 'Agency';

      if (post_type === 'portal_upload') {
        const { data: upload } = await supabase
          .from('client_uploads')
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();
        if (!upload) {
          return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
        }
        const { data: clientCheck } = await supabase
          .from('clients')
          .select('id')
          .eq('id', upload.client_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!clientCheck) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        clientId = upload.client_id;
      } else {
        const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
        const { data: post } = await supabase
          .from(postTable)
          .select('client_id')
          .eq('id', postId)
          .maybeSingle();

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        const { data: clientCheck } = await supabase
          .from('clients')
          .select('id')
          .eq('id', post.client_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!clientCheck) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        clientId = post.client_id;
      }
    }

    // Replies hang off the top-level comment, so threads stay one level deep
    let parentComment: { id: string; member_id: string | null; user_id: string | null } | null = null;
    if (parent_comment_id) {
      const { data: parent } = await supabaseAdmin
        .from('post_comments')
        .select('id, member_id, user_id, parent_comment_id')
        .eq('id', parent_comment_id)
        .eq('post_id', postId)
        .eq('post_type', post_type)
        .maybeSingle();
      if (!parent) {
        return NextResponse.json({ error: 'The comment you replied to no longer exists' }, { status: 404 });
      }
      parentComment = parent;
      if (parent.parent_comment_id) {
        const { data: root } = await supabaseAdmin
          .from('post_comments')
          .select('id')
          .eq('id', parent.parent_comment_id)
          .maybeSingle();
        if (root) parentComment = { ...parent, id: root.id };
      }
    }

    const { data: comment, error } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: postId,
        post_type,
        party_id: partyId,
        user_id: userId,
        member_id: memberId,
        parent_comment_id: parentComment?.id ?? null,
        author_name: authorName,
        author_type: authorType,
        content,
      })
      .select(COMMENT_SELECT)
      .single();

    if (error) {
      logger.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // @mentions + reply notifications. A failure here never fails the comment itself.
    try {
      const mentions = await filterValidMentions(clientId, parseMentions(content));
      if (mentions.length > 0) {
        const { error: mentionError } = await supabaseAdmin.from('comment_mentions').insert(
          mentions.map(m => ({
            comment_id: comment.id,
            member_id: m.kind === 'member' ? m.id : null,
            user_id: m.kind === 'user' ? m.id : null,
          }))
        );
        if (mentionError) logger.error('Error saving comment mentions:', mentionError);
      }

      await notifyCommentRecipients({
        clientId,
        postId,
        postType: post_type,
        commentId: comment.id,
        content,
        authorName,
        author: { memberId, userId },
        mentions,
        parentComment,
        appUrl: getRequestAppUrl(request),
      });
    } catch (notifyError) {
      logger.error('Error sending comment notifications:', notifyError);
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    logger.error('Comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
