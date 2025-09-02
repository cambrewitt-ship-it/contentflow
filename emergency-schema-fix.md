# EMERGENCY SCHEMA FIX APPLIED

## 🚨 Problem
Multiple database schema errors were breaking the planner:
- `column planner_scheduled_posts.week_index does not exist`
- `column planner_scheduled_posts.is_confirmed does not exist`

## 🔍 Root Cause
The GET `/api/planner/scheduled` route was trying to SELECT columns that don't exist in the actual table.

## ❌ BROKEN QUERY (Before Fix)
```sql
SELECT id, project_id, client_id, caption, image_url, scheduled_date, scheduled_time, 
       late_status, late_post_id, platforms_scheduled, is_confirmed, created_at, updated_at
FROM planner_scheduled_posts
WHERE project_id = ?
ORDER BY scheduled_date, scheduled_time
LIMIT 50;
```

**Errors:**
- `is_confirmed` column doesn't exist
- `week_index` and `day_index` were previously removed but `is_confirmed` was missed

## ✅ FIXED QUERY (After Fix)
```sql
SELECT id, project_id, client_id, caption, image_url, post_notes, scheduled_date, scheduled_time, 
       late_status, late_post_id, platforms_scheduled, created_at, updated_at
FROM planner_scheduled_posts
WHERE project_id = ?
ORDER BY scheduled_date, scheduled_time
LIMIT 50;
```

**Changes:**
- ✅ **Removed `is_confirmed`** - column doesn't exist
- ✅ **Added `post_notes`** - this column actually exists and is used
- ✅ **Only existing columns** - query now matches actual table schema

## 📊 ACTUAL TABLE SCHEMA
The `planner_scheduled_posts` table actually has these columns:
```sql
CREATE TABLE planner_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  client_id UUID NOT NULL,
  caption TEXT,
  image_url TEXT,
  post_notes TEXT,                    -- ✅ EXISTS
  scheduled_date DATE,
  scheduled_time TIME,
  late_status TEXT,
  late_post_id TEXT,
  platforms_scheduled TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns that DON'T exist:**
- ❌ `week_index` (removed in previous fix)
- ❌ `day_index` (removed in previous fix)  
- ❌ `is_confirmed` (removed in this fix)

## 🔧 Files Fixed

### **1. API Route (`src/app/api/planner/scheduled/route.ts`)**
- ✅ **Removed `is_confirmed`** from SELECT queries
- ✅ **Added `post_notes`** to SELECT queries
- ✅ **Updated both query variants** (with/without image data)

### **2. Database Optimization Files**
- ✅ **`database-performance-optimization.sql`** - commented out `is_confirmed` index
- ✅ **`optimize-planner-scheduled-posts-performance.sql`** - commented out `is_confirmed` index
- ✅ **`corrected-planner-scheduled-posts-schema.sql`** - updated with actual schema

## 🎯 Expected Results
After this fix:
- ✅ **GET `/api/planner/scheduled` should work** without column errors
- ✅ **Scheduled posts should load** in the planner UI
- ✅ **No more schema mismatch errors**
- ✅ **Drag & drop should work** end-to-end

## 🧪 Test the Fix
1. **Try loading the planner page** - scheduled posts should now appear
2. **Check console logs** - should see successful query execution
3. **Test drag & drop** - posts should move from unscheduled to scheduled
4. **Verify database** - posts should be visible in Supabase dashboard

## 🚀 Status: EMERGENCY FIXED
The database schema errors have been resolved. The planner should now work without column existence errors.
