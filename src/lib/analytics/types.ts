// Shared (browser + server) types for client analytics, read from Zernio (LATE).

export interface PostMetrics {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  views: number
  clicks: number
  /** likes + comments + shares + saves */
  engagement: number
  /** Percent: engagement / (impressions, else reach, else views) */
  engagementRate: number
}

/** One published post on one platform, condensed from Zernio's analytics. */
export interface AnalyticsPost {
  id: string
  /** Zernio post id when published through the app (matches calendar_scheduled_posts.late_post_id) */
  latePostId: string | null
  platform: string
  publishedAt: string
  /** Caption, trimmed */
  content: string
  url: string | null
  thumbnailUrl: string | null
  /** reel | carousel | image | video | story | text */
  format: string
  isExternal: boolean
  metrics: PostMetrics
}

export interface BestTimeSlot {
  /** 0 = Monday … 6 = Sunday, in the client's timezone */
  day: number
  /** 0-23 in the client's timezone */
  hour: number
  avgEngagement: number
  postCount: number
}

export interface GroupStat {
  key: string
  label: string
  count: number
  medianEngagementRate: number
  medianReach: number
  /** medianEngagementRate / baseline median, e.g. 1.4 = 40% better than usual */
  lift: number
}

export interface HashtagStat {
  tag: string
  count: number
  medianEngagementRate: number
  lift: number
}

export interface PerformanceInsights {
  generatedAt: string
  timezone: string
  /** Posts the insights are based on (published in the last 12 months) */
  postCount: number
  postsPerWeek: number
  baseline: { medianEngagementRate: number; medianReach: number; medianEngagement: number }
  byFormat: GroupStat[]
  byPlatform: GroupStat[]
  byDay: GroupStat[]
  byTimeOfDay: GroupStat[]
  byCaptionLength: GroupStat[]
  byHashtagCount: GroupStat[]
  hashtags: HashtagStat[]
  bestSlots: BestTimeSlot[]
  topPosts: AnalyticsPost[]
  weakPosts: AnalyticsPost[]
  trend: {
    recent: { posts: number; medianEngagementRate: number; engagement: number }
    previous: { posts: number; medianEngagementRate: number; engagement: number }
  }
  /** Plain-language findings, strongest first — shown in the UI and fed to the AI */
  findings: string[]
  /** Follower count now and net change over the last 30 days, when Zernio reports it */
  followers?: { current: number; gained30d: number } | null
  /** Audience demographics + the engaged-audience persona (refreshed daily; see ./audience.ts) */
  audience?: AudienceData | null
}

// ---------------------------------------------------------------------------
// Audience: demographics from Zernio + the "most engaged audience" persona
// ---------------------------------------------------------------------------

export interface AudienceSlice {
  key: string
  label: string
  value: number
  /** 0..1 share of this breakdown's total */
  share: number
}

export type AudienceDimension =
  | 'age'
  | 'gender'
  | 'country'
  | 'city'
  | 'function'
  | 'seniority'
  | 'industry'
  | 'company_size'
  | 'region'

export type AudienceBreakdowns = Partial<Record<AudienceDimension, AudienceSlice[]>>

export type AccountAudienceStatus = 'ok' | 'too_small' | 'unavailable' | 'needs_reconnect' | 'failed'

export interface AccountAudience {
  accountId: string
  platform: string
  username: string | null
  status: AccountAudienceStatus
  /** Why there's nothing to show, in plain words */
  message?: string
  /** Everyone who follows the account */
  followers: AudienceBreakdowns | null
  /** People who engaged with posts (Instagram) — the basis of the persona */
  engaged: AudienceBreakdowns | null
  /** Platform caveat worth showing, e.g. Facebook has no age/gender */
  note?: string
}

export interface AudiencePersona {
  /** A first name for the avatar, e.g. "Sarah" */
  name: string
  /** One line: "28–34 · mostly women · Auckland" */
  headline: string
  ageRange: string | null
  gender: string | null
  location: string | null
  summary: string
  /** What they care about / who they are */
  traits: string[]
  /** Content they engage with most, from real results */
  loves: string[]
  /** When they're most active, from best times */
  whenOnline: string | null
  /** Tone and approach that lands with them */
  howToTalk: string[]
  /** 3 post ideas made for them */
  contentIdeas: string[]
  /** What the persona is built from, e.g. "Instagram engaged audience + 142 posts + 310 comments" */
  basedOn: string
  generatedAt: string
}

export interface AudienceData {
  accounts: AccountAudience[]
  persona: AudiencePersona | null
  fetchedAt: string
}

/** A person who comments most (from the comments inbox) */
export interface AudienceFan {
  name: string
  username: string | null
  picture: string | null
  platform: string
  comments: number
  positive: number
  lastAt: string | null
}

export interface Recommendation {
  id: string
  title: string
  detail: string
  /** What the "do it" button does */
  action: 'create_post' | 'run_agent' | 'adjust_schedule' | 'none'
  /** Brief for the Content Agent / notes for a new post, when action needs one */
  brief?: string
}

export interface DashboardTotals {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  views: number
  engagementRate: number
}

export interface AnalyticsDashboard {
  fromDate: string
  toDate: string
  totals: DashboardTotals
  previousTotals: DashboardTotals | null
  followers: { current: number; gained: number }
  previousFollowers: { current: number; gained: number } | null
  daily: Array<{ date: string; impressions: number; reach: number; engagement: number; views: number; followersGained: number }>
  dataAsOf: string | null
}

export type AnalyticsStatus = 'ok' | 'not_connected' | 'unavailable' | 'failed' | 'setup_required'

/** GET /api/clients/[clientId]/analytics */
export interface ClientAnalyticsResponse {
  status: AnalyticsStatus
  message?: string
  range: number
  dashboard: AnalyticsDashboard | null
  insights: PerformanceInsights | null
  recommendations: Recommendation[]
  recommendationsAt: string | null
  syncedAt: string | null
  /** Recently published posts with their results, newest first */
  recentPosts: AnalyticsPost[]
  /** Every published post from the last 12 months (captions trimmed), newest first — feeds the charts and heatmaps */
  posts?: AnalyticsPost[]
  /** Zernio's full weekly best-time grid in the client's timezone (not just the top slots) */
  bestTimes?: BestTimeSlot[]
  /** Most engaged commenters in the last 90 days, from the comments inbox */
  fans?: AudienceFan[]
}

/** One client's row in the agency overview (GET /api/analytics/portfolio) */
export interface PortfolioClient {
  clientId: string
  status: AnalyticsStatus | 'pending'
  followers: { current: number; gained30d: number } | null
  last30: { posts: number; medianEngagementRate: number; engagement: number } | null
  /** Change in median engagement rate vs the 30 days before, as a fraction */
  engagementChange: number | null
  scheduledNext7: number
  awaitingApproval: number
  topRecommendation: string | null
  /** "Keep the calendar filled" is on: gaps get drafted automatically each morning */
  autoFill: boolean
  /** Things a manager should look at, most urgent first */
  attention: Array<{ level: 'critical' | 'warning'; text: string }>
}
