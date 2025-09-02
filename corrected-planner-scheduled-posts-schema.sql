-- Corrected Schema for planner_scheduled_posts table
-- This shows the ACTUAL columns that exist in the table

-- The actual planner_scheduled_posts table has these columns:
CREATE TABLE IF NOT EXISTS planner_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  client_id UUID NOT NULL,
  caption TEXT,
  image_url TEXT,
  post_notes TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  late_status TEXT,
  late_post_id TEXT,
  platforms_scheduled TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: These columns do NOT exist in the actual table:
-- - week_index (was referenced in SELECT queries)
-- - day_index (was referenced in SELECT queries) 
-- - is_confirmed (was referenced in SELECT queries)

-- Corrected indexes (only for columns that actually exist):
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_date_time 
ON planner_scheduled_posts(project_id, scheduled_date, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_client_id 
ON planner_scheduled_posts(client_id);

CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_late_status 
ON planner_scheduled_posts(late_status);

CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_confirmed 
ON planner_scheduled_posts(is_confirmed);

CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_created_at 
ON planner_scheduled_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_updated_at 
ON planner_scheduled_posts(updated_at DESC);

-- Update table statistics
ANALYZE planner_scheduled_posts;
