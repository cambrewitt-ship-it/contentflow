import type { AnalyticsPost, DashboardTotals } from './types'

// A monthly client report, frozen when generated (client_reports.data). Client-safe.

export interface ReportSummary {
  /** One line, e.g. "A strong month: reach up 32% and 136 new followers" */
  headline: string
  /** 2-3 plain-English sentences on how the month went */
  overview: string
  wins: string[]
  /** What we'll focus on next month */
  nextMonth: string[]
}

export interface ReportData {
  clientName: string
  logoUrl: string | null
  /** e.g. "October 2026" */
  periodLabel: string
  periodStart: string
  periodEnd: string
  totals: DashboardTotals | null
  previousTotals: DashboardTotals | null
  followers: { current: number; gained: number } | null
  previousFollowers: { current: number; gained: number } | null
  daily: Array<{ date: string; reach: number; engagement: number; impressions: number; followersGained: number }>
  postCount: number
  byPlatform: Array<{ platform: string; posts: number; engagement: number }>
  byFormat: Array<{ format: string; posts: number; medianEngagementRate: number }>
  topPosts: AnalyticsPost[]
  /** What people said in the comments this month (when comments are synced) */
  audience?: { total: number; positive: number; negative: number; questions: string[] } | null
  summary: ReportSummary
  generatedAt: string
}

export interface ReportListItem {
  id: string
  periodStart: string
  periodLabel: string
  shareToken: string
  createdAt: string
  headline: string
}
