/**
 * Who can be @mentioned on a client's posts, and the emails sent when someone
 * is mentioned or replied to (server only).
 */
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { sendCommentNotificationEmail } from '@/lib/email';
import { getEmailMediaPreview } from '@/lib/emailMedia';
import { mentionsToPlainText, type Mentionable, type ParsedMention } from '@/lib/mentions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export type CommentPostType = 'scheduled' | 'calendar_scheduled' | 'portal_upload';

interface AgencyUser {
  id: string;
  name: string;
  email: string | null;
}

/** The agency user who owns the client (the only agency account per client today). */
export async function getAgencyUser(clientId: string): Promise<AgencyUser | null> {
  const { data: client } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client?.user_id) return null;
  return getAgencyUserById(client.user_id);
}

export async function getAgencyUserById(userId: string): Promise<AgencyUser | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();

  let email: string | null = profile?.email ?? null;
  if (!email) {
    const { data } = await supabase.auth.admin.getUserById(userId);
    email = data?.user?.email ?? null;
  }

  const name = profile?.full_name?.trim() || email?.split('@')[0] || 'Agency';
  return { id: userId, name, email };
}

export async function getMentionables(clientId: string): Promise<Mentionable[]> {
  const [{ data: members }, agency] = await Promise.all([
    supabase
      .from('portal_members')
      .select('id, name, color, party:party_id (name)')
      .eq('client_id', clientId)
      .order('name', { ascending: true }),
    getAgencyUser(clientId),
  ]);

  const out: Mentionable[] = [];
  if (agency) {
    out.push({ id: agency.id, kind: 'user', name: agency.name, label: 'Agency', color: '#1e293b' });
  }
  for (const m of members ?? []) {
    const party = Array.isArray(m.party) ? m.party[0] : m.party;
    out.push({
      id: m.id,
      kind: 'member',
      name: m.name,
      label: (party as { name: string } | null)?.name ?? null,
      color: m.color,
    });
  }
  return out;
}

/** Keep only mentions of people who actually belong to this client. */
export async function filterValidMentions(
  clientId: string,
  mentions: ParsedMention[]
): Promise<ParsedMention[]> {
  if (mentions.length === 0) return [];

  const memberIds = mentions.filter(m => m.kind === 'member').map(m => m.id);
  const validMemberIds = new Set<string>();
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from('portal_members')
      .select('id')
      .eq('client_id', clientId)
      .in('id', memberIds);
    for (const row of data ?? []) validMemberIds.add(row.id);
  }

  const agency = mentions.some(m => m.kind === 'user') ? await getAgencyUser(clientId) : null;

  return mentions.filter(m =>
    m.kind === 'member' ? validMemberIds.has(m.id) : agency?.id === m.id
  );
}

interface NotifyParams {
  clientId: string;
  postId: string;
  postType: CommentPostType;
  commentId: string;
  content: string;
  authorName: string;
  author: { memberId: string | null; userId: string | null };
  mentions: ParsedMention[];
  parentComment: { member_id: string | null; user_id: string | null } | null;
  appUrl: string;
}

interface Recipient {
  key: string;
  name: string;
  email: string;
  link: string;
  reason: 'mention' | 'reply';
}

async function getPostPreview(postId: string, postType: CommentPostType) {
  if (postType === 'portal_upload') {
    const { data } = await supabase
      .from('client_uploads')
      .select('notes, file_url, file_type')
      .eq('id', postId)
      .maybeSingle();
    return { caption: data?.notes ?? null, ...(await getEmailMediaPreview(data?.file_url, data?.file_type)) };
  }
  if (postType === 'calendar_scheduled') {
    const { data } = await supabase
      .from('calendar_scheduled_posts')
      .select('caption, image_url, media_urls')
      .eq('id', postId)
      .maybeSingle();
    // Carousels keep their media in media_urls — the first item is the cover
    const firstMedia = (data?.media_urls as string[] | null)?.[0] ?? data?.image_url;
    return { caption: data?.caption ?? null, ...(await getEmailMediaPreview(firstMedia)) };
  }
  const { data } = await supabase.from('scheduled_posts').select('caption, image_url').eq('id', postId).maybeSingle();
  return { caption: data?.caption ?? null, ...(await getEmailMediaPreview(data?.image_url)) };
}

/**
 * Email everyone mentioned in a comment, plus the author of the comment being
 * replied to. Never emails the comment's own author, and each person at most once.
 */
export async function notifyCommentRecipients(params: NotifyParams): Promise<void> {
  const { clientId, postId, postType, commentId, content, authorName, author, mentions, parentComment, appUrl } = params;

  const memberReasons = new Map<string, 'mention' | 'reply'>();
  const userReasons = new Map<string, 'mention' | 'reply'>();
  for (const m of mentions) {
    (m.kind === 'member' ? memberReasons : userReasons).set(m.id, 'mention');
  }
  if (parentComment?.member_id && !memberReasons.has(parentComment.member_id)) {
    memberReasons.set(parentComment.member_id, 'reply');
  }
  if (parentComment?.user_id && !userReasons.has(parentComment.user_id)) {
    userReasons.set(parentComment.user_id, 'reply');
  }
  if (author.memberId) memberReasons.delete(author.memberId);
  if (author.userId) userReasons.delete(author.userId);

  if (memberReasons.size === 0 && userReasons.size === 0) return;

  const { data: client } = await supabase
    .from('clients')
    .select('name, portal_token')
    .eq('id', clientId)
    .maybeSingle();
  const clientName = client?.name ?? 'your client';

  const recipients: Recipient[] = [];

  if (memberReasons.size > 0) {
    const { data: members } = await supabase
      .from('portal_members')
      .select('id, name, email, email_notifications, party:party_id (portal_token)')
      .eq('client_id', clientId)
      .in('id', [...memberReasons.keys()]);

    for (const m of members ?? []) {
      if (!m.email_notifications) continue;
      const party = (Array.isArray(m.party) ? m.party[0] : m.party) as { portal_token: string } | null;
      const portalToken = party?.portal_token ?? client?.portal_token;
      if (!portalToken) continue;
      recipients.push({
        key: `member:${m.id}`,
        name: m.name,
        email: m.email,
        link: `${appUrl}/portal/${portalToken}?post=${postId}`,
        reason: memberReasons.get(m.id)!,
      });
    }
  }

  for (const [userId, reason] of userReasons) {
    const user = await getAgencyUserById(userId);
    if (!user?.email) continue;
    recipients.push({
      key: `user:${userId}`,
      name: user.name,
      email: user.email,
      link: `${appUrl}/dashboard/client/${clientId}/calendar`,
      reason,
    });
  }

  if (recipients.length === 0) return;

  const preview = await getPostPreview(postId, postType);
  const commentText = mentionsToPlainText(content);

  const results = await Promise.all(
    recipients.map(r =>
      sendCommentNotificationEmail({
        to: r.email,
        recipientName: r.name,
        authorName,
        clientName,
        reason: r.reason,
        commentText,
        postCaption: preview.caption,
        postImageUrl: preview.imageUrl,
        postIsVideo: preview.isVideo,
        link: r.link,
      }).then(res => ({ r, ok: res.success }))
    )
  );

  // Record delivery on the mention rows (replies have no mention row)
  const notifiedAt = new Date().toISOString();
  for (const { r, ok } of results) {
    if (!ok || r.reason !== 'mention') continue;
    const [kind, id] = r.key.split(':');
    await supabase
      .from('comment_mentions')
      .update({ notified_at: notifiedAt })
      .eq('comment_id', commentId)
      .eq(kind === 'member' ? 'member_id' : 'user_id', id);
  }

  const failed = results.filter(x => !x.ok).length;
  if (failed > 0) {
    logger.warn('Some comment notification emails failed', { commentId, failed, total: results.length });
  }
}
