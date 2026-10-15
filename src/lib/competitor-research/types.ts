import { z } from 'zod';

export type ResearchPlatform = 'instagram' | 'tiktok';

export const researchProfileSchema = z.object({
  category: z.string().trim().max(120).default(''),
  description: z.string().trim().max(1000).default(''),
  location: z.string().trim().max(120).default(''),
  target_audience: z.string().trim().max(500).default(''),
  keywords: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
});

// What the research agent knows about the client's niche: drives account
// discovery, trend search and how insights are framed.
export type ResearchProfile = z.infer<typeof researchProfileSchema>;

export interface CompetitorAccount {
  id: string;
  client_id: string;
  platform: ResearchPlatform;
  handle: string;
  relationship: 'competitor' | 'inspiration';
  source: 'manual' | 'discovered';
  display_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  notes: string | null;
  last_checked_at: string | null;
  created_at: string;
}

// A competitor post normalised across platforms.
export interface SocialPost {
  id: string;
  platform: ResearchPlatform;
  handle: string;
  url: string | null;
  caption: string;
  // reel / carousel / image / video
  format: string;
  // Still image the vision model can look at (photo, carousel cover, video thumbnail)
  image_url: string | null;
  posted_at: string | null;
  likes: number;
  comments: number;
  shares: number | null;
  saves: number | null;
  views: number | null;
  hashtags: string[];
  // TikTok only: the sound used
  sound: string | null;
}

export interface AccountSnapshot {
  platform: ResearchPlatform;
  handle: string;
  display_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  posts: SocialPost[];
}

export interface AccountStats {
  platform: ResearchPlatform;
  handle: string;
  followers: number | null;
  posts_sampled: number;
  posts_per_week: number | null;
  avg_engagement_rate: number | null;
  format_mix: Record<string, number>;
  avg_caption_words: number;
  avg_hashtags: number;
  emoji_share: number;
  question_share: number;
  top_hashtags: string[];
  top_days: string[];
}

export interface RankedPost extends SocialPost {
  ref: string;
  engagement_rate: number | null;
  // Engagement relative to the account's own median, so small accounts'
  // breakout posts rank alongside big accounts' averages.
  relative_score: number;
}

export interface TrendItem {
  title: string;
  description: string;
  how_to_use: string;
  sources: string[];
}

export interface TrendFindings {
  trending_formats: TrendItem[];
  engagement_tactics: TrendItem[];
  caption_trends: TrendItem[];
  sources: Array<{ title: string; url: string }>;
}

export interface PostIdea {
  title: string;
  platform: string;
  format: string;
  visual_direction: string;
  hook: string;
  caption: string;
  hashtags: string[];
  inspired_by: string;
}

export interface ResearchReport {
  summary: string;
  top_posts: Array<{
    ref: string;
    why_it_works: string;
    visual_style: string;
    hook: string;
  }>;
  visual_trends: Array<{ title: string; description: string; examples: string[] }>;
  caption_patterns: Array<{ title: string; description: string; example: string }>;
  engagement_tactics: Array<{ title: string; description: string; evidence: string }>;
  trending_formats: TrendItem[];
  opportunities: string[];
  post_ideas: PostIdea[];
  // Data the insights were built from, kept for display
  posts: RankedPost[];
  account_stats: AccountStats[];
  trend_sources: Array<{ title: string; url: string }>;
}

export interface AccountSuggestion {
  platform: ResearchPlatform;
  handle: string;
  name: string | null;
  reason: string;
  relationship: 'competitor' | 'inspiration';
  followers_count: number | null;
  profile_picture_url: string | null;
  verified: boolean;
}
