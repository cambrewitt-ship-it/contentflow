import crypto from 'crypto'
import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { completionParams } from '@/lib/openaiParams'
import { normalizeTimeOfDay, zonedLocalToUtcMs } from '@/lib/lateReschedule'
import { createNotification } from '@/lib/notifications'
import { brandBrief, getFeedAgentSettings } from '@/lib/comments/store'
import { refreshComments } from '@/lib/comments/sync'
import { getPostComments, listAccounts, listCommentedPosts, replyToComment, type CommentedPost } from '@/lib/zernio/api'
import type { FeedAgentRunSummary, FeedCheck, FeedIssue, FeedIssueType } from '@/lib/comments/types'

// The Feed Checker: an agent that goes over a client's Facebook and Instagram feed the
// way a careful social media manager would — spelling and grammar, the brand's tone of
// voice, posts that say "link in comments" with no link there — checks upcoming posts
// before they go out, posts pending "first comments", and moderates comments (hide
// spam/abuse or negativity, like the good ones; see comments/store autoModerate).
// Findings live in client_feed_checks (migration 036).

const TABLE = 'client_feed_checks'
const FEED_PLATFORMS = new Set(['instagram', 'facebook'])
const MAX_POSTS_PER_RUN = 20
const AI_BATCH = 8

// "Link in comments", "link in the first comment", "check the comments for the link", "comment below for the link"...
const LINK_IN_COMMENTS_RE =
  /\b(link|url|details|info|tickets?|menu|order|booking|book|register|sign[ -]?up|shop)\b[^.!?\n]{0,30}\b(in|on|below in)\s+(the\s+)?(first\s+|1st\s+)?comments?\b|\b(check|see)\s+(the\s+)?(first\s+)?comments?\b[^.!?\n]{0,20}\b(link|url|details|info)\b|\blink\s+(is\s+)?(below|in comments?)\b/i
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|co\.nz|nz|co\.uk|com\.au|au|co|io|shop|store|org|net)(\/\S*)?\b/i

export const mentionsLinkInComments = (text: string) => LINK_IN_COMMENTS_RE.test(text)
export const containsLink = (text: string) => URL_RE.test(text)

const hash = (text: string) => crypto.createHash('sha1').update(text.trim()).digest('hex')

type DbRow = Record<string, unknown>

export function toFeedCheck(r: DbRow): FeedCheck {
  return {
    id: r.id as string,
    source: r.source as FeedCheck['source'],
    platform: r.platform as string,
    postRef: r.post_ref as string,
    accountId: (r.account_id as string) ?? null,
    latePostId: (r.late_post_id as string) ?? null,
    calendarPostId: (r.calendar_post_id as string) ?? null,
    postText: (r.post_text as string) ?? null,
    postUrl: (r.post_url as string) ?? null,
    postThumbnail: (r.post_thumbnail as string) ?? null,
    postedAt: (r.posted_at as string) ?? null,
    issues: Array.isArray(r.issues) ? (r.issues as FeedIssue[]) : [],
    tovScore: (r.tov_score as number) ?? null,
    suggestedCaption: (r.suggested_caption as string) ?? null,
    status: r.status as FeedCheck['status'],
    checkedAt: r.checked_at as string,
    canApplyFix: r.source === 'published' && r.platform === 'facebook' && !!r.late_post_id && !!r.suggested_caption,
  }
}

// ── AI review: spelling, grammar, tone of voice ─────────────────────────────

const REVIEW_PROMPT = `You are the senior editor checking a business's social media posts before (or after) they go out.
For each post, report ONLY real problems:
- spelling: misspelled words (respect the brand's region spelling, e.g. NZ/UK English "colour", "organise"; brand names, product names, te reo Māori and other proper nouns are not mistakes; hashtags are not checked for spelling)
- grammar: clear grammatical errors, missing words, doubled words, broken sentences
- tone_of_voice: clear departures from the brand's tone of voice guide or caption rules (banned words, wrong register, emoji/hashtag rules broken). Not personal taste.
- other: anything else that would embarrass the brand (wrong day/date words like "this Tuesday" next to a clashing date, an unfinished sentence, placeholder text like [link])
Do not nitpick style, punctuation preferences or emoji use unless the brand's rules forbid it.
For each issue give: type, severity (high = embarrassing/visible, medium, low), excerpt (the exact wrong text), suggestion (the fix), detail (one short sentence).
Also give tov_score 1-10 (10 = perfectly on-brand) and, only when there are spelling/grammar issues, corrected_caption: the full caption with ONLY those errors fixed (keep everything else, including hashtags and emojis, identical). Otherwise "".
Return JSON: {"results": [{"i": number, "issues": [...], "tov_score": number, "corrected_caption": "..."}]}`

interface ReviewInput {
  i: number
  platform: string
  caption: string
}

interface ReviewResult {
  issues: FeedIssue[]
  tovScore: number | null
  corrected: string | null
}

const ISSUE_TYPES = new Set<FeedIssueType>(['spelling', 'grammar', 'tone_of_voice', 'other'])

async function reviewCaptions(brief: string, posts: ReviewInput[]): Promise<Map<number, ReviewResult>> {
  const out = new Map<number, ReviewResult>()
  if (!posts.length || !process.env.OPENAI_API_KEY) return out
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  for (let start = 0; start < posts.length; start += AI_BATCH) {
    const batch = posts.slice(start, start + AI_BATCH)
    try {
      const completion = await openai.chat.completions.create({
        ...completionParams(process.env.OPENAI_MODEL || 'gpt-4o', { maxTokens: 4000, temperature: 0 }),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${REVIEW_PROMPT}\n\nBRAND:\n${brief}` },
          { role: 'user', content: JSON.stringify(batch.map((p) => ({ i: p.i, platform: p.platform, caption: p.caption.slice(0, 2500) }))) },
        ],
      })
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}') as { results?: Array<Record<string, unknown>> }
      for (const r of parsed.results ?? []) {
        const issues = (Array.isArray(r.issues) ? r.issues : [])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({
            type: (ISSUE_TYPES.has(x.type as FeedIssueType) ? x.type : 'other') as FeedIssueType,
            severity: (['high', 'medium', 'low'].includes(String(x.severity)) ? x.severity : 'medium') as FeedIssue['severity'],
            detail: String(x.detail ?? '').slice(0, 300),
            ...(typeof x.excerpt === 'string' && x.excerpt ? { excerpt: x.excerpt.slice(0, 200) } : {}),
            ...(typeof x.suggestion === 'string' && x.suggestion ? { suggestion: x.suggestion.slice(0, 300) } : {}),
          }))
          .filter((x) => x.detail || x.excerpt)
          .slice(0, 10)
        out.set(Number(r.i), {
          issues,
          tovScore: typeof r.tov_score === 'number' ? Math.max(1, Math.min(10, Math.round(r.tov_score))) : null,
          corrected: typeof r.corrected_caption === 'string' && r.corrected_caption.trim() ? r.corrected_caption : null,
        })
      }
    } catch (err) {
      logger.error('Feed review batch failed:', err)
    }
  }
  return out
}

// ── Published posts ─────────────────────────────────────────────────────────

async function ownLinkInComments(post: CommentedPost, admin: SupabaseClient, clientId: string): Promise<boolean> {
  if (post.commentCount === 0) return false
  // Already-synced comments first, then the live thread
  const { data } = await admin
    .from('client_comments')
    .select('message')
    .eq('client_id', clientId)
    .eq('platform_post_id', post.id)
    .eq('is_own', true)
  if ((data ?? []).some((r) => containsLink(String(r.message ?? '')))) return true
  try {
    const { comments } = await getPostComments(post.id, post.accountId, 50)
    const all = comments.flatMap((c) => [c, ...(c.replies ?? [])])
    return all.some((c) => c.from?.isOwner === true && containsLink(c.message ?? ''))
  } catch {
    return true // can't tell — don't raise a false alarm
  }
}

/** Zernio post ids of the app's own published posts, matched by caption, so Facebook fixes can be applied. */
async function latePostIdsByCaption(admin: SupabaseClient, clientId: string): Promise<Map<string, string>> {
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('caption, late_post_id')
    .eq('client_id', clientId)
    .not('late_post_id', 'is', null)
    .gte('scheduled_date', since)
  const map = new Map<string, string>()
  for (const r of data ?? []) {
    const key = String(r.caption ?? '').replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase()
    if (key) map.set(key, r.late_post_id as string)
  }
  return map
}

async function existingChecks(admin: SupabaseClient, clientId: string, source: string): Promise<Map<string, DbRow>> {
  const { data } = await admin.from(TABLE).select('id, post_ref, platform, content_hash, status').eq('client_id', clientId).eq('source', source)
  return new Map((data ?? []).map((r) => [`${r.platform}:${r.post_ref}`, r]))
}

async function saveCheck(admin: SupabaseClient, row: DbRow, prev: DbRow | undefined) {
  const issues = row.issues as FeedIssue[]
  // A post someone already resolved or ignored stays that way unless its text changed
  const keepStatus = prev && prev.content_hash === row.content_hash && (prev.status === 'resolved' || prev.status === 'ignored')
  await admin.from(TABLE).upsert(
    {
      ...row,
      status: keepStatus ? prev!.status : issues.length ? 'open' : 'ok',
      checked_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,source,platform,post_ref' }
  )
}

export async function checkPublishedPosts(admin: SupabaseClient, clientId: string, profileId: string, brief: string): Promise<{ checked: number; issues: number }> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { posts } = await listCommentedPosts(profileId, { since, limit: 50 })
  const feed = posts.filter((p) => FEED_PLATFORMS.has(p.platform) && (p.content ?? '').trim()).slice(0, MAX_POSTS_PER_RUN)
  const existing = await existingChecks(admin, clientId, 'published')
  const toCheck = feed.filter((p) => {
    const prev = existing.get(`${p.platform}:${p.id}`)
    return !prev || prev.content_hash !== hash(p.content ?? '')
  })
  if (!toCheck.length) return { checked: 0, issues: 0 }

  const reviews = await reviewCaptions(
    brief,
    toCheck.map((p, i) => ({ i, platform: p.platform, caption: p.content ?? '' }))
  )
  const lateIds = await latePostIdsByCaption(admin, clientId)
  let issueCount = 0
  for (const [i, p] of toCheck.entries()) {
    const caption = p.content ?? ''
    const review = reviews.get(i) ?? { issues: [], tovScore: null, corrected: null }
    const issues = [...review.issues]
    if (mentionsLinkInComments(caption) && !(await ownLinkInComments(p, admin, clientId))) {
      issues.unshift({
        type: 'missing_link',
        severity: 'high',
        detail: 'The post tells people the link is in the comments, but there is no link from the account in the comments.',
        suggestion: 'Add the link as a comment now.',
      })
    }
    issueCount += issues.length
    await saveCheck(
      admin,
      {
        client_id: clientId,
        source: 'published',
        platform: p.platform,
        post_ref: p.id,
        account_id: p.accountId,
        late_post_id: lateIds.get(caption.replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase()) ?? null,
        post_text: caption.slice(0, 5000),
        post_url: p.permalink ?? null,
        post_thumbnail: p.picture ?? null,
        posted_at: p.createdTime,
        content_hash: hash(caption),
        issues,
        tov_score: review.tovScore,
        suggested_caption: review.corrected,
      },
      existing.get(`${p.platform}:${p.id}`)
    )
  }
  return { checked: toCheck.length, issues: issueCount }
}

// ── Upcoming calendar posts ─────────────────────────────────────────────────

export async function checkScheduledPosts(admin: SupabaseClient, clientId: string, brief: string): Promise<{ checked: number; issues: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await admin
    .from('calendar_scheduled_posts')
    .select('id, caption, image_url, scheduled_date, scheduled_time, first_comment, late_post_id')
    .eq('client_id', clientId)
    .gte('scheduled_date', today)
    .lte('scheduled_date', in7)
    .limit(40)
  const posts = (data ?? []).filter((p) => String(p.caption ?? '').trim())
  const existing = await existingChecks(admin, clientId, 'scheduled')
  const toCheck = posts.filter((p) => {
    const prev = existing.get(`calendar:${p.id}`)
    return !prev || prev.content_hash !== hash(`${p.caption}\n${p.first_comment ?? ''}`)
  })
  if (!toCheck.length) return { checked: 0, issues: 0 }

  const reviews = await reviewCaptions(
    brief,
    toCheck.map((p, i) => ({ i, platform: 'instagram/facebook', caption: String(p.caption) }))
  )
  let issueCount = 0
  for (const [i, p] of toCheck.entries()) {
    const caption = String(p.caption)
    const review = reviews.get(i) ?? { issues: [], tovScore: null, corrected: null }
    const issues = [...review.issues]
    if (mentionsLinkInComments(caption) && !containsLink(String(p.first_comment ?? ''))) {
      issues.unshift({
        type: 'link_reminder',
        severity: 'high',
        detail: 'The caption says the link is in the comments, but no first comment with a link is set.',
        suggestion: 'Add the link in this post’s “First comment” field so it’s posted as soon as the post goes live.',
      })
    }
    issueCount += issues.length
    await saveCheck(
      admin,
      {
        client_id: clientId,
        source: 'scheduled',
        platform: 'calendar',
        post_ref: p.id,
        calendar_post_id: p.id,
        late_post_id: (p.late_post_id as string) ?? null,
        post_text: caption.slice(0, 5000),
        post_thumbnail: (p.image_url as string) ?? null,
        posted_at: p.scheduled_date ? `${p.scheduled_date}T${p.scheduled_time || '12:00:00'}` : null,
        content_hash: hash(`${caption}\n${p.first_comment ?? ''}`),
        issues,
        tov_score: review.tovScore,
        suggested_caption: review.corrected,
      },
      existing.get(`calendar:${p.id}`)
    )
  }
  return { checked: toCheck.length, issues: issueCount }
}

// ── First comments ──────────────────────────────────────────────────────────

/**
 * Post pending "first comments" once a post is live. Zernio posts them on Facebook when
 * they were set before scheduling; Instagram (and a first comment added later) is done
 * here. Each platform is checked for an existing comment from the account first, so a
 * first comment is never posted twice.
 */
export async function postPendingFirstComments(admin: SupabaseClient, clientId: string, profileId: string): Promise<number> {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('calendar_scheduled_posts')
    .select('id, first_comment, late_post_id, scheduled_date, scheduled_time, platforms_scheduled')
    .eq('client_id', clientId)
    .not('first_comment', 'is', null)
    .is('first_comment_posted_at', null)
    .not('late_post_id', 'is', null)
    .gte('scheduled_date', since)
  if (error || !data?.length) return 0
  const { data: client } = await admin.from('clients').select('timezone').eq('id', clientId).maybeSingle()
  const tz = (client?.timezone as string) || 'Pacific/Auckland'
  const due = data.filter((p) => {
    const time = normalizeTimeOfDay(String(p.scheduled_time ?? '')) ?? '12:00:00'
    const at = zonedLocalToUtcMs(`${p.scheduled_date}T${time}`, tz)
    // 15 minutes after going live, so Zernio's own Facebook first comment is already there
    return String(p.first_comment ?? '').trim() && !Number.isNaN(at) && at < Date.now() - 15 * 60_000
  })
  if (!due.length) return 0

  const accounts = (await listAccounts(profileId)).filter((a) => FEED_PLATFORMS.has(a.platform))
  let posted = 0
  for (const p of due) {
    const message = String(p.first_comment).trim()
    const platforms = ((p.platforms_scheduled as string[] | null) ?? []).filter((x) => FEED_PLATFORMS.has(x))
    let allDone = true
    for (const platform of platforms) {
      let doneHere = false
      for (const account of accounts.filter((a) => a.platform === platform)) {
        try {
          const { comments } = await getPostComments(p.late_post_id as string, account._id, 50)
          const already = comments.some((c) => c.from?.isOwner === true && (c.message ?? '').includes(message.slice(0, 40)))
          if (!already) {
            await replyToComment(p.late_post_id as string, account._id, message)
            posted++
          }
          doneHere = true
          break
        } catch {
          // Not live yet, or not on this account
        }
      }
      if (!doneHere) allDone = false
    }
    if (allDone) await admin.from('calendar_scheduled_posts').update({ first_comment_posted_at: new Date().toISOString() }).eq('id', p.id)
  }
  return posted
}

// ── The run ─────────────────────────────────────────────────────────────────

export async function runFeedChecker(
  admin: SupabaseClient,
  clientId: string,
  opts: { force?: boolean; notify?: boolean } = {}
): Promise<FeedAgentRunSummary | null> {
  const settings = await getFeedAgentSettings(admin, clientId)
  if (!settings.enabled && !opts.force) return null
  const { data: client } = await admin
    .from('clients')
    .select('name, user_id, late_profile_id, feed_agent_last_run')
    .eq('id', clientId)
    .maybeSingle()
  if (!client?.late_profile_id) return null
  const profileId = client.late_profile_id as string

  const summary: FeedAgentRunSummary = {
    ranAt: new Date().toISOString(),
    postsChecked: 0,
    issuesFound: 0,
    commentsSynced: 0,
    autoHidden: 0,
    autoLiked: 0,
    autoHearted: 0,
    firstCommentsPosted: 0,
    needsReply: 0,
  }

  summary.firstCommentsPosted = await postPendingFirstComments(admin, clientId, profileId).catch((err) => {
    logger.warn('First comments failed', { clientId, err: String(err) })
    return 0
  })

  const comments = await refreshComments(admin, clientId, { force: true }).catch((err) => {
    logger.warn('Feed Checker comment refresh failed', { clientId, err: String(err) })
    return null
  })
  if (comments) {
    summary.commentsSynced = comments.synced
    summary.autoHidden = comments.hidden
    summary.autoLiked = comments.liked
    summary.autoHearted = comments.hearted
  }

  const brief = await brandBrief(admin, clientId)
  if (settings.checkPosts || opts.force) {
    const published = await checkPublishedPosts(admin, clientId, profileId, brief).catch((err) => {
      logger.warn('Published post checks failed', { clientId, err: String(err) })
      return { checked: 0, issues: 0 }
    })
    summary.postsChecked += published.checked
    summary.issuesFound += published.issues
  }
  if (settings.checkScheduled || opts.force) {
    const scheduled = await checkScheduledPosts(admin, clientId, brief).catch((err) => {
      logger.warn('Scheduled post checks failed', { clientId, err: String(err) })
      return { checked: 0, issues: 0 }
    })
    summary.postsChecked += scheduled.checked
    summary.issuesFound += scheduled.issues
  }

  const { count } = await admin
    .from('client_comments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'new')
    .eq('is_own', false)
  summary.needsReply = count ?? 0

  const previous = (client.feed_agent_last_run ?? {}) as Record<string, unknown>
  await admin.from('clients').update({ feed_agent_last_run: { ...previous, summary } }).eq('id', clientId)

  if (opts.notify !== false && client.user_id && (summary.issuesFound > 0 || summary.autoHidden > 0)) {
    const parts = [
      summary.issuesFound && `${summary.issuesFound} issue${summary.issuesFound === 1 ? '' : 's'} in posts`,
      summary.autoHidden && `${summary.autoHidden} comment${summary.autoHidden === 1 ? '' : 's'} hidden`,
      summary.needsReply && `${summary.needsReply} comment${summary.needsReply === 1 ? '' : 's'} waiting for a reply`,
    ].filter(Boolean)
    await createNotification({
      userId: client.user_id as string,
      clientId,
      type: 'feed_check_issues',
      title: `Feed Checker: ${client.name}`,
      body: parts.join(' · '),
      link: `/dashboard/client/${clientId}/feed-checker`,
      metadata: { ...summary },
    })
  }
  return summary
}

export async function listFeedChecks(admin: SupabaseClient, clientId: string, view: 'open' | 'all' = 'open'): Promise<FeedCheck[] | 'missing_table'> {
  let q = admin.from(TABLE).select('*').eq('client_id', clientId)
  q = view === 'open' ? q.eq('status', 'open') : q.neq('status', 'ok')
  const { data, error } = await q.order('checked_at', { ascending: false }).limit(100)
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return 'missing_table'
    throw error
  }
  return (data ?? []).map(toFeedCheck)
}
