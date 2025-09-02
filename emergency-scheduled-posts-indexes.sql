-- EMERGENCY FIX: Simple Database Indexes for Scheduled Posts
-- Run this in Supabase SQL Editor to fix the timeout issue

-- ==============================================
-- 1. CRITICAL INDEXES FOR SIMPLIFIED QUERY
-- ==============================================

-- Primary index for project_id filtering (most important)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_id 
ON planner_scheduled_posts(project_id);

-- Index for created_at ordering (used in simplified query)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_created_at 
ON planner_scheduled_posts(created_at DESC);

-- Composite index for project_id + created_at (optimal for the simplified query)
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_created 
ON planner_scheduled_posts(project_id, created_at DESC);

-- ==============================================
-- 2. UPDATE TABLE STATISTICS
-- ==============================================

-- Update statistics for the query planner (CRITICAL for performance)
ANALYZE planner_scheduled_posts;

-- ==============================================
-- 3. VERIFY INDEXES WERE CREATED
-- ==============================================

-- Check that the critical indexes exist
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'planner_scheduled_posts' 
  AND indexname IN (
    'idx_planner_scheduled_posts_project_id',
    'idx_planner_scheduled_posts_created_at',
    'idx_planner_scheduled_posts_project_created'
  )
ORDER BY indexname;

-- ==============================================
-- 4. QUERY EXPLANATION
-- ==============================================

-- SIMPLIFIED QUERY (should be fast now):
-- SELECT * 
-- FROM planner_scheduled_posts 
-- WHERE project_id = 'uuid' 
-- ORDER BY created_at DESC;

-- This query will use:
-- 1. idx_planner_scheduled_posts_project_created (optimal)
-- 2. OR idx_planner_scheduled_posts_project_id + idx_planner_scheduled_posts_created_at

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
