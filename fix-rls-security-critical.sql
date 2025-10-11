-- ============================================
-- CRITICAL RLS SECURITY FIXES
-- Run this BEFORE launching to production!
-- ============================================
-- Date: 2025-10-09
-- Purpose: Fix critical security vulnerabilities in RLS policies
-- Estimated time: 5-10 minutes to run
-- ============================================

-- ============================================
-- CRITICAL FIX #1: Add RLS to calendar_scheduled_posts
-- ============================================

-- Enable RLS on calendar_scheduled_posts
ALTER TABLE calendar_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view scheduled posts for their clients" ON calendar_scheduled_posts;
DROP POLICY IF EXISTS "Users can create scheduled posts for their clients" ON calendar_scheduled_posts;
DROP POLICY IF EXISTS "Users can update scheduled posts for their clients" ON calendar_scheduled_posts;
DROP POLICY IF EXISTS "Users can delete scheduled posts for their clients" ON calendar_scheduled_posts;

-- Add proper RLS policies for scheduled posts
CREATE POLICY "Users can view scheduled posts for their clients" 
ON calendar_scheduled_posts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scheduled posts for their clients" 
ON calendar_scheduled_posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scheduled posts for their clients" 
ON calendar_scheduled_posts
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scheduled posts for their clients" 
ON calendar_scheduled_posts
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- CRITICAL FIX #2: Remove overly permissive INSERT policy
-- ============================================

-- Drop the permissive policy that allows ANY authenticated user to insert
DROP POLICY IF EXISTS "Allow authenticated users to insert posts" ON calendar_unscheduled_posts;

-- Replace with proper client ownership check
CREATE POLICY "Users can create posts for their clients" 
ON calendar_unscheduled_posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- CRITICAL FIX #3: Correct client_uploads RLS policies
-- ============================================

-- Drop incorrect policies
DROP POLICY IF EXISTS "Clients can view their own uploads" ON client_uploads;
DROP POLICY IF EXISTS "Clients can insert their own uploads" ON client_uploads;
DROP POLICY IF EXISTS "Clients can update their own uploads" ON client_uploads;

-- Create correct policies
CREATE POLICY "Users can view uploads for their clients" ON client_uploads
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create uploads for their clients" ON client_uploads
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update uploads for their clients" ON client_uploads
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #4: Update projects table policies
-- ============================================

DROP POLICY IF EXISTS "Users can view projects for accessible clients" ON projects;
DROP POLICY IF EXISTS "Users can create projects for accessible clients" ON projects;
DROP POLICY IF EXISTS "Users can update projects for accessible clients" ON projects;
DROP POLICY IF EXISTS "Users can delete projects for accessible clients" ON projects;

CREATE POLICY "Users can view projects for their clients" ON projects
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects for their clients" ON projects
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects for their clients" ON projects
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects for their clients" ON projects
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #5: Update posts table policies
-- ============================================

DROP POLICY IF EXISTS "Users can view posts for accessible clients" ON posts;
DROP POLICY IF EXISTS "Users can create posts for accessible clients" ON posts;
DROP POLICY IF EXISTS "Users can update posts for accessible clients" ON posts;
DROP POLICY IF EXISTS "Users can delete posts for accessible clients" ON posts;

CREATE POLICY "Users can view posts for their clients" ON posts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create posts for their clients" ON posts
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update posts for their clients" ON posts
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete posts for their clients" ON posts
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #6: Update brand_documents policies
-- ============================================

DROP POLICY IF EXISTS "Users can view brand documents for accessible clients" ON brand_documents;
DROP POLICY IF EXISTS "Users can create brand documents for accessible clients" ON brand_documents;
DROP POLICY IF EXISTS "Users can update brand documents for accessible clients" ON brand_documents;
DROP POLICY IF EXISTS "Users can delete brand documents for accessible clients" ON brand_documents;

CREATE POLICY "Users can view brand documents for their clients" ON brand_documents
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create brand documents for their clients" ON brand_documents
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update brand documents for their clients" ON brand_documents
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete brand documents for their clients" ON brand_documents
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #7: Update website_scrapes policies
-- ============================================

DROP POLICY IF EXISTS "Users can view website scrapes for accessible clients" ON website_scrapes;
DROP POLICY IF EXISTS "Users can create website scrapes for accessible clients" ON website_scrapes;

CREATE POLICY "Users can view website scrapes for their clients" ON website_scrapes
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create website scrapes for their clients" ON website_scrapes
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #8: Update brand_insights policies
-- ============================================

DROP POLICY IF EXISTS "Users can view brand insights for accessible clients" ON brand_insights;
DROP POLICY IF EXISTS "Users can create brand insights for accessible clients" ON brand_insights;

CREATE POLICY "Users can view brand insights for their clients" ON brand_insights
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create brand insights for their clients" ON brand_insights
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #9: Update client_approval_sessions policies
-- ============================================

DROP POLICY IF EXISTS "Users can view client_approval_sessions for accessible clients" ON client_approval_sessions;
DROP POLICY IF EXISTS "Users can create client_approval_sessions for accessible clients" ON client_approval_sessions;

CREATE POLICY "Users can view approval sessions for their clients" ON client_approval_sessions
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create approval sessions for their clients" ON client_approval_sessions
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FIX #10: Update post_approvals policies
-- ============================================

DROP POLICY IF EXISTS "Users can view post_approvals for accessible sessions" ON post_approvals;
DROP POLICY IF EXISTS "Users can create post_approvals for accessible sessions" ON post_approvals;
DROP POLICY IF EXISTS "Users can update post_approvals for accessible sessions" ON post_approvals;

CREATE POLICY "Users can view approvals for their clients" ON post_approvals
  FOR SELECT USING (
    session_id IN (
      SELECT cas.id FROM client_approval_sessions cas
      JOIN clients c ON c.id = cas.client_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create approvals for their clients" ON post_approvals
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT cas.id FROM client_approval_sessions cas
      JOIN clients c ON c.id = cas.client_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update approvals for their clients" ON post_approvals
  FOR UPDATE USING (
    session_id IN (
      SELECT cas.id FROM client_approval_sessions cas
      JOIN clients c ON c.id = cas.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFICATION: Check all RLS policies are correct
-- ============================================

SELECT '🔍 Checking RLS policies...' as status;

SELECT 
    '✅ ' || tablename as table_name,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- VERIFICATION: Check which tables have RLS enabled
-- ============================================

SELECT '🔍 Checking RLS status on all tables...' as status;

SELECT 
    CASE 
        WHEN rowsecurity THEN '✅ ' 
        ELSE '❌ ' 
    END || tablename as table_name,
    CASE 
        WHEN rowsecurity THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%'
ORDER BY rowsecurity DESC, tablename;

-- ============================================
-- VERIFICATION: List all policies with details
-- ============================================

SELECT '📋 All RLS policies:' as status;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN roles::text LIKE '%authenticated%' THEN 'authenticated'
        WHEN roles::text LIKE '%public%' THEN 'public'
        ELSE roles::text
    END as role
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT '✅ RLS security fixes applied successfully!' as status;
SELECT '⚠️  IMPORTANT: Test with 2+ users to verify isolation works' as next_step;

