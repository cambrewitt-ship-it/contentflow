# Database Schema Fix Summary

## 🐛 Problem Identified

The GET `/api/planner/scheduled` route was failing with the error:
```
column planner_scheduled_posts.week_index does not exist
```

## 🔍 Root Cause

The SELECT query was trying to select `week_index` and `day_index` columns that don't exist in the actual `planner_scheduled_posts` table schema.

**What the code was trying to select:**
```sql
SELECT id, project_id, client_id, caption, image_url, scheduled_date, scheduled_time, 
       week_index, day_index, late_status, late_post_id, platforms_scheduled, 
       is_confirmed, created_at, updated_at
FROM planner_scheduled_posts
```

**What actually exists in the table:**
```sql
-- Actual columns in planner_scheduled_posts table:
id, project_id, client_id, caption, image_url, post_notes, scheduled_date, 
scheduled_time, late_status, late_post_id, platforms_scheduled, is_confirmed, 
created_at, updated_at
```

## ✅ Fixes Applied

### 1. **Fixed GET Route (`/api/planner/scheduled/route.ts`)**
- ✅ Removed `week_index` and `day_index` from SELECT queries
- ✅ Updated both `includeImageData=true` and `includeImageData=false` queries
- ✅ Added comments explaining the schema mismatch

### 2. **Fixed Project Scheduled Posts Route (`/api/projects/[projectId]/scheduled-posts/route.ts`)**
- ✅ Removed `week_index` and `day_index` from INSERT data
- ✅ Added comment explaining the schema mismatch

### 3. **Fixed Move Route (`/api/projects/[projectId]/scheduled-posts/[postId]/move/route.ts`)**
- ✅ Removed `week_index` and `day_index` from UPDATE data
- ✅ Added comment explaining the schema mismatch

### 4. **Updated Database Optimization Files**
- ✅ Commented out indexes for non-existent columns
- ✅ Updated `database-performance-optimization.sql`
- ✅ Updated `optimize-planner-scheduled-posts-performance.sql`

### 5. **Created Corrected Schema Documentation**
- ✅ Created `corrected-planner-scheduled-posts-schema.sql` with actual schema
- ✅ Documented which columns actually exist vs. which were referenced incorrectly

## 📊 Corrected Schema

The actual `planner_scheduled_posts` table has these columns:

```sql
CREATE TABLE planner_scheduled_posts (
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
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🎯 Expected Results

After these fixes:
- ✅ **GET `/api/planner/scheduled` should work** without column errors
- ✅ **Scheduled posts should load** in the planner UI
- ✅ **Drag & drop should work** end-to-end
- ✅ **Database queries should be fast** with proper indexes
- ✅ **No more schema mismatch errors**

## 🧪 Testing

1. **Test the GET route:**
   ```bash
   curl "http://localhost:3000/api/planner/scheduled?projectId=YOUR_PROJECT_ID"
   ```

2. **Test drag & drop:**
   - Drag a post from unscheduled to calendar
   - Check if it appears in the scheduled posts
   - Verify no console errors

3. **Check database directly:**
   - Use Supabase dashboard to verify posts are being saved
   - Confirm the correct columns are being populated

## 📝 Notes

- The `week_index` and `day_index` columns were referenced in multiple places but never actually created in the database
- The calendar positioning logic in the frontend doesn't rely on these database columns
- The frontend calculates week/day positions dynamically based on `scheduled_date`
- All functionality should work without these columns

The database schema mismatch has been resolved!
