-- ============================================
-- VERIFY CURRENT RLS STATUS - RUN THIS NOW
-- ============================================
-- Copy this entire script and run it in Supabase SQL Editor
-- This will tell you EXACTLY what needs to be fixed
-- ============================================

SELECT '🔍 CHECKING YOUR CURRENT DATABASE RLS STATUS...' as message;
SELECT '' as separator;

-- ============================================
-- CHECK #1: Core Tables RLS Status
-- ============================================

SELECT '📋 CHECK #1: Do critical tables have RLS enabled?' as check_name;
SELECT '' as separator;

WITH critical_tables AS (
    SELECT unnest(ARRAY[
        'clients',
        'projects', 
        'posts',
        'calendar_unscheduled_posts',
        'calendar_scheduled_posts',
        'brand_documents',
        'website_scrapes',
        'brand_insights',
        'client_approval_sessions',
        'post_approvals',
        'client_uploads',
        'user_profiles'
    ]) as table_name
)
SELECT 
    CASE 
        WHEN t.rowsecurity THEN '✅' 
        WHEN t.tablename IS NOT NULL THEN '❌ CRITICAL'
        ELSE '⚠️  N/A'
    END as status,
    ct.table_name,
    CASE 
        WHEN t.rowsecurity THEN 'RLS ENABLED ✓'
        WHEN t.tablename IS NOT NULL THEN 'RLS DISABLED - SECURITY RISK!'
        ELSE 'Table does not exist'
    END as rls_status
FROM critical_tables ct
LEFT JOIN pg_tables t ON t.tablename = ct.table_name AND t.schemaname = 'public'
ORDER BY 
    CASE WHEN t.rowsecurity THEN 1 WHEN t.tablename IS NOT NULL THEN 2 ELSE 3 END,
    ct.table_name;

SELECT '' as separator;

-- ============================================
-- CHECK #2: calendar_scheduled_posts (CRITICAL!)
-- ============================================

SELECT '🚨 CHECK #2: calendar_scheduled_posts Status (MOST CRITICAL)' as check_name;
SELECT '' as separator;

-- Check if table exists and RLS status
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_scheduled_posts') 
        THEN '⚠️  Table does not exist'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_scheduled_posts' AND rowsecurity = true)
        THEN '✅ RLS Enabled'
        ELSE '❌ RLS DISABLED - CRITICAL SECURITY ISSUE!'
    END as rls_status;

-- Check policy count
SELECT 
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ Has all CRUD policies (' || COUNT(*) || '/4)'
        WHEN COUNT(*) >= 1 THEN '⚠️  Incomplete (' || COUNT(*) || '/4 policies)'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_scheduled_posts')
        THEN '❌ NO POLICIES - CRITICAL!'
        ELSE '⚠️  Table does not exist'
    END as policy_status
FROM pg_policies 
WHERE tablename = 'calendar_scheduled_posts';

SELECT '' as separator;

-- ============================================
-- CHECK #3: Policy Quality Check
-- ============================================

SELECT '🔍 CHECK #3: Are policies checking user ownership correctly?' as check_name;
SELECT '' as separator;

-- Find INCORRECT policies (don't check user_id = auth.uid())
SELECT 
    '❌' as status,
    tablename,
    policyname,
    'Policy does NOT verify user ownership!' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts', 'calendar_scheduled_posts', 'brand_documents', 'website_scrapes')
AND qual NOT LIKE '%user_id = auth.uid()%'
AND qual NOT LIKE '%auth.uid() = user_id%'
AND qual IS NOT NULL
LIMIT 10;

-- Summary
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public'
            AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts', 'calendar_scheduled_posts')
            AND qual NOT LIKE '%user_id = auth.uid()%'
            AND qual NOT LIKE '%auth.uid() = user_id%'
            AND qual IS NOT NULL
        ) THEN '❌ FOUND INCORRECT POLICIES - Users can access other users data!'
        ELSE '✅ All policies appear to check user ownership'
    END as result;

SELECT '' as separator;

-- ============================================
-- CHECK #4: Overly Permissive Policies
-- ============================================

SELECT '🔓 CHECK #4: Any overly permissive policies (WITH CHECK true)?' as check_name;
SELECT '' as separator;

SELECT 
    '❌' as status,
    tablename,
    policyname,
    'Allows ANY authenticated user!' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND with_check LIKE '%true%'
AND tablename != 'user_profiles';

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public'
            AND with_check LIKE '%true%'
            AND tablename != 'user_profiles'
        ) THEN '❌ FOUND OVERLY PERMISSIVE POLICIES'
        ELSE '✅ No overly permissive policies found'
    END as result;

SELECT '' as separator;

-- ============================================
-- CHECK #5: Data Integrity
-- ============================================

SELECT '📊 CHECK #5: Data Integrity - Any orphaned records?' as check_name;
SELECT '' as separator;

-- Clients without user_id
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅'
        ELSE '⚠️ '
    END as status,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'All clients have user_id'
        ELSE 'Clients without user_id (will be inaccessible!)'
    END as issue
FROM clients
WHERE user_id IS NULL;

SELECT '' as separator;

-- ============================================
-- FINAL VERDICT
-- ============================================

SELECT '🎯 FINAL VERDICT' as verdict_title;
SELECT '' as separator;

WITH 
rls_enabled AS (
    SELECT COUNT(*) as count
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'clients', 'projects', 'posts',
        'calendar_unscheduled_posts', 'calendar_scheduled_posts',
        'brand_documents', 'website_scrapes', 'brand_insights',
        'client_approval_sessions', 'post_approvals', 'client_uploads'
    )
),
scheduled_posts_rls AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_scheduled_posts' AND rowsecurity = true)
            THEN 1 ELSE 0
        END as enabled
),
scheduled_posts_policies AS (
    SELECT COUNT(*) as count
    FROM pg_policies 
    WHERE tablename = 'calendar_scheduled_posts'
),
incorrect_policies AS (
    SELECT COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts', 'calendar_scheduled_posts')
    AND qual NOT LIKE '%user_id = auth.uid()%'
    AND qual NOT LIKE '%auth.uid() = user_id%'
    AND qual IS NOT NULL
),
permissive_policies AS (
    SELECT COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND with_check LIKE '%true%'
    AND tablename != 'user_profiles'
),
orphaned_clients AS (
    SELECT COUNT(*) as count 
    FROM clients 
    WHERE user_id IS NULL
)
SELECT 
    CASE 
        WHEN sp_rls.enabled = 0 THEN '🔴 DO NOT LAUNCH'
        WHEN sp_pol.count < 4 THEN '🔴 DO NOT LAUNCH'
        WHEN inc.count > 0 THEN '🟡 LAUNCH AT RISK'
        WHEN perm.count > 0 THEN '🟡 LAUNCH AT RISK'
        WHEN rls.count >= 10 AND sp_pol.count >= 4 AND inc.count = 0 AND perm.count = 0 AND orp.count = 0
        THEN '🟢 READY TO LAUNCH'
        ELSE '🟡 REVIEW NEEDED'
    END as launch_status,
    rls.count || '/11' as tables_with_rls,
    sp_pol.count || '/4' as scheduled_posts_policies,
    inc.count as incorrect_policies,
    perm.count as permissive_policies,
    orp.count as orphaned_clients
FROM rls_enabled rls, scheduled_posts_rls sp_rls, scheduled_posts_policies sp_pol, 
     incorrect_policies inc, permissive_policies perm, orphaned_clients orp;

SELECT '' as separator;

-- ============================================
-- NEXT STEPS
-- ============================================

SELECT '📝 NEXT STEPS' as next_steps_title;
SELECT '' as separator;

WITH checks AS (
    SELECT 
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'calendar_scheduled_posts') as sched_pol,
        (SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'calendar_scheduled_posts' AND rowsecurity = true) THEN 1 ELSE 0 END) as sched_rls,
        (SELECT COUNT(*) FROM pg_policies 
         WHERE schemaname = 'public' 
         AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts')
         AND qual NOT LIKE '%user_id = auth.uid()%'
         AND qual IS NOT NULL) as incorrect_count,
        (SELECT COUNT(*) FROM pg_policies 
         WHERE schemaname = 'public' 
         AND with_check LIKE '%true%' 
         AND tablename != 'user_profiles') as permissive_count
)
SELECT 
    CASE 
        WHEN c.sched_rls = 0 OR c.sched_pol = 0 THEN 
            '🚨 URGENT: Run fix-rls-security-critical.sql IMMEDIATELY'
        WHEN c.incorrect_count > 0 OR c.permissive_count > 0 THEN
            '⚠️  IMPORTANT: Run fix-rls-security-critical.sql before launch'
        ELSE
            '✅ You appear secure! Run test-rls-functionality.sql to verify'
    END as recommendation
FROM checks c;

SELECT '' as separator;
SELECT '✅ Scan complete! See results above.' as status;

