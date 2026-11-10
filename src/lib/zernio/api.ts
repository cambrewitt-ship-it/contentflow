import logger from '@/lib/logger'

// Small typed wrapper over Zernio's (LATE's) REST API for comments, webhooks, comment
// automations, accounts and post edits. Same key and base URL as the rest of the app.

const BASE = 'https://getlate.dev/api/v1'

export class ZernioError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public body?: unknown
  ) {
    super(message)
  }
}

export async function zernio<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: { query?: Record<string, string | number | undefined | null>; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) throw new ZernioError('LATE_API_KEY is not configured', 500)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const res = await fetch(`${BASE}${path}${qs.size ? `?${qs}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    cache: 'no-store',
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>
    const message = typeof d.error === 'string' ? d.error : typeof d.message === 'string' ? d.message : `Zernio ${method} ${path} failed (${res.status})`
    if (res.status >= 500) logger.error('Zernio API error', { method, path, status: res.status, body: text.slice(0, 400) })
    throw new ZernioError(message, res.status, typeof d.code === 'string' ? d.code : undefined, data)
  }
  return data as T
}

// ── Accounts ────────────────────────────────────────────────────────────────

export interface ZernioAccount {
  _id: string
  platform: string
  username?: string
  displayName?: string
}

export async function listAccounts(profileId: string): Promise<ZernioAccount[]> {
  const data = await zernio<{ accounts?: ZernioAccount[] }>('GET', '/accounts', { query: { profileId } })
  return data.accounts ?? []
}

// ── Comments ────────────────────────────────────────────────────────────────

export interface CommentedPost {
  id: string
  platform: string
  accountId: string
  accountUsername?: string
  content?: string | null
  picture?: string | null
  permalink?: string | null
  createdTime: string
  commentCount: number
  likeCount?: number
  isAd?: boolean
}

export async function listCommentedPosts(
  profileId: string,
  opts: { since?: string; platform?: string; limit?: number; cursor?: string; minComments?: number } = {}
): Promise<{ posts: CommentedPost[]; nextCursor: string | null; failedAccounts: Array<{ accountId: string; platform: string; error: string }> }> {
  const data = await zernio<{
    data?: CommentedPost[]
    pagination?: { hasMore?: boolean; nextCursor?: string | null }
    meta?: { failedAccounts?: Array<{ accountId: string; platform: string; error: string }> }
  }>('GET', '/inbox/comments', {
    query: {
      profileId,
      platform: opts.platform,
      since: opts.since,
      limit: opts.limit ?? 50,
      cursor: opts.cursor,
      minComments: opts.minComments,
      sortBy: 'date',
      sortOrder: 'desc',
    },
  })
  return {
    posts: (data.data ?? []).filter((p) => !p.isAd),
    nextCursor: data.pagination?.hasMore ? data.pagination.nextCursor ?? null : null,
    failedAccounts: data.meta?.failedAccounts ?? [],
  }
}

export interface ZernioComment {
  id: string
  message: string
  createdTime: string
  from?: { id?: string; name?: string; username?: string; picture?: string | null; isOwner?: boolean }
  likeCount?: number
  replyCount?: number
  platform?: string
  url?: string | null
  replies?: ZernioComment[]
  canReply?: boolean
  canDelete?: boolean
  canHide?: boolean
  canLike?: boolean
  isHidden?: boolean
  isLiked?: boolean
  parentId?: string | null
}

export interface PostComments {
  comments: ZernioComment[]
  post?: { thumbnailUrl?: string | null; permalink?: string | null; message?: string | null; text?: string | null } | null
}

export async function getPostComments(postId: string, accountId: string, limit = 50): Promise<PostComments> {
  const data = await zernio<{ comments?: ZernioComment[]; post?: PostComments['post'] }>(
    'GET',
    `/inbox/comments/${encodeURIComponent(postId)}`,
    { query: { accountId, limit } }
  )
  return { comments: data.comments ?? [], post: data.post ?? null }
}

export async function replyToComment(postId: string, accountId: string, message: string, commentId?: string) {
  return zernio<{ data?: { commentId?: string } }>('POST', `/inbox/comments/${encodeURIComponent(postId)}`, {
    body: { accountId, message, ...(commentId ? { commentId } : {}) },
  })
}

export async function setCommentHidden(postId: string, commentId: string, accountId: string, hidden: boolean) {
  return zernio(hidden ? 'POST' : 'DELETE', `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/hide`, {
    body: { accountId },
  })
}

export async function setCommentLiked(postId: string, commentId: string, accountId: string, liked: boolean) {
  return zernio(liked ? 'POST' : 'DELETE', `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/like`, {
    body: { accountId },
  })
}

export async function deleteComment(postId: string, commentId: string, accountId: string) {
  return zernio('DELETE', `/inbox/comments/${encodeURIComponent(postId)}`, { query: { accountId, commentId } })
}

export async function sendPrivateReply(postId: string, commentId: string, accountId: string, message: string) {
  return zernio('POST', `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/private-reply`, {
    body: { accountId, message },
  })
}

// ── Posts ───────────────────────────────────────────────────────────────────

/** Edit a published post's text (Facebook: only posts the app published). */
export async function editPublishedPost(latePostId: string, platform: string, content: string, accountId?: string) {
  return zernio('POST', `/posts/${encodeURIComponent(latePostId)}/edit`, {
    body: { platform, content, ...(accountId ? { accountId } : {}) },
  })
}

// ── Comment-to-DM automations ───────────────────────────────────────────────

export interface CommentAutomation {
  _id?: string
  id?: string
  name: string
  accountId: string
  platform?: string
  platformPostId?: string | null
  postTitle?: string | null
  keywords?: string[]
  matchMode?: string
  dmMessage?: string
  commentReply?: string
  isActive?: boolean
  stats?: Record<string, number>
}

export async function listAutomations(profileId: string): Promise<CommentAutomation[]> {
  const data = await zernio<{ automations?: CommentAutomation[]; data?: CommentAutomation[] }>('GET', '/comment-automations', {
    query: { profileId },
  })
  return data.automations ?? data.data ?? []
}

export async function createAutomation(body: Record<string, unknown>) {
  return zernio<{ automation?: CommentAutomation }>('POST', '/comment-automations', { body })
}

export async function updateAutomation(id: string, body: Record<string, unknown>) {
  return zernio('PATCH', `/comment-automations/${encodeURIComponent(id)}`, { body })
}

export async function deleteAutomation(id: string) {
  return zernio('DELETE', `/comment-automations/${encodeURIComponent(id)}`)
}

// ── Webhooks ────────────────────────────────────────────────────────────────

export interface ZernioWebhook {
  _id?: string
  id?: string
  name?: string
  url: string
  events?: string[]
  isActive?: boolean
}

export async function listWebhooks(): Promise<ZernioWebhook[]> {
  const data = await zernio<{ webhooks?: ZernioWebhook[] }>('GET', '/webhooks/settings')
  return data.webhooks ?? []
}

export async function createWebhook(body: { name: string; url: string; secret: string; events: string[] }) {
  return zernio('POST', '/webhooks/settings', { body: { ...body, isActive: true } })
}
