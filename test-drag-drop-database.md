# Drag & Drop Database Test Guide

## 🔧 Debugging Steps

### 1. **Test the Drag & Drop Functionality**

1. **Open your browser console** (F12 → Console tab)
2. **Navigate to the planner page** with a project selected
3. **Drag a post from unscheduled to a calendar slot**
4. **Watch the console logs** - you should see:

```
📅 STEP 1 - USER SELECTION: (frontend)
📅 STEP 2 - FORMATTED VALUES: (frontend)
📅 STEP 3 - API REQUEST BODY: (frontend)
📅 STEP 4 - SENDING REQUEST TO /api/planner/scheduled: (frontend)
🔧 POST /api/planner/scheduled - DRAG & DROP DEBUG: (backend)
🔧 STEP 1 - VALIDATION PASSED: (backend)
🔧 STEP 2 - PREPARING INSERT DATA: (backend)
🔧 STEP 3 - INSERTING INTO planner_scheduled_posts: (backend)
✅ STEP 4 - SUCCESSFULLY INSERTED: (backend)
🔧 STEP 5 - DELETING FROM planner_unscheduled_posts: (backend)
✅ STEP 6 - SUCCESSFULLY DELETED FROM UNSCHEDULED (backend)
📅 STEP 5 - API RESPONSE: (frontend)
✅ STEP 6 - SUCCESSFUL RESPONSE: (frontend)
📅 STEP 7 - REFRESHING POST LISTS: (frontend)
```

### 2. **Check Database Directly**

**Option A: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **Table Editor** → **planner_scheduled_posts**
3. Look for the newly inserted post
4. Check if the `image_url` field has data

**Option B: SQL Query**
```sql
-- Check recent scheduled posts
SELECT 
  id,
  project_id,
  client_id,
  caption,
  image_url,
  scheduled_date,
  scheduled_time,
  created_at
FROM planner_scheduled_posts 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if image_url is populated
SELECT 
  COUNT(*) as total_posts,
  COUNT(image_url) as posts_with_images,
  COUNT(*) - COUNT(image_url) as posts_without_images
FROM planner_scheduled_posts;
```

### 3. **Troubleshooting Scenarios**

#### **Scenario A: Posts are being saved but not displayed**
- ✅ **Backend logs show**: "SUCCESSFULLY INSERTED"
- ✅ **Database shows**: New row in `planner_scheduled_posts`
- ❌ **Frontend shows**: Post doesn't appear in calendar
- **Issue**: GET route timeout problem (already fixed with indexes)

#### **Scenario B: Posts are not being saved**
- ❌ **Backend logs show**: Database insert error
- ❌ **Database shows**: No new row
- **Issue**: Database schema or data validation problem

#### **Scenario C: Frontend error before reaching backend**
- ❌ **Frontend logs show**: API Error Response
- **Issue**: Request validation or network problem

### 4. **Expected Database Schema**

The `planner_scheduled_posts` table should have these columns:
```sql
CREATE TABLE planner_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  client_id UUID NOT NULL,
  caption TEXT,
  image_url TEXT,  -- This should be populated
  post_notes TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  week_index INTEGER,
  day_index INTEGER,
  late_status TEXT,
  late_post_id TEXT,
  platforms_scheduled TEXT[],
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. **Performance Indexes**

Make sure you've run the performance optimization SQL:
```sql
-- Run this in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_planner_scheduled_posts_project_date 
ON planner_scheduled_posts(project_id, scheduled_date, scheduled_time);
```

### 6. **Common Issues & Solutions**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Timeout (57014)** | GET route fails, POST works | Run the performance indexes |
| **Missing image_url** | `image_url` is NULL | Check frontend data structure |
| **Validation error** | 400 Bad Request | Check required fields in request |
| **Database constraint** | 500 Internal Server Error | Check foreign key constraints |

## 🎯 Next Steps

1. **Test the drag & drop** and check console logs
2. **Verify database insertion** using Supabase dashboard
3. **Report findings** - which scenario matches your issue?
4. **Apply appropriate fix** based on the diagnosis

The comprehensive logging will show exactly where the process is failing!
