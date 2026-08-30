export type PostFormat =
  | "horror-story"
  | "workflow-teardown"
  | "category-take"
  | "value-post"
  | "shipped"
  | "behind-the-build";

// Matches .claude/skills/social-post/SKILL.md section 6, plus image_prompt
// which run.ts asks for on top of the skill's own schema (see prompt in
// generatePosts()) — stripped back out before writing to posts/ so the
// vault's own file format stays exactly what the skill defines.
export interface GeneratedPost {
  signal: string;
  platform: "linkedin";
  format: PostFormat;
  hook: string;
  body: string;
  cta: string | null;
  why_this_works: string;
  image_prompt: string;
}

export interface ScheduledSlot {
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:MM
}

export interface RunLogPostEntry {
  vault_file: string;
  signal: string;
  format: PostFormat;
  scheduled_date: string;
  scheduled_time: string;
  calendar_scheduled_posts_id: string | null;
  insert_error: string | null;
  image_prompt: string;
  image_url: string | null;
  media_gallery_id: string | null;
  image_error: string | null;
}

export interface RunLog {
  started_at: string;
  finished_at: string;
  vault_path: string;
  client_id: string;
  requested_count: number;
  generated_count: number;
  langfuse_trace_id: string | null;
  agent_sdk: {
    session_id: string | null;
    cost_usd: number | null;
    duration_ms: number | null;
    num_turns: number | null;
  };
  posts: RunLogPostEntry[];
  generation_error: string | null;
}
