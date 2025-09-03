# Unscheduled Posts Timeout Fix - Optimization Summary

## 🚨 Problem
- Unscheduled posts API was timing out after 13+ seconds
- Error: "canceling statement due to statement timeout"
- No LIMIT clause was causing the query to load all posts for a project

## ✅ Solution Applied

### 1. Query Optimization
**Before (SLOW - No Limit):**
```typescript
const { data, error } = await supabase
  .from('planner_unscheduled_posts')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });
```

**After (FAST - With Limit):**
```typescript
const { data, error } = await supabase
  .from('planner_unscheduled_posts')
  .select('*') // Simple: select all columns
  .eq('project_id', projectId) // Simple: single WHERE clause
  .order('created_at', { ascending: false }) // Simple: single ORDER BY
  .limit(20); // CRITICAL: Limit to prevent timeout
```

### 2. Enhanced Error Handling
- Added specific timeout error handling (code: '57014')
- Added projectId validation
- Added detailed error logging
- Added performance logging

### 3. Database Indexes Required
Run this SQL in Supabase SQL Editor:
```sql
-- Critical composite index for the main query pattern
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_created 
ON planner_unscheduled_posts(project_id, created_at DESC);

-- Additional supporting indexes
CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_project_id 
ON planner_unscheduled_posts(project_id);

CREATE INDEX IF NOT EXISTS idx_planner_unscheduled_posts_created_at 
ON planner_unscheduled_posts(created_at DESC);

-- Update statistics
ANALYZE planner_unscheduled_posts;
```

## 📊 Expected Performance Improvement
- **Before:** 13+ seconds (timeout)
- **After:** Under 5 seconds (target)
- **Limit:** 20 most recent posts per project
- **Index:** Composite index on (project_id, created_at DESC)

## 🔧 Changes Made
1. **Added LIMIT 20** to prevent loading too many posts
2. **Added projectId validation** to prevent invalid queries
3. **Enhanced error handling** with specific timeout detection
4. **Added performance logging** to monitor query execution
5. **Created SQL optimization script** for database indexes

## 🎯 Result
The unscheduled posts API now matches the same optimized structure as the scheduled posts API, ensuring consistent performance across both endpoints.

## 📝 Next Steps
1. Run the SQL indexes in Supabase SQL Editor
2. Test the unscheduled posts loading in the planner
3. Monitor the console logs for performance metrics
4. Verify queries complete in under 5 seconds
