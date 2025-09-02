# Database Performance Testing Guide

## 🚀 Performance Optimization Summary

### **What Was Optimized:**

1. **Database Indexes** - Added 8 critical indexes for fast queries
2. **Query Limits** - Reduced default limit from 100 to 50, max 100
3. **Column Selection** - Optional image data loading to reduce payload
4. **Timeout Handling** - Comprehensive error handling with retry logic
5. **Performance Monitoring** - Real-time query performance tracking

### **Expected Performance Improvements:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Query Time** | 5-30+ seconds | <1 second | 95%+ faster |
| **Timeout Errors** | Frequent (57014) | Rare | 99% reduction |
| **Data Transfer** | Full payload | Selective | 30-50% less |
| **User Experience** | Slow loading | Fast loading | Instant feedback |

---

## 🧪 Testing the Optimizations

### **Step 1: Apply Database Indexes**

Run this in your Supabase SQL Editor:
```sql
-- Execute the complete optimization script
-- File: database-performance-optimization.sql
```

**Verify indexes were created:**
```sql
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename = 'planner_scheduled_posts'
ORDER BY indexname;
```

### **Step 2: Test Query Performance**

**A. Test with Browser Console:**
1. Open planner page with a project that has scheduled posts
2. Open browser console (F12)
3. Look for performance logs:
   ```
   🔍 OPTIMIZED QUERY - Fetching scheduled posts...
   ⏱️ Query executed in XXXms
   ✅ Retrieved X scheduled posts (total: Y) in XXXms
   ```

**B. Test Different Scenarios:**
```bash
# Test with different limits
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&limit=10"
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&limit=50"
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&limit=100"

# Test with/without image data
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&includeImageData=false"
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&includeImageData=true"
```

### **Step 3: Monitor Performance Metrics**

**Expected Performance Targets:**
- ✅ **Fast queries**: <500ms
- ✅ **Acceptable queries**: 500ms - 1s
- ⚠️ **Slow queries**: 1s - 5s (warning logged)
- ❌ **Very slow queries**: >5s (error logged)

**Performance Response Format:**
```json
{
  "posts": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "performance": {
    "queryDuration": "245ms",
    "optimized": true
  }
}
```

### **Step 4: Test Error Handling**

**A. Test Timeout Scenarios:**
1. Create a project with 1000+ scheduled posts
2. Try loading without indexes (should timeout)
3. Apply indexes and retry (should work)

**B. Test Retry Logic:**
1. Simulate network issues
2. Verify automatic retries with reduced limits
3. Check fallback behavior

**C. Test Edge Cases:**
```bash
# Test with invalid project ID
curl "http://localhost:3000/api/planner/scheduled?projectId=invalid"

# Test with excessive limit
curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID&limit=1000"

# Test without project ID
curl "http://localhost:3000/api/planner/scheduled"
```

---

## 📊 Performance Monitoring

### **Real-time Monitoring:**

The frontend now includes performance monitoring:
- **Green indicator**: Query <1s (optimized)
- **Yellow indicator**: Query 1-5s (acceptable)
- **Red indicator**: Query >5s (needs attention)

### **Database Monitoring Queries:**

**Check index usage:**
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'planner_scheduled_posts'
ORDER BY idx_scan DESC;
```

**Check table statistics:**
```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'planner_scheduled_posts';
```

**Check query performance:**
```sql
-- If you have pg_stat_statements enabled
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%planner_scheduled_posts%'
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🎯 Success Criteria

### **Performance Targets:**
- ✅ **No timeout errors** (code: 57014)
- ✅ **Query time <1 second** for typical loads
- ✅ **Graceful degradation** for large datasets
- ✅ **User-friendly error messages**
- ✅ **Automatic retry logic**

### **User Experience:**
- ✅ **Fast page loading** (<2 seconds)
- ✅ **Responsive calendar** (no lag)
- ✅ **Clear error messages** (if issues occur)
- ✅ **Progressive loading** (shows partial results)

### **Scalability:**
- ✅ **Handles 100+ posts** efficiently
- ✅ **Pagination ready** for 1000+ posts
- ✅ **Index optimization** for growth
- ✅ **Monitoring in place** for maintenance

---

## 🔧 Troubleshooting

### **If Queries Are Still Slow:**

1. **Check index usage:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM planner_scheduled_posts 
   WHERE project_id = 'your-project-id' 
   ORDER BY scheduled_date, scheduled_time 
   LIMIT 50;
   ```

2. **Verify indexes exist:**
   ```sql
   \d+ planner_scheduled_posts
   ```

3. **Check for table bloat:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('planner_scheduled_posts'));
   ```

4. **Update statistics:**
   ```sql
   ANALYZE planner_scheduled_posts;
   ```

### **If Timeouts Persist:**

1. **Reduce query limit** to 20-30
2. **Check database connection** pool settings
3. **Monitor database resources** (CPU, memory)
4. **Consider query optimization** or data archiving

### **If Errors Occur:**

1. **Check console logs** for detailed error messages
2. **Verify environment variables** are set correctly
3. **Test database connectivity** directly
4. **Check Supabase service status**

---

## 📈 Next Steps

1. **Deploy the optimizations** to production
2. **Monitor performance** for 1-2 weeks
3. **Collect user feedback** on loading speed
4. **Fine-tune limits** based on usage patterns
5. **Consider pagination** for very large datasets
6. **Set up alerts** for slow queries

The database should now handle scheduled posts efficiently without timeout errors!
