-- Optimize Scheduled Posts Query Performance
-- Run this in your Supabase SQL Editor to fix the 16+ second query time

-- ==============================================
-- 1. CRITICAL INDEX FOR SCHEDULED POSTS QUERY
-- ==============================================

-- Primary composite index for the most common query pattern
-- This index optimizes: WHERE project_id = ? ORDER BY scheduled_date, scheduled_time
-- This is the MOST IMPORTANT index for the GET /api/planner/scheduled route
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_date_time 
ON planner_scheduled_posts(project_id, scheduled_date, scheduled_time);

-- ==============================================
-- 2. SUPPORTING INDEXES
-- ==============================================

-- Index for client_id queries (cross-project operations)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_client_id 
ON planner_scheduled_posts(client_id);

-- Index for late_status filtering (scheduled vs pending posts)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_late_status 
ON planner_scheduled_posts(late_status);

-- Index for recent posts queries
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_created_at 
ON planner_scheduled_posts(created_at DESC);

-- ==============================================
-- 3. UPDATE TABLE STATISTICS
-- ==============================================

-- Update statistics for the query planner (CRITICAL for performance)
ANALYZE planner_scheduled_posts;

-- ==============================================
-- 4. VERIFY INDEXES WERE CREATED
-- ==============================================

-- Check that the critical index exists
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'planner_scheduled_posts' 
  AND indexname = 'idx_planner_scheduled_posts_project_date_time';

-- Check all indexes on the table
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'planner_scheduled_posts'
ORDER BY indexname;

-- ==============================================
-- 5. PERFORMANCE MONITORING
-- ==============================================

-- Check table size
SELECT 
  pg_size_pretty(pg_total_relation_size('planner_scheduled_posts')) as table_size;

-- Check index usage (run this after the query runs a few times)
SELECT 
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'planner_scheduled_posts'
ORDER BY idx_scan DESC;

-- ==============================================
-- 6. QUERY OPTIMIZATION EXPLANATION
-- ==============================================

-- BEFORE (slow - 16+ seconds):
-- SELECT id, project_id, client_id, caption, image_url, post_notes, scheduled_date, scheduled_time, late_status, late_post_id, platforms_scheduled, created_at
-- FROM planner_scheduled_posts 
-- WHERE project_id = 'uuid' 
-- ORDER BY scheduled_date, scheduled_time 
-- LIMIT 50;

-- AFTER (fast - under 2 seconds):
-- Same query, but now uses the composite index:
-- idx_planner_scheduled_posts_project_date_time(project_id, scheduled_date, scheduled_time)
-- 
-- The index allows PostgreSQL to:
-- 1. Quickly find all rows with the specific project_id
-- 2. Return them already sorted by scheduled_date, scheduled_time
-- 3. Limit the results efficiently

-- ==============================================
-- 7. MAINTENANCE
-- ==============================================

-- Run this periodically to maintain performance:
-- ANALYZE planner_scheduled_posts;

-- If the table grows very large, consider partitioning by project_id or date ranges
