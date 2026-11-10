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
