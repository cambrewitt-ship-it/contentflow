-- Performance optimization for planner_scheduled_posts table
-- Run this in your Supabase SQL Editor to fix timeout issues

-- 1. Add composite index for the most common query pattern
-- This index optimizes queries filtering by project_id and ordering by scheduled_date
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_date 
ON planner_scheduled_posts(project_id, scheduled_date, scheduled_time);

-- 2. Add index for client_id queries (if needed for other operations)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_client_id 
ON planner_scheduled_posts(client_id);

-- 3. Add index for late_status queries (for filtering scheduled vs pending posts)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_late_status 
ON planner_scheduled_posts(late_status);

-- 4. Note: is_confirmed column doesn't exist in the actual table schema
-- Add index for is_confirmed queries (removed - column doesn't exist)
-- CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_confirmed 
-- ON planner_scheduled_posts(is_confirmed);

-- 5. Note: week_index and day_index columns don't exist in the actual table schema
-- Add index for week_index and day_index (removed - columns don't exist)
-- CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_week_day 
-- ON planner_scheduled_posts(week_index, day_index);

-- 6. Add index for created_at (for ordering by creation time)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_created_at 
ON planner_scheduled_posts(created_at);

-- 7. Add index for updated_at (for tracking recent changes)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_updated_at 
ON planner_scheduled_posts(updated_at);

-- 8. Analyze the table to update statistics for the query planner
ANALYZE planner_scheduled_posts;

-- 9. Check table size and index usage (run these to monitor performance)
-- SELECT schemaname, tablename, attname, n_distinct, correlation 
-- FROM pg_stats 
-- WHERE tablename = 'planner_scheduled_posts';

-- 10. Monitor index usage (run this periodically to see which indexes are being used)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'planner_scheduled_posts';
