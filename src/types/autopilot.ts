/**
 * Autopilot feature type definitions.
 *
 * These types cover the entire Autopilot pipeline:
 * media gallery analysis → AI plan generation → post approval → LATE publishing.
 */

// ── Media Gallery ─────────────────────────────────────────────────────────────

export interface MediaGalleryItem {
  id: string;
  client_id: string;
  user_id?: string;
  media_url: string;
  media_type: 'image' | 'video';
  file_name?: string | null;
  file_size?: number | null;
  status: 'available' | 'archived' | 'deleted';
  ai_analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  ai_description: string | null;
  ai_tags: string[];
  ai_categories: string[];
  ai_mood: string | null;
  ai_setting: string | null;
  ai_subjects: string[];
  user_context: string | null;
  freshness_score: number;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Content Events ────────────────────────────────────────────────────────────

export type EventType =
  | 'public_holiday'
  | 'sports'
  | 'cultural'
  | 'industry'
  | 'custom';

export type EventSource = 'system' | 'user' | 'suggested';

export type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface ContentEvent {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  event_date: string;       // YYYY-MM-DD
  event_type: EventType;
  event_source: EventSource;
  recurrence_type: RecurrenceType;
  recurrence_day_of_week: number | null;
  recurrence_month_day: number | null;
  recurrence_month: number | null;
  content_angle: string | null;
  relevance_tags: string[];
  region: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Populated by expansion algorithm for recurring events
  occurrence_date?: string;
}

// ── Autopilot Plan ────────────────────────────────────────────────────────────

export type AutopilotPlanStatus =
  | 'generating'
  | 'pending_approval'
  | 'approved'
  | 'partially_approved'
  | 'published'
  | 'failed';

export interface AutopilotPlan {
  id: string;
  client_id: string;
  user_id: string;
  project_id: string | null;
  /** YYYY-MM-DD */
  plan_week_start: string;
  /** YYYY-MM-DD */
  plan_week_end: string;
  posts_planned: number;
  posts_approved: number;
  ai_plan_summary: string | null;
  ai_context_snapshot: Record<string, unknown> | null;
  events_considered: ContentEvent[];
  status: AutopilotPlanStatus;
  approval_token: string;
  approved_at: string | null;
  published_at: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  // v2 swipe fields
  generation_version: string | null;
  candidates_generated: number | null;
  candidates_liked: number | null;
  candidates_skipped: number | null;
  created_at: string;
  updated_at: string;
}

// ── Autopilot Candidate (v2 swipe system) ────────────────────────────────────

export type CandidateDecision = 'pending' | 'kept' | 'skipped';

export interface AutopilotCandidate {
  id: string;
  autopilot_plan_id: string;
  client_id: string;
  media_gallery_id: string | null;
  media_url: string;
  caption: string;
  platforms: string[];
  hashtags: string[];
  post_type: string | null;
  event_reference: string | null;
  season_tag: string | null;
  /** YYYY-MM-DD */
  suggested_date: string;
  /** HH:MM */
  suggested_time: string;
  ai_reasoning: string | null;
  decision: CandidateDecision;
  decided_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ── Autopilot Post ────────────────────────────────────────────────────────────

export type AutopilotPostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'edited_and_approved';

export interface AutopilotPost {
  id: string;
  client_id: string;
  project_id: string | null;
  /** Links to autopilot_plans.id */
  autopilot_plan_id: string | null;
  /** Links to media_gallery.id */
  media_gallery_id: string | null;
  caption: string | null;
  image_url: string | null;
  post_notes: string | null;
  /** YYYY-MM-DD */
  scheduled_date: string;
  /** HH:MM:SS */
  scheduled_time: string | null;
  source: 'autopilot' | 'manual' | 'portal';
  post_type: string | null;
  platforms_scheduled: string[] | null;
  autopilot_status: AutopilotPostStatus | null;
  approval_status: string | null;
  ai_reasoning: string | null;
  late_post_id: string | null;
  late_status: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from media_gallery when fetched via plan detail endpoint */
  media_gallery_item?: Pick<
    MediaGalleryItem,
    'id' | 'media_url' | 'ai_description' | 'ai_tags' | 'ai_mood'
  > | null;
}

// ── Settings types (re-exported from api.ts for convenience) ─────────────────

export interface OperatingHoursDay {
  open: string;  // HH:MM
  close: string; // HH:MM
}

/** Keys are day names: "monday", "tuesday", etc. null = closed */
export type OperatingHours = Record<string, OperatingHoursDay | null>;

export interface ContentMix {
  promotional: number;
  engagement: number;
  seasonal: number;
  educational: number;
}

export interface PostingPreferences {
  posts_per_week: number;
  preferred_days: string[];
  preferred_times: string[];
  avoid_days: string[];
  content_mix: ContentMix;
}

export interface BusinessContext {
  business_type: string;
  hemisphere: 'northern' | 'southern';
  attributes: string[];
  key_offerings: string[];
  local_sports_teams: string[];
}

export interface AutopilotSettings {
  auto_generate: boolean;
  generation_day: string;
  planning_horizon_days: number;
  require_approval: boolean;
  notification_method: 'email' | 'none';
  auto_publish: boolean;
  auto_publish_hours: number;
}

// ── Cron result ───────────────────────────────────────────────────────────────

export interface AutopilotCronResult {
  success: boolean;
  generated: number;
  failed: number;
  errors: string[];
}

// ── Email params ──────────────────────────────────────────────────────────────

export interface AutopilotPlanEmailParams {
  to: string;
  userName: string;
  clientName: string;
  planSummary: string;
  postsCount: number;
  weekStart: string;
  weekEnd: string;
  approvalLink: string;
}

export interface AutopilotPublishedEmailParams {
  to: string;
  userName: string;
  clientName: string;
  publishedCount: number;
  weekStart: string;
  autopilotLink: string;
}

// ── Preference engine types ───────────────────────────────────────────────────

export interface ContentPreference {
  id: string;
  client_id: string;
  user_id: string;
  media_gallery_id: string | null;
  autopilot_plan_id: string | null;
  caption: string;
  post_type: string;
  platforms: string[];
  event_context: string | null;
  season_context: string | null;
  liked: boolean;
  word_count: number;
  hashtag_count: number;
  emoji_count: number;
  has_question: boolean;
  has_exclamation: boolean;
  created_at: string;
}

export interface StylePreferences {
  totalLiked: number;
  totalDisliked: number;
  hasEnoughData: boolean;
  avgLikedCaptionLength: number;
  avgDislikedCaptionLength: number;
  avgLikedHashtagCount: number;
  avgDislikedHashtagCount: number;
  preferredPostTypes: string[];
  avoidedPostTypes: string[];
  topLikedExamples: Array<{ caption: string; post_type: string; event_context: string | null }>;
  topDislikedExamples: Array<{ caption: string; post_type: string; reason_inferred: string }>;
  toneNotes: string;
}
