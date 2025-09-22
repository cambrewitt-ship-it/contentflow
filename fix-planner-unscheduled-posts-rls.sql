-- Fix RLS policies for planner_unscheduled_posts table
-- This allows the API to insert posts into the table

-- First, let's check what RLS policies currently exist
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
WHERE tablename = 'planner_unscheduled_posts';

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can only see their own posts" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can only insert their own posts" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can only update their own posts" ON planner_unscheduled_posts;
DROP POLICY IF EXISTS "Users can only delete their own posts" ON planner_unscheduled_posts;

-- Create new permissive policies that allow API access
-- Allow all authenticated users to insert (for API operations)
CREATE POLICY "Allow authenticated users to insert posts" ON planner_unscheduled_posts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to see posts for their clients
CREATE POLICY "Users can see posts for their clients" ON planner_unscheduled_posts
    FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM clients 
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to update posts for their clients
CREATE POLICY "Users can update posts for their clients" ON planner_unscheduled_posts
    FOR UPDATE
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM clients 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients 
            WHERE user_id = auth.uid()
        )
    );

-- Allow users to delete posts for their clients
CREATE POLICY "Users can delete posts for their clients" ON planner_unscheduled_posts
    FOR DELETE
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM clients 
            WHERE user_id = auth.uid()
        )
    );

-- Verify the policies were created
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
