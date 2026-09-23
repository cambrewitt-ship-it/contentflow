import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Shared by the calendar "Share Approval Link" and the portal "One-time Link" so both
// create identical sessions that the /approval/[token] page and submit endpoint understand.

export type ApprovalPostType = 'planner_scheduled' | 'scheduled' | 'portal_upload';

export class ApprovalSessionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApprovalSessionError';
  }
}

// post_comments uses its own post_type vocabulary; calendar posts are 'calendar_scheduled'
export function commentPostTypeFor(postType: ApprovalPostType): 'calendar_scheduled' | 'scheduled' | 'portal_upload' {
  if (postType === 'planner_scheduled') return 'calendar_scheduled';
  return postType;
}

export function buildApprovalShareUrl(request: NextRequest, shareToken: string): string {
  const host = request.headers.get('host');
  if (host?.includes('localhost')) return `http://${host}/approval/${shareToken}`;
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  if (host && (host.includes('vercel.app') || host.includes('contentflow') || host.includes('content-manager.io'))) {
    return `${protocol}://${host}/approval/${shareToken}`;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : 'https://content-manager.io');
  return `${base}/approval/${shareToken}`;
}

// Expects a service-role client; callers must have already authorised access to clientId.
export async function createApprovalSession(
  supabase: SupabaseClient,
  { clientId, postIds, expiresInDays = 30 }: { clientId: string; postIds: string[]; expiresInDays?: number }
) {
  const ids = Array.from(new Set(postIds));
  if (ids.length === 0) throw new ApprovalSessionError('Post IDs are required', 400);

  const [calendarResult, legacyResult, uploadsResult] = await Promise.all([
    supabase.from('calendar_scheduled_posts').select('id, project_id').eq('client_id', clientId).in('id', ids),
    supabase.from('scheduled_posts').select('id, project_id').eq('client_id', clientId).in('id', ids),
    supabase.from('client_uploads').select('id').eq('client_id', clientId).in('id', ids),
  ]);
  if (calendarResult.error || uploadsResult.error) {
    throw new ApprovalSessionError('Failed to look up selected posts', 500);
  }

  const calendarPosts = calendarResult.data ?? [];
  const legacyPosts = legacyResult.data ?? [];
  const uploads = uploadsResult.data ?? [];

  const rows: Array<{ post_id: string; post_type: ApprovalPostType }> = [
    ...calendarPosts.map((p) => ({ post_id: p.id as string, post_type: 'planner_scheduled' as const })),
    ...legacyPosts.map((p) => ({ post_id: p.id as string, post_type: 'scheduled' as const })),
    ...uploads.map((u) => ({ post_id: u.id as string, post_type: 'portal_upload' as const })),
  ];
  if (rows.length === 0) throw new ApprovalSessionError('No valid posts found', 404);

  // Informational only — the session's post_approvals rows decide which posts it covers
  const projectIds = new Set([...calendarPosts, ...legacyPosts].map((p) => p.project_id).filter(Boolean));
  const projectId = projectIds.size === 1 ? (Array.from(projectIds)[0] as string) : null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: session, error: sessionError } = await supabase
    .from('client_approval_sessions')
    .insert({
      project_id: projectId,
      client_id: clientId,
      share_token: crypto.randomUUID(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();
  if (sessionError || !session) throw new ApprovalSessionError('Failed to create approval session', 500);

  const { error: approvalsError } = await supabase
    .from('post_approvals')
    .insert(rows.map((row) => ({ ...row, session_id: session.id, approval_status: 'pending' })));
  if (approvalsError) {
    // Don't hand out a link that would show no posts
    await supabase.from('client_approval_sessions').delete().eq('id', session.id);
    throw new ApprovalSessionError('Failed to create approval records', 500);
  }

  return session as { id: string; share_token: string; [key: string]: unknown };
}
