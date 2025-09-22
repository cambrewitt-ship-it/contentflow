-- Fix conflicting RLS policies for planner_unscheduled_posts table
-- The issue is that there are two conflicting INSERT policies

-- Drop the conflicting "Client insert own" policy that's blocking API inserts
DROP POLICY IF EXISTS "Client insert own" ON planner_unscheduled_posts;

-- Drop the other conflicting "Client" policies that use auth.uid() = client_id
-- These don't make sense since client_id is a UUID, not a user ID
DROP POLICY IF EXISTS "Client select own" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Client update own" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Client delete own" ON planner_unscheduled_posts;

-- Verify the remaining policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'planner_unscheduled_posts'
ORDER BY policyname;
