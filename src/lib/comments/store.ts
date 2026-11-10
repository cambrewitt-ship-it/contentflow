import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { completionParams } from '@/lib/openaiParams'
import {
  deleteComment,
  getPostComments,
  listCommentedPosts,
  replyToComment,
  sendPrivateReply,
  setCommentHidden,
  setCommentLiked,
  ZernioError,
  type ZernioComment,
} from '@/lib/zernio/api'
import {
  normalizeFeedAgentSettings,
  type CommentAction,
  type CommentCategory,
  type CommentRow,
  type FeedAgentSettings,
} from './types'

// Comments on clients' posts: synced from Zernio's Comments API (and pushed in real time
// by the comment.received webhook), triaged by the AI (sentiment, category, a reply in
// the brand's voice), moderated automatically when the Feed Checker is on, and handled
// from the Comments inbox. Table client_comments (migration 036).

const TABLE = 'client_comments'
export const COMMENTS_SETUP_MESSAGE = 'Comments need a one-off database update (migrations/036-comments-and-feed-checker.sql).'
export const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === '42703'

// Instagram and Facebook are where moderation works best; other platforms still sync
const SYNC_DAYS = 14
const MAX_POSTS_PER_SYNC = 25
const TRIAGE_BATCH = 40
const MAX_AUTO_ACTIONS = 40

type DbRow = Record<string, unknown>

export function toCommentRow(r: DbRow): CommentRow {
  return {
    id: r.id as string,
    platform: r.platform as string,
    accountId: r.account_id as string,
    platformCommentId: r.platform_comment_id as string,
    platformPostId: r.platform_post_id as string,
    parentCommentId: (r.parent_comment_id as string) ?? null,
    postText: (r.post_text as string) ?? null,
    postUrl: (r.post_url as string) ?? null,
    postThumbnail: (r.post_thumbnail as string) ?? null,
    authorName: (r.author_name as string) ?? null,
    authorUsername: (r.author_username as string) ?? null,
    authorPicture: (r.author_picture as string) ?? null,
    isOwn: !!r.is_own,
    message: (r.message as string) ?? '',
    commentUrl: (r.comment_url as string) ?? null,
    commentedAt: (r.commented_at as string) ?? null,
    canReply: !!r.can_reply,
    canHide: !!r.can_hide,
    canLike: !!r.can_like,
    canDelete: !!r.can_delete,
    isHidden: !!r.is_hidden,
    isLiked: !!r.is_liked,
    sentiment: (r.sentiment as CommentRow['sentiment']) ?? null,
    category: (r.category as CommentRow['category']) ?? null,
    needsReply: (r.needs_reply as boolean | null) ?? null,
    suggestedReply: (r.suggested_reply as string) ?? null,
    suggestedPrivateReply: (r.suggested_private_reply as string) ?? null,
    triageNote: (r.triage_note as string) ?? null,
    status: (r.status as CommentRow['status']) ?? 'new',
    replyText: (r.reply_text as string) ?? null,
    autoAction: (r.auto_action as CommentRow['autoAction']) ?? null,
    handledAt: (r.handled_at as string) ?? null,
  }
}

interface PostContext {
  clientId: string
  platform: string
  accountId: string
  postId: string
  postText: string | null
  postUrl: string | null
  postThumbnail: string | null
}

/** Flatten a thread (comments + replies) into table rows. Triage/handling columns are left alone on upsert. */
function threadToRows(ctx: PostContext, comments: ZernioComment[], parentId: string | null = null): DbRow[] {
  const rows: DbRow[] = []
  for (const c of comments) {
    if (!c?.id) continue
    rows.push({
      client_id: ctx.clientId,
      platform: ctx.platform,
      account_id: ctx.accountId,
      platform_comment_id: c.id,
      platform_post_id: ctx.postId,
      parent_comment_id: c.parentId ?? parentId,
      post_text: ctx.postText?.slice(0, 2000) ?? null,
      post_url: ctx.postUrl,
      post_thumbnail: ctx.postThumbnail,
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
      updated_at: new Date().toISOString(),
    })
    if (Array.isArray(c.replies) && c.replies.length) rows.push(...threadToRows(ctx, c.replies, c.id))
  }
  return rows
}

async function upsertRows(admin: SupabaseClient, rows: DbRow[]): Promise<number> {
  if (!rows.length) return 0
  const { error } = await admin.from(TABLE).upsert(rows, { onConflict: 'client_id,platform,platform_comment_id' })
  if (error) {
    if (isMissingTable(error)) throw error
    logger.error('Upsert comments failed:', error)
    return 0
  }
  return rows.length
}

/** Fetch one post's thread from Zernio and store it. Returns the stored rows' count. */
export async function syncPostThread(admin: SupabaseClient, ctx: PostContext): Promise<number> {
  const { comments, post } = await getPostComments(ctx.postId, ctx.accountId)
  const full: PostContext = {
    ...ctx,
    postText: ctx.postText ?? post?.message ?? post?.text ?? null,
    postUrl: ctx.postUrl ?? post?.permalink ?? null,
    postThumbnail: ctx.postThumbnail ?? post?.thumbnailUrl ?? null,
  }
  return upsertRows(admin, threadToRows(full, comments))
}

/** Pull recent comments for a client from Zernio. */
export async function syncClientComments(
  admin: SupabaseClient,
  clientId: string,
  opts: { days?: number; maxPosts?: number } = {}
): Promise<{ synced: number; posts: number }> {
  const { data: client } = await admin.from('clients').select('late_profile_id').eq('id', clientId).maybeSingle()
  const profileId = client?.late_profile_id as string | undefined
  if (!profileId) return { synced: 0, posts: 0 }

  const since = new Date(Date.now() - (opts.days ?? SYNC_DAYS) * 86_400_000).toISOString()
  const { posts } = await listCommentedPosts(profileId, { since, limit: 50, minComments: 1 })
  let synced = 0
  const targets = posts.filter((p) => p.commentCount > 0).slice(0, opts.maxPosts ?? MAX_POSTS_PER_SYNC)
  for (const p of targets) {
    try {
      synced += await syncPostThread(admin, {
        clientId,
        platform: p.platform,
        accountId: p.accountId,
        postId: p.id,
        postText: p.content ?? null,
        postUrl: p.permalink ?? null,
        postThumbnail: p.picture ?? null,
      })
    } catch (err) {
      if (isMissingTable(err as { code?: string })) throw err
      logger.warn('Comment thread sync failed', { clientId, postId: p.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { synced, posts: targets.length }
}

// ── AI triage ───────────────────────────────────────────────────────────────

const TRIAGE_PROMPT = `You are the community manager for a business, reviewing new comments on its social media posts.
For each comment decide:
- sentiment: positive | neutral | negative
- category: praise | question | complaint | spam | abuse | other
  (spam = promos, bots, "DM us to collab", crypto, link drops; abuse = insults, hate, harassment, profanity aimed at people)
- needs_reply: true for questions, complaints and comments that invite a response; false for spam/abuse and simple reactions (emojis, tags of friends)
- reply: a short public reply in the brand's voice (1-2 sentences, natural, not salesy, no hashtags). Empty for spam/abuse.
  For complaints: acknowledge, take it seriously, offer to sort it out privately. Never invent facts (prices, hours, stock) — if you'd need them, say you'll DM.
- private_reply: only on instagram/facebook, when the answer is better sent privately (pricing, bookings, personal details, complaints). Else "".
- note: a few words on why (e.g. "asks about opening hours").
Return JSON: {"results": [{"i": number, "sentiment": "...", "category": "...", "needs_reply": boolean, "reply": "...", "private_reply": "...", "note": "..."}]}`

export async function brandBrief(admin: SupabaseClient, clientId: string): Promise<string> {
  const { data: c } = await admin
    .from('clients')
    .select('name, company_description, brand_tone, brand_tov, caption_dos, caption_donts, region')
    .eq('id', clientId)
    .maybeSingle()
  if (!c) return ''
  return [
    `Business: ${c.name}`,
    c.company_description && `About: ${String(c.company_description).slice(0, 600)}`,
    c.brand_tone && `Tone: ${c.brand_tone}`,
    c.brand_tov && `Tone of voice guide (excerpt): ${String(c.brand_tov).slice(0, 2500)}`,
    c.caption_dos && `Do: ${String(c.caption_dos).slice(0, 400)}`,
    c.caption_donts && `Don't: ${String(c.caption_donts).slice(0, 400)}`,
    c.region && `Region (spelling/locale): ${c.region}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const CATEGORIES = new Set<CommentCategory>(['praise', 'question', 'complaint', 'spam', 'abuse', 'other'])

/** Triage untriaged comments (newest first). Own comments are marked done without AI. */
export async function triageComments(admin: SupabaseClient, clientId: string, onlyIds?: string[]): Promise<number> {
  await admin
    .from(TABLE)
    .update({ category: 'own', status: 'done', triaged_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('is_own', true)
    .is('triaged_at', null)

  let query = admin
    .from(TABLE)
    .select('id, platform, message, post_text, author_name, parent_comment_id')
    .eq('client_id', clientId)
    .eq('is_own', false)
    .is('triaged_at', null)
    .order('commented_at', { ascending: false })
    .limit(TRIAGE_BATCH)
  if (onlyIds?.length) query = query.in('id', onlyIds)
  const { data: rows, error } = await query
  if (error || !rows?.length || !process.env.OPENAI_API_KEY) return 0

  const brief = await brandBrief(admin, clientId)
  const input = rows.map((r, i) => ({
    i,
    platform: r.platform,
    post: String(r.post_text ?? '').slice(0, 200),
    author: r.author_name,
    is_reply: !!r.parent_comment_id,
    comment: String(r.message ?? '').slice(0, 600),
  }))
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 3000, temperature: 0.3 }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${TRIAGE_PROMPT}\n\nBRAND:\n${brief}` },
        { role: 'user', content: JSON.stringify(input) },
      ],
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}') as { results?: Array<Record<string, unknown>> }
    const now = new Date().toISOString()
    let done = 0
    for (const r of parsed.results ?? []) {
      const row = rows[Number(r.i)]
      if (!row) continue
      const category = CATEGORIES.has(r.category as CommentCategory) ? (r.category as CommentCategory) : 'other'
      const sentiment = ['positive', 'neutral', 'negative'].includes(String(r.sentiment)) ? String(r.sentiment) : 'neutral'
      const needsReply = r.needs_reply === true && category !== 'spam' && category !== 'abuse'
      await admin
        .from(TABLE)
        .update({
          sentiment,
          category,
          needs_reply: needsReply,
          suggested_reply: typeof r.reply === 'string' && r.reply.trim() ? r.reply.trim().slice(0, 1000) : null,
          suggested_private_reply:
            typeof r.private_reply === 'string' && r.private_reply.trim() && (row.platform === 'instagram' || row.platform === 'facebook')
              ? r.private_reply.trim().slice(0, 1000)
              : null,
          triage_note: typeof r.note === 'string' ? r.note.slice(0, 200) : null,
          triaged_at: now,
          // Nothing to do on reactions that need no reply
          ...(needsReply ? {} : { status: 'done' }),
        })
        .eq('id', row.id)
        .eq('status', 'new')
      done++
    }
    return done
  } catch (err) {
    logger.error('Comment triage failed:', err)
    return 0
  }
}

// ── Feed Checker moderation ─────────────────────────────────────────────────

export async function getFeedAgentSettings(admin: SupabaseClient, clientId: string): Promise<FeedAgentSettings> {
  const { data } = await admin.from('clients').select('feed_agent_settings').eq('id', clientId).maybeSingle()
  return normalizeFeedAgentSettings(data?.feed_agent_settings)
}

/**
 * Hide spam/abuse (or every negative comment) and like positive ones — what the Feed
 * Checker does on its own. Only acts on comments from the last 7 days that nobody has
 * handled yet, and records each action (auto_action) so it can be reviewed or undone.
 */
export async function autoModerate(
  admin: SupabaseClient,
  clientId: string,
  settings: FeedAgentSettings
): Promise<{ hidden: number; liked: number; hearted: number }> {
  const result = { hidden: 0, liked: 0, hearted: 0 }
  if (!settings.enabled) return result
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: rows } = await admin
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .eq('is_own', false)
    .is('auto_action', null)
    .not('triaged_at', 'is', null)
    .gte('commented_at', since)
    .in('status', ['new', 'done'])
    .order('commented_at', { ascending: false })
    .limit(200)

  let actions = 0
  for (const raw of rows ?? []) {
    if (actions >= MAX_AUTO_ACTIONS) break
    const c = toCommentRow(raw)
    const hideIt =
      settings.autoHide !== 'off' &&
      !c.isHidden &&
      (c.category === 'spam' || c.category === 'abuse' || (settings.autoHide === 'negative' && c.sentiment === 'negative'))
    try {
      if (hideIt) {
        if (!c.canHide) continue
        await setCommentHidden(c.platformPostId, c.platformCommentId, c.accountId, true)
        await admin
          .from(TABLE)
          .update({ is_hidden: true, status: 'hidden', auto_action: 'hidden', handled_at: new Date().toISOString() })
          .eq('id', c.id)
        result.hidden++
        actions++
      } else if (settings.autoLike && c.sentiment === 'positive' && !c.isLiked) {
        let liked = false
        if (c.canLike || c.platform === 'instagram') {
          try {
            await setCommentLiked(c.platformPostId, c.platformCommentId, c.accountId, true)
            liked = true
          } catch (err) {
            // Instagram likes are in Meta's limited release — fall back below
            if (!(err instanceof ZernioError)) throw err
          }
        }
        if (liked) {
          await admin.from(TABLE).update({ is_liked: true, auto_action: 'liked' }).eq('id', c.id)
          result.liked++
          actions++
        } else if (settings.heartReplyFallback && c.canReply && !c.parentCommentId) {
          await replyToComment(c.platformPostId, c.accountId, '❤️', c.platformCommentId)
          await admin.from(TABLE).update({ auto_action: 'hearted', reply_text: '❤️' }).eq('id', c.id)
          result.hearted++
          actions++
        }
      }
    } catch (err) {
      logger.warn('Auto-moderation action failed', { clientId, commentId: c.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return result
}

// ── Actions from the inbox ──────────────────────────────────────────────────

export class CommentActionError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export async function performCommentAction(
  admin: SupabaseClient,
  clientId: string,
  rowId: string,
  action: CommentAction,
  opts: { message?: string; userId?: string | null } = {}
): Promise<CommentRow> {
  const { data: raw } = await admin.from(TABLE).select('*').eq('id', rowId).eq('client_id', clientId).maybeSingle()
  if (!raw) throw new CommentActionError('Comment not found', 404)
  const c = toCommentRow(raw)
  const now = new Date().toISOString()
  const handled = { handled_at: now, handled_by: opts.userId ?? null }
  const message = (opts.message ?? '').trim()
  let patch: DbRow = {}

  try {
    switch (action) {
      case 'reply':
        if (!message) throw new CommentActionError('Write a reply first')
        await replyToComment(c.platformPostId, c.accountId, message, c.platformCommentId)
        patch = { status: 'replied', reply_text: message, ...handled }
        break
      case 'private_reply':
        if (!message) throw new CommentActionError('Write a message first')
        if (c.platform !== 'instagram' && c.platform !== 'facebook') throw new CommentActionError('Private replies work on Instagram and Facebook only')
        await sendPrivateReply(c.platformPostId, c.platformCommentId, c.accountId, message)
        patch = { status: 'replied', reply_text: `(DM) ${message}`, ...handled }
        break
      case 'hide':
      case 'unhide':
        await setCommentHidden(c.platformPostId, c.platformCommentId, c.accountId, action === 'hide')
        patch = action === 'hide' ? { is_hidden: true, status: 'hidden', ...handled } : { is_hidden: false, status: 'done', auto_action: null, ...handled }
        break
      case 'like':
      case 'unlike':
        await setCommentLiked(c.platformPostId, c.platformCommentId, c.accountId, action === 'like')
        patch = { is_liked: action === 'like', ...(action === 'unlike' && c.autoAction === 'liked' ? { auto_action: null } : {}) }
        break
      case 'delete':
        await deleteComment(c.platformPostId, c.platformCommentId, c.accountId)
        patch = { status: 'deleted', ...handled }
        break
      case 'done':
        patch = { status: 'done', ...handled }
        break
      case 'reopen':
        patch = { status: 'new', handled_at: null, handled_by: null }
        break
    }
  } catch (err) {
    if (err instanceof CommentActionError) throw err
    if (err instanceof ZernioError) {
      const consumed = (err.body as { details?: { privateReplyConsumed?: boolean } })?.details?.privateReplyConsumed
      throw new CommentActionError(
        consumed
          ? 'This comment already got its one private reply.'
          : err.code === 'PLATFORM_BETA_RESTRICTED'
            ? "Meta doesn't allow liking Instagram comments through the API yet."
            : err.message,
        err.status >= 500 ? 502 : 400
      )
    }
    throw err
  }

  const { data: updated } = await admin.from(TABLE).update({ ...patch, updated_at: now }).eq('id', c.id).select('*').single()
  return toCommentRow(updated ?? raw)
}

// ── Webhook ingest ──────────────────────────────────────────────────────────

/** A comment.received event: store it and triage it straight away. Returns the client id when stored. */
export async function ingestCommentEvent(admin: SupabaseClient, event: Record<string, unknown>): Promise<string | null> {
  const comment = event.comment as Record<string, unknown> | undefined
  const account = event.account as Record<string, unknown> | undefined
  const post = event.post as Record<string, unknown> | undefined
  const profiles = Array.isArray(event.profiles) ? (event.profiles as Array<{ id?: string }>) : []
  if (!comment || !account) return null

  const profileIds = profiles.map((p) => p.id).filter(Boolean) as string[]
  if (!profileIds.length) return null
  const { data: client } = await admin.from('clients').select('id').in('late_profile_id', profileIds).limit(1).maybeSingle()
  if (!client) return null

  const author = (comment.author ?? {}) as Record<string, unknown>
  const platform = String(comment.platform ?? account.platform ?? '')
  const row: DbRow = {
    client_id: client.id,
    platform,
    account_id: String(account.accountId ?? account.id ?? ''),
    platform_comment_id: String(comment.id),
    platform_post_id: String(comment.platformPostId ?? post?.platformPostId ?? ''),
    parent_comment_id: (comment.parentCommentId as string) ?? null,
    post_text: typeof post?.content === 'string' ? post.content.slice(0, 2000) : null,
    post_url: (post?.permalink as string) ?? null,
    post_thumbnail: (post?.imageUrl as string) ?? null,
    author_id: (author.id as string) ?? null,
    author_name: (author.name as string) ?? null,
    author_username: (author.username as string) ?? null,
    author_picture: (author.picture as string) ?? null,
    is_own: author.isOwnAccount === true,
    message: String(comment.text ?? '').slice(0, 5000),
    commented_at: (comment.createdAt as string) ?? new Date().toISOString(),
    can_reply: true,
    can_hide: ['instagram', 'facebook', 'threads', 'tiktok'].includes(platform),
    can_like: ['facebook', 'tiktok', 'linkedin', 'bluesky'].includes(platform),
    can_delete: ['instagram', 'facebook', 'youtube', 'linkedin'].includes(platform),
    updated_at: new Date().toISOString(),
  }
  await upsertRows(admin, [row])
  return client.id as string
}

// ── Summaries for the AI, dashboard and reports ─────────────────────────────

export interface AudienceSummary {
  total: number
  positive: number
  negative: number
  questions: string[]
  complaints: string[]
  needsReply: number
}

export async function getAudienceSummary(
  admin: SupabaseClient,
  clientId: string,
  days = 30,
  range?: { from: string; to: string }
): Promise<AudienceSummary | null> {
  const since = range?.from ?? new Date(Date.now() - days * 86_400_000).toISOString()
  let query = admin
    .from(TABLE)
    .select('message, sentiment, category, status, needs_reply')
    .eq('client_id', clientId)
    .eq('is_own', false)
    .gte('commented_at', since)
  if (range?.to) query = query.lte('commented_at', range.to)
  const { data, error } = await query.order('commented_at', { ascending: false }).limit(1000)
  if (error || !data) return null
  const pick = (cat: string, n: number) => {
    const seen = new Set<string>()
    return data
      .filter((r) => r.category === cat && typeof r.message === 'string' && r.message.trim().length > 6)
      .map((r) => String(r.message).replace(/\s+/g, ' ').trim().slice(0, 160))
      .filter((m) => {
        const k = m.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, n)
  }
  return {
    total: data.length,
    positive: data.filter((r) => r.sentiment === 'positive').length,
    negative: data.filter((r) => r.sentiment === 'negative').length,
    questions: pick('question', 8),
    complaints: pick('complaint', 5),
    needsReply: data.filter((r) => r.status === 'new' && r.needs_reply === true).length,
  }
}

/** "What the audience is saying" for caption and agent prompts — questions make good post ideas. */
export function formatAudiencePrompt(s: AudienceSummary | null): string {
  if (!s || s.total < 3) return ''
  const lines = [
    `💬 WHAT THE AUDIENCE IS SAYING (last 30 days, ${s.total} comments: ${s.positive} positive, ${s.negative} negative):`,
  ]
  if (s.questions.length) {
    lines.push('Questions people keep asking (answer these in posts — they make great content ideas):')
    s.questions.forEach((q) => lines.push(`- "${q}"`))
  }
  if (s.complaints.length) {
    lines.push('Concerns raised (address them where it fits, never defensively):')
    s.complaints.forEach((q) => lines.push(`- "${q}"`))
  }
  return lines.join('\n')
}

export async function listComments(
  admin: SupabaseClient,
  clientId: string,
  filter: { view?: 'needs_reply' | 'all' | 'questions' | 'negative' | 'hidden' | 'auto'; postId?: string; limit?: number }
): Promise<CommentRow[] | 'missing_table'> {
  let q = admin.from(TABLE).select('*').eq('client_id', clientId)
  switch (filter.view) {
    case 'needs_reply':
      q = q.eq('status', 'new').eq('is_own', false)
      break
    case 'questions':
      q = q.eq('category', 'question')
      break
    case 'negative':
      q = q.or('sentiment.eq.negative,category.in.(spam,abuse,complaint)')
      break
    case 'hidden':
      q = q.eq('is_hidden', true)
      break
    case 'auto':
      q = q.not('auto_action', 'is', null)
      break
    default:
      q = q.neq('status', 'deleted')
  }
  if (filter.postId) q = q.eq('platform_post_id', filter.postId)
  const { data, error } = await q.order('commented_at', { ascending: false }).limit(filter.limit ?? 150)
  if (error) {
    if (isMissingTable(error)) return 'missing_table'
    throw error
  }
  return (data ?? []).map(toCommentRow)
}
