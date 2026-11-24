/**
 * "Notify by email" for approval updates (server only).
 *
 * Each client has a list of email addresses (typed in, or picked from people who
 * have signed in to the portal) that get an email whenever one of the client's
 * posts gets an approval update — approved, improve requested, rejected, cleared,
 * a new comment, or moved to another date from the portal. Hooked into the
 * portal, approval links (/approval/[token]), the approval pipeline and the
 * agency's own status changes. The person who made the change is never emailed.
 *
 * Table: approval_watchers (migrations/038-approval-watchers.sql).
 */
import { after } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { sendApprovalUpdateEmail, type ApprovalUpdateKind } from '@/lib/email';
import { getAgencyUser, getAgencyUserById, getPostPreview, type CommentPostType } from '@/lib/commentNotifications';
import { mentionsToPlainText } from '@/lib/mentions';
import { listAccounts } from '@/lib/zernio/api';
import { accountFullName } from '@/lib/socialAccounts';

const TABLE = 'approval_watchers';

export const APPROVAL_WATCHERS_SETUP_MESSAGE =
  'Email notifications need a one-off database update: run migrations/038-approval-watchers.sql in Supabase.';

export const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01';

export const addWatcherSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  name: z.string().trim().max(200).optional().nullable(),
});

export interface ApprovalWatcher {
  id: string;
  email: string;
  name: string | null;
  member_id: string | null;
  created_at: string;
}

export interface WatcherSuggestion {
  email: string;
  name: string;
  /** "Portal" for people who have signed in to the portal, "You" for the agency owner */
  label: string;
  member_id: string | null;
}

const WATCHER_COLUMNS = 'id, email, name, member_id, created_at';

export async function listWatchers(
  clientId: string
): Promise<{ watchers: ApprovalWatcher[]; missingTable: boolean }> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select(WATCHER_COLUMNS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) {
    if (!isMissingTable(error)) logger.error('List approval watchers error:', error);
    return { watchers: [], missingTable: isMissingTable(error) };
  }
  return { watchers: (data ?? []) as ApprovalWatcher[], missingTable: false };
}

/** People to offer in the picker: the agency owner and everyone who has signed in to the portal. */
export async function getWatcherSuggestions(clientId: string): Promise<WatcherSuggestion[]> {
  const admin = createSupabaseAdmin();
  const [{ data: members }, agency] = await Promise.all([
    admin
      .from('portal_members')
      .select('id, name, email, last_seen_at, party:party_id (name)')
      .eq('client_id', clientId)
      .order('last_seen_at', { ascending: false }),
    getAgencyUser(clientId),
  ]);

  const out: WatcherSuggestion[] = [];
  const seen = new Set<string>();
  if (agency?.email) {
    out.push({ email: agency.email.toLowerCase(), name: agency.name, label: 'You', member_id: null });
    seen.add(agency.email.toLowerCase());
  }
  for (const m of members ?? []) {
    const email = (m.email as string).toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const party = (Array.isArray(m.party) ? m.party[0] : m.party) as { name: string } | null;
    out.push({
      email,
      name: m.name as string,
      label: party?.name ? `Portal · ${party.name}` : 'Portal',
      member_id: m.id as string,
    });
  }
  return out;
}

export async function addWatcher(
  clientId: string,
  input: { email: string; name?: string | null },
  createdBy: string
): Promise<{ watcher?: ApprovalWatcher; error?: string; missingTable?: boolean }> {
  const admin = createSupabaseAdmin();
  const email = input.email.trim().toLowerCase();

  const { data: member } = await admin
    .from('portal_members')
    .select('id, name')
    .eq('client_id', clientId)
    .ilike('email', email)
    .maybeSingle();

  const { data: existing, error: existingError } = await admin
    .from(TABLE)
    .select(WATCHER_COLUMNS)
    .eq('client_id', clientId)
    .ilike('email', email)
    .maybeSingle();
  if (existingError) {
    if (isMissingTable(existingError)) return { missingTable: true, error: APPROVAL_WATCHERS_SETUP_MESSAGE };
    logger.error('Find approval watcher error:', existingError);
    return { error: 'Could not add that email' };
  }
  if (existing) return { watcher: existing as ApprovalWatcher };

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      client_id: clientId,
      email,
      name: input.name?.trim() || (member?.name as string | undefined) || null,
      member_id: (member?.id as string | undefined) ?? null,
      created_by: createdBy,
    })
    .select(WATCHER_COLUMNS)
    .single();
  if (error) {
    if (isMissingTable(error)) return { missingTable: true, error: APPROVAL_WATCHERS_SETUP_MESSAGE };
    logger.error('Add approval watcher error:', error);
    return { error: 'Could not add that email' };
  }
  return { watcher: data as ApprovalWatcher };
}

export async function removeWatcher(clientId: string, watcherId: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from(TABLE).delete().eq('client_id', clientId).eq('id', watcherId);
  if (error) {
    logger.error('Remove approval watcher error:', error);
    return false;
  }
  return true;
}

/** From the "Stop these emails" link. Returns the client name for the confirmation page. */
export async function unsubscribeWatcher(token: string): Promise<{ ok: boolean; clientName?: string; email?: string }> {
  if (!/^[a-f0-9]{32,128}$/i.test(token)) return { ok: false };
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from(TABLE)
    .select('id, email, client:client_id (name)')
    .eq('unsubscribe_token', token)
    .maybeSingle();
  if (!data) return { ok: false };
  await admin.from(TABLE).delete().eq('id', data.id);
  const client = (Array.isArray(data.client) ? data.client[0] : data.client) as { name: string } | null;
  return { ok: true, clientName: client?.name, email: data.email as string };
}

// ── Sending ──────────────────────────────────────────────────────────────────

/** Map the various status names used across the app onto the email kinds. */
export function approvalKindFromStatus(status: string | null | undefined): ApprovalUpdateKind | null {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'needs_attention':
    case 'changes_requested':
      return 'needs_attention';
    case 'rejected':
      return 'rejected';
    case 'pending':
      return 'pending';
    default:
      return null;
  }
}

export interface ApprovalUpdateEvent {
  clientId: string;
  postId: string;
  postType: CommentPostType;
  kind: ApprovalUpdateKind;
  /** Who made the change. Falls back to the client's name (e.g. an anonymous approval link). */
  actor: { name?: string | null; email?: string | null; memberId?: string | null; userId?: string | null };
  /** Feedback with a status change, or the comment text */
  message?: string | null;
  /** For kind 'date': where the post was and where it is now */
  move?: { fromDate: string | null; fromTime?: string | null; toDate: string | null; toTime?: string | null };
  /** Base URL for links, from getRequestAppUrl(request) */
  appUrl: string;
}

function formatDay(date: string | null | undefined, time?: string | null): string | null {
  if (!date) return null;
  // Date-only strings are calendar days — parse as local noon so the weekday never shifts
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const t = time ? formatTime(time) : null;
  return t ? `${day}, ${t}` : day;
}

function formatTime(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]}${suffix}`;
}

async function getPostDetails(
  postId: string,
  postType: CommentPostType
): Promise<{ scheduled: string | null; platforms: string[] }> {
  const admin = createSupabaseAdmin();
  if (postType === 'calendar_scheduled') {
    const { data } = await admin
      .from('calendar_scheduled_posts')
      .select('scheduled_date, scheduled_time, target_platforms, platforms_scheduled')
      .eq('id', postId)
      .maybeSingle();
    // Where it's been scheduled in Zernio wins; otherwise the platforms ticked in the post modal
    const scheduledTo = (data?.platforms_scheduled as string[] | null) ?? [];
    const targets = (data?.target_platforms as string[] | null) ?? [];
    return {
      scheduled: formatDay(data?.scheduled_date, data?.scheduled_time),
      platforms: scheduledTo.length > 0 ? scheduledTo : targets,
    };
  }
  if (postType === 'scheduled') {
    const { data } = await admin.from('scheduled_posts').select('scheduled_time').eq('id', postId).maybeSingle();
    return { scheduled: formatDay(data?.scheduled_time), platforms: [] };
  }
  const { data } = await admin.from('client_uploads').select('target_date').eq('id', postId).maybeSingle();
  return { scheduled: formatDay(data?.target_date), platforms: [] };
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'X',
  x: 'X',
  youtube: 'YouTube',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  googlebusiness: 'Google Business',
  reddit: 'Reddit',
  telegram: 'Telegram',
};

export function platformLabel(platform: string): string {
  const key = platform.toLowerCase();
  return PLATFORM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export interface EmailAccount {
  platform: string;
  name: string;
}

/**
 * The client's connected social accounts by name (live from Zernio), limited to the
 * post's platforms when it has any. null = couldn't read them (no profile, API error).
 */
async function getConnectedAccounts(
  lateProfileId: string | null | undefined,
  postPlatforms: string[]
): Promise<{ label: string; accounts: EmailAccount[] } | null> {
  if (!lateProfileId) return { label: 'Connected accounts', accounts: [] };
  try {
    const accounts = await listAccounts(lateProfileId);
    const wanted = new Set(postPlatforms.map(p => (p.toLowerCase() === 'x' ? 'twitter' : p.toLowerCase())));
    const forPost = accounts.filter(a => wanted.has(a.platform.toLowerCase()));
    // The post's own platforms when it has connected ones, otherwise everything connected
    const relevant = forPost.length > 0 ? forPost : accounts;
    const label = forPost.length > 0 ? 'Posting to' : 'Connected accounts';
    return {
      label,
      accounts: relevant.map(a => ({ platform: platformLabel(a.platform), name: accountFullName(a) ?? 'Connected account' })),
    };
  } catch (err) {
    logger.warn('Could not load connected accounts for approval email', err);
    return null;
  }
}

/**
 * The portal's "Improve" saves the status (with the feedback) and then posts the same
 * text as a comment. The status email already carries it, so skip the comment email.
 */
async function isEchoOfStatusFeedback(postId: string, message: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('post_approval_history')
    .select('new_client_feedback')
    .eq('post_id', postId)
    .gte('changed_at', since)
    .limit(10);
  const text = message.trim();
  return (data ?? []).some(row => (row.new_client_feedback as string | null)?.trim() === text);
}

/** Send the emails now. Never throws. */
export async function notifyApprovalWatchers(event: ApprovalUpdateEvent): Promise<void> {
  try {
    const { clientId, postId, postType, kind, actor, appUrl } = event;
    const admin = createSupabaseAdmin();

    const { data: watchers, error } = await admin
      .from(TABLE)
      .select('id, email, name, member_id, unsubscribe_token')
      .eq('client_id', clientId);
    if (error) {
      if (!isMissingTable(error)) logger.error('Load approval watchers error:', error);
      return;
    }
    if (!watchers || watchers.length === 0) return;

    const message = event.message?.trim() ? mentionsToPlainText(event.message.trim()) : null;
    if (kind === 'comment' && event.message && (await isEchoOfStatusFeedback(postId, event.message))) return;

    // Never email the person who made the change
    let actorEmail = actor.email?.toLowerCase() ?? null;
    if (!actorEmail && actor.memberId) {
      const { data } = await admin.from('portal_members').select('email').eq('id', actor.memberId).maybeSingle();
      actorEmail = (data?.email as string | undefined)?.toLowerCase() ?? null;
    }
    let agencyActorName: string | null = null;
    if (actor.userId && (!actorEmail || !actor.name)) {
      const agencyUser = await getAgencyUserById(actor.userId);
      actorEmail = actorEmail ?? agencyUser?.email?.toLowerCase() ?? null;
      agencyActorName = agencyUser?.name ?? null;
    }
    const recipients = watchers.filter(w => (w.email as string).toLowerCase() !== actorEmail);
    if (recipients.length === 0) return;

    const { data: client } = await admin
      .from('clients')
      .select('name, portal_token, late_profile_id')
      .eq('id', clientId)
      .maybeSingle();
    const clientName = (client?.name as string | undefined) ?? 'Your client';
    const actorName = actor.name?.trim() || agencyActorName || clientName;

    // Portal people get a link straight to the post in the portal; everyone else the calendar
    const emails = recipients.map(w => (w.email as string).toLowerCase());
    const { data: members } = await admin
      .from('portal_members')
      .select('id, email, party:party_id (portal_token)')
      .eq('client_id', clientId);
    const memberByEmail = new Map<string, string | null>();
    for (const m of members ?? []) {
      const email = (m.email as string).toLowerCase();
      if (!emails.includes(email)) continue;
      const party = (Array.isArray(m.party) ? m.party[0] : m.party) as { portal_token: string } | null;
      memberByEmail.set(email, party?.portal_token ?? (client?.portal_token as string | undefined) ?? null);
    }

    const [preview, details] = await Promise.all([
      getPostPreview(postId, postType),
      getPostDetails(postId, postType),
    ]);
    const scheduledLine = kind === 'date' ? null : details.scheduled;
    const accounts = await getConnectedAccounts(client?.late_profile_id as string | null | undefined, details.platforms);

    let dateLine: string | null = scheduledLine ? `Scheduled for ${scheduledLine}` : null;
    if (kind === 'date' && event.move) {
      const from = formatDay(event.move.fromDate, event.move.fromTime) ?? 'unscheduled';
      const to = formatDay(event.move.toDate, event.move.toTime) ?? 'unscheduled';
      dateLine = `${from} → ${to}`;
    }

    const calendarLink = `${appUrl}/dashboard/client/${clientId}/calendar`;

    const results = await Promise.all(
      recipients.map(w => {
        const email = (w.email as string).toLowerCase();
        const portalToken = memberByEmail.get(email);
        const link = portalToken ? `${appUrl}/portal/${portalToken}?post=${postId}` : calendarLink;
        return sendApprovalUpdateEmail({
          to: email,
          clientName,
          kind,
          actorName,
          message,
          dateLine,
          accounts: accounts?.accounts ?? null,
          accountsLabel: accounts?.label,
          postCaption: preview.caption,
          postImageUrl: preview.imageUrl,
          postIsVideo: preview.isVideo,
          link,
          linkLabel: portalToken ? 'Open in the portal' : 'Open the calendar',
          unsubscribeUrl: w.unsubscribe_token
            ? `${appUrl}/api/approval-watchers/unsubscribe?token=${w.unsubscribe_token}`
            : null,
        });
      })
    );

    const failed = results.filter(r => !r.success).length;
    if (failed > 0) {
      logger.warn('Some approval update emails failed', { postId, kind, failed, total: results.length });
    }
  } catch (err) {
    logger.error('Approval update notification error:', err);
  }
}

/** Send the emails after the response, so approving stays instant. */
export function notifyApprovalWatchersAfterResponse(event: ApprovalUpdateEvent): void {
  const task = () => notifyApprovalWatchers(event);
  try {
    after(task);
  } catch {
    void task();
  }
}
