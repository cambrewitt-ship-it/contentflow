-- Database Performance Optimization for Content Manager
-- Run this in your Supabase SQL Editor to fix timeout issues and improve query performance

-- ==============================================
-- 1. PLANNER_SCHEDULED_POSTS TABLE OPTIMIZATION
-- ==============================================

-- Primary composite index for the most common query pattern
-- This index optimizes: WHERE project_id = ? ORDER BY scheduled_date, scheduled_time
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_date_time 
ON planner_scheduled_posts(project_id, scheduled_date, scheduled_time);

-- Index for client_id queries (cross-project operations)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_client_id 
ON planner_scheduled_posts(client_id);

-- Index for late_status filtering (scheduled vs pending posts)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_late_status 
ON planner_scheduled_posts(late_status);

-- Note: is_confirmed column doesn't exist in the actual table schema
-- Index for confirmation workflow (removed - column doesn't exist)
-- CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_confirmed 
-- ON planner_scheduled_posts(is_confirmed);

-- Note: week_index and day_index columns don't exist in the actual table schema
-- Index for calendar positioning (removed - columns don't exist)
-- CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_week_day 
-- ON planner_scheduled_posts(week_index, day_index);

-- Index for recent posts queries
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_created_at 
ON planner_scheduled_posts(created_at DESC);

-- Note: updated_at column doesn't exist in the actual table schema
-- Index for updated posts tracking (removed - column doesn't exist)
-- CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_updated_at 
-- ON planner_scheduled_posts(updated_at DESC);

-- ==============================================
-- 2. PLANNER_UNSCHEDULED_POSTS TABLE OPTIMIZATION
-- ==============================================

-- Primary index for unscheduled posts queries
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_id 
ON planner_unscheduled_posts(project_id);

-- Index for client_id queries
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_client_id 
ON planner_unscheduled_posts(client_id);

-- Index for recent unscheduled posts
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_created_at 
ON planner_unscheduled_posts(created_at DESC);

-- ==============================================
-- 3. SCHEDULED_POSTS TABLE OPTIMIZATION
-- ==============================================

-- Primary index for scheduled posts queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client_id 
ON scheduled_posts(client_id);

-- Index for platform-specific queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform 
ON scheduled_posts(platform);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status 
ON scheduled_posts(status);

-- Index for scheduled time queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time 
ON scheduled_posts(scheduled_time);

-- ==============================================
-- 4. PROJECTS TABLE OPTIMIZATION
-- ==============================================

-- Index for client projects queries
CREATE INDEX IF NOT EXISTS idx_projects_client_id 
ON projects(client_id);

-- Index for recent projects
CREATE INDEX IF NOT EXISTS idx_projects_created_at 
ON projects(created_at DESC);

-- ==============================================
-- 5. CLIENTS TABLE OPTIMIZATION
-- ==============================================

-- Index for client lookups
CREATE INDEX IF NOT EXISTS idx_clients_id 
ON clients(id);

-- Index for active clients
CREATE INDEX IF NOT EXISTS idx_clients_active 
ON clients(active);

-- ==============================================
-- 6. UPDATE TABLE STATISTICS
-- ==============================================

-- Update statistics for the query planner
ANALYZE planner_scheduled_posts;
ANALYZE planner_unscheduled_posts;
ANALYZE scheduled_posts;
ANALYZE projects;
ANALYZE clients;

-- ==============================================
-- 7. PERFORMANCE MONITORING QUERIES
-- ==============================================

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('planner_scheduled_posts', 'planner_unscheduled_posts', 'scheduled_posts', 'projects', 'clients')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage (run this periodically to monitor performance)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes 
WHERE tablename IN ('planner_scheduled_posts', 'planner_unscheduled_posts', 'scheduled_posts')
ORDER BY idx_scan DESC;

-- Check slow queries (if you have query logging enabled)
-- SELECT query, mean_time, calls 
-- FROM pg_stat_statements 
-- WHERE query LIKE '%planner_scheduled_posts%'
-- ORDER BY mean_time DESC;

-- ==============================================
-- 8. QUERY OPTIMIZATION EXAMPLES
-- ==============================================

-- BEFORE (slow):
-- SELECT * FROM planner_scheduled_posts WHERE project_id = 'uuid' ORDER BY scheduled_date;

-- AFTER (fast):
-- SELECT id, project_id, client_id, caption, image_url, scheduled_date, scheduled_time, 
--        late_status, created_at
-- FROM planner_scheduled_posts 
-- WHERE project_id = 'uuid' 
-- ORDER BY scheduled_date, scheduled_time 
-- LIMIT 100;

-- ==============================================
-- 9. MAINTENANCE RECOMMENDATIONS
-- ==============================================

-- Run these periodically to maintain performance:

-- 1. Update statistics (weekly)
-- ANALYZE;

-- 2. Check for unused indexes (monthly)
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes 
-- WHERE idx_scan = 0 AND tablename LIKE 'planner_%';

-- 3. Monitor table bloat (monthly)
-- SELECT schemaname, tablename, n_dead_tup, n_live_tup
-- FROM pg_stat_user_tables 
-- WHERE tablename LIKE 'planner_%';

-- 4. Vacuum if needed (when dead tuples > 20% of live tuples)
-- VACUUM ANALYZE planner_scheduled_posts;
