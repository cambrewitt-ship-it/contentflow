-- Temporarily disable RLS on planner_unscheduled_posts to test if that's the issue
-- This will help us determine if RLS is the problem or if there's another constraint

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity, relforcerowsecurity 
FROM pg_tables 
WHERE tablename = 'planner_unscheduled_posts';

-- Temporarily disable RLS
ALTER TABLE planner_unscheduled_posts DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity, relforcerowsecurity 
FROM pg_tables 
WHERE tablename = 'planner_unscheduled_posts';

-- Test insert (this should work now)
-- You can test this manually or the API should work

-- IMPORTANT: Re-enable RLS after testing
-- ALTER TABLE planner_unscheduled_posts ENABLE ROW LEVEL SECURITY;
