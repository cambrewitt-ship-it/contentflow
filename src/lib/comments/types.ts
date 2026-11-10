// Shared (browser + server) types for the comments inbox and the Feed Checker.

export type CommentSentiment = 'positive' | 'neutral' | 'negative'
export type CommentCategory = 'praise' | 'question' | 'complaint' | 'spam' | 'abuse' | 'other' | 'own'
export type CommentStatus = 'new' | 'replied' | 'done' | 'hidden' | 'deleted'

export interface CommentRow {
  id: string
  platform: string
  accountId: string
  platformCommentId: string
  platformPostId: string
  parentCommentId: string | null
  postText: string | null
  postUrl: string | null
  postThumbnail: string | null
  authorName: string | null
  authorUsername: string | null
  authorPicture: string | null
  isOwn: boolean
  message: string
  commentUrl: string | null
  commentedAt: string | null
  canReply: boolean
  canHide: boolean
  canLike: boolean
  canDelete: boolean
  isHidden: boolean
  isLiked: boolean
  sentiment: CommentSentiment | null
  category: CommentCategory | null
  needsReply: boolean | null
  suggestedReply: string | null
  suggestedPrivateReply: string | null
  triageNote: string | null
  status: CommentStatus
  replyText: string | null
  autoAction: 'hidden' | 'liked' | 'hearted' | null
  handledAt: string | null
}

export type CommentAction =
  | 'reply'
  | 'private_reply'
  | 'hide'
  | 'unhide'
  | 'like'
  | 'unlike'
  | 'delete'
  | 'done'
  | 'reopen'

export interface FeedAgentSettings {
  /** Feed Checker on: daily post checks and comment moderation */
  enabled: boolean
  /** Check published posts for spelling, tone of voice and missing "link in comments" links */
  checkPosts: boolean
  /** Also check upcoming calendar posts before they go out */
  checkScheduled: boolean
  /** Hide nothing / spam and abuse / every negative comment */
  autoHide: 'off' | 'spam_abuse' | 'negative'
  /** Like positive comments (Facebook; Instagram where Meta allows it) */
  autoLike: boolean
  /** Where a like isn't possible (Instagram), reply with a ❤️ instead */
  heartReplyFallback: boolean
}

export const DEFAULT_FEED_AGENT_SETTINGS: FeedAgentSettings = {
  enabled: false,
  checkPosts: true,
  checkScheduled: true,
  autoHide: 'spam_abuse',
  autoLike: true,
  heartReplyFallback: false,
}

export function normalizeFeedAgentSettings(raw: unknown): FeedAgentSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_FEED_AGENT_SETTINGS
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    checkPosts: typeof r.checkPosts === 'boolean' ? r.checkPosts : d.checkPosts,
    checkScheduled: typeof r.checkScheduled === 'boolean' ? r.checkScheduled : d.checkScheduled,
    autoHide: r.autoHide === 'off' || r.autoHide === 'spam_abuse' || r.autoHide === 'negative' ? r.autoHide : d.autoHide,
    autoLike: typeof r.autoLike === 'boolean' ? r.autoLike : d.autoLike,
    heartReplyFallback: typeof r.heartReplyFallback === 'boolean' ? r.heartReplyFallback : d.heartReplyFallback,
  }
}

export type FeedIssueType = 'spelling' | 'grammar' | 'tone_of_voice' | 'missing_link' | 'link_reminder' | 'other'

export interface FeedIssue {
  type: FeedIssueType
  severity: 'high' | 'medium' | 'low'
  detail: string
  /** The wrong text, when the issue is about specific words */
  excerpt?: string
  suggestion?: string
}

export interface FeedCheck {
  id: string
  source: 'published' | 'scheduled'
  platform: string
  postRef: string
  accountId: string | null
  latePostId: string | null
  calendarPostId: string | null
  postText: string | null
  postUrl: string | null
  postThumbnail: string | null
  postedAt: string | null
  issues: FeedIssue[]
  tovScore: number | null
  suggestedCaption: string | null
  status: 'ok' | 'open' | 'resolved' | 'ignored'
  checkedAt: string
  /** Facebook posts the app published can have their caption corrected in place */
  canApplyFix: boolean
}

export interface FeedAgentRunSummary {
  ranAt: string
  postsChecked: number
  issuesFound: number
  commentsSynced: number
  autoHidden: number
  autoLiked: number
  autoHearted: number
  firstCommentsPosted: number
  needsReply: number
}
