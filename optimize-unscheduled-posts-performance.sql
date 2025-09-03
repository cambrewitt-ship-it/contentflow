-- Performance optimization for planner_unscheduled_posts table
-- This addresses the timeout issues by adding proper indexes

-- 1. Composite index for the main query pattern (project_id + created_at DESC)
-- This is the most critical index for the optimized query
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_created 
ON planner_unscheduled_posts(project_id, created_at DESC);

-- 2. Individual indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_id 
ON planner_unscheduled_posts(project_id);

CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_created_at 
ON planner_unscheduled_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_client_id 
ON planner_unscheduled_posts(client_id);

-- 3. Update table statistics for better query planning
ANALYZE planner_unscheduled_posts;

-- 4. Verify indexes were created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'planner_unscheduled_posts' 
    AND indexname IN (
        'idx_planner_unscheduled_posts_project_created',
        'idx_planner_unscheduled_posts_project_id',
        'idx_planner_unscheduled_posts_created_at',
        'idx_planner_unscheduled_posts_client_id'
    );

-- 5. Check table size and row count
SELECT 
    COUNT(*) as total_rows,
    pg_size_pretty(pg_total_relation_size('planner_unscheduled_posts')) as table_size
FROM planner_unscheduled_posts;

-- 6. Test query performance (this should use the composite index)
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM planner_unscheduled_posts 
-- WHERE project_id = 'your-project-id' 
-- ORDER BY created_at DESC 
-- LIMIT 20;

-- Expected result: Query should use idx_planner_unscheduled_posts_project_created
-- and complete in under 5 seconds even with large datasets
