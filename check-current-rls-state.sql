-- ============================================
-- Check Current RLS State in Database
-- ============================================
-- Run this in Supabase SQL Editor to see what's actually in your database
-- This will tell you if you need to apply the fix script
-- ============================================

SELECT '🔍 CHECKING YOUR CURRENT RLS STATE...' as status;
SELECT '' as separator;

-- ============================================
-- CHECK #1: Which tables have RLS enabled?
-- ============================================

SELECT '📋 CHECK #1: RLS Enabled Status' as check_name;
SELECT '' as separator;

SELECT 
    CASE WHEN rowsecurity THEN '✅' ELSE '❌' END as status,
    tablename,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED' 
        ELSE 'RLS DISABLED - CRITICAL ISSUE!'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
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
)
ORDER BY rowsecurity DESC, tablename;

SELECT '' as separator;

-- ============================================
-- CHECK #2: Policy count per table
-- ============================================

SELECT '📊 CHECK #2: Policy Count Per Table' as check_name;
SELECT '' as separator;

SELECT 
    t.tablename,
    CASE 
        WHEN COUNT(p.policyname) >= 4 THEN '✅'
        WHEN COUNT(p.policyname) >= 1 THEN '⚠️ '
        ELSE '❌'
    END as status,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN COUNT(p.policyname) >= 4 THEN 'Good - Has CRUD policies'
        WHEN COUNT(p.policyname) >= 1 THEN 'Incomplete - Missing policies'
        ELSE 'CRITICAL - No policies!'
    END as assessment
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
AND t.tablename IN (
    'clients', 'projects', 'posts',
    'calendar_unscheduled_posts', 'calendar_scheduled_posts',
    'brand_documents', 'website_scrapes', 'brand_insights',
    'client_approval_sessions', 'post_approvals', 'client_uploads', 'user_profiles'
)
GROUP BY t.tablename
ORDER BY policy_count DESC, t.tablename;

SELECT '' as separator;

-- ============================================
-- CHECK #3: calendar_scheduled_posts (CRITICAL)
-- ============================================

SELECT '🚨 CHECK #3: calendar_scheduled_posts Status (CRITICAL TABLE)' as check_name;
SELECT '' as separator;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'calendar_scheduled_posts' 
            AND rowsecurity = true
        ) THEN '✅ RLS Enabled'
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'calendar_scheduled_posts'
        ) THEN '❌ RLS DISABLED - CRITICAL!'
        ELSE '⚠️  Table does not exist'
    END as rls_status;

SELECT 
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅'
        WHEN COUNT(*) >= 1 THEN '⚠️ '
        ELSE '❌'
    END as status,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'Has all CRUD policies'
        WHEN COUNT(*) >= 1 THEN 'Missing some policies - INCOMPLETE'
        ELSE 'NO POLICIES - CRITICAL SECURITY ISSUE!'
    END as assessment
FROM pg_policies 
WHERE tablename = 'calendar_scheduled_posts';

-- Show the actual policies (if any)
SELECT 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE tablename = 'calendar_scheduled_posts'
ORDER BY policyname;

SELECT '' as separator;

-- ============================================
-- CHECK #4: Incorrect policy patterns
-- ============================================

SELECT '🔍 CHECK #4: Checking for Incorrect Policy Patterns' as check_name;
SELECT '' as separator;

-- Look for policies that don't check user ownership
SELECT 
    '❌' as status,
    tablename,
    policyname,
    'INCORRECT - Does not check user_id = auth.uid()' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts', 'brand_documents', 'website_scrapes', 'brand_insights')
AND qual LIKE '%WHERE id = %'
AND qual NOT LIKE '%user_id = auth.uid()%'
LIMIT 10;

-- If no incorrect policies found
SELECT 
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN ('projects', 'posts', 'calendar_unscheduled_posts')
        AND qual LIKE '%WHERE id = %'
        AND qual NOT LIKE '%user_id = auth.uid()%'
    ) THEN '✅ No incorrect patterns found'
    ELSE '❌ Found incorrect patterns above (showing first 10)'
    END as result;

SELECT '' as separator;

-- ============================================
-- CHECK #5: Overly permissive policies
-- ============================================

SELECT '🔓 CHECK #5: Checking for Overly Permissive Policies' as check_name;
SELECT '' as separator;

-- Look for WITH CHECK (true)
SELECT 
    '❌' as status,
    tablename,
    policyname,
    'OVERLY PERMISSIVE - WITH CHECK (true)' as issue,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND with_check LIKE '%true%'
AND tablename != 'user_profiles';

-- If none found
SELECT 
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public'
        AND with_check LIKE '%true%'
        AND tablename != 'user_profiles'
    ) THEN '✅ No overly permissive policies found'
    ELSE '❌ Found overly permissive policies above'
    END as result;

SELECT '' as separator;

-- ============================================
-- CHECK #6: User ownership verification
-- ============================================

SELECT '👤 CHECK #6: Checking Policies Check User Ownership' as check_name;
SELECT '' as separator;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%user_id = auth.uid()%' THEN '✅ Correct'
        WHEN qual LIKE '%auth.uid() = user_id%' THEN '✅ Correct'
        WHEN qual LIKE '%auth.uid() = id%' THEN '✅ Correct'
        WHEN with_check LIKE '%user_id = auth.uid()%' THEN '✅ Correct'
        ELSE '❌ May not check ownership'
    END as status
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('clients', 'projects', 'calendar_unscheduled_posts', 'calendar_scheduled_posts', 'posts')
ORDER BY tablename, policyname;

SELECT '' as separator;

-- ============================================
-- CHECK #7: Data integrity check
-- ============================================

SELECT '📊 CHECK #7: Data Integrity Check' as check_name;
SELECT '' as separator;

-- Check for clients without user_id
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅'
        ELSE '⚠️ '
    END as status,
    COUNT(*) as clients_without_user_id,
    CASE 
        WHEN COUNT(*) = 0 THEN 'All clients have user_id assigned'
        ELSE 'Some clients missing user_id - WILL BE INACCESSIBLE'
    END as issue
FROM clients
WHERE user_id IS NULL;

-- Show affected clients (if any)
SELECT 
    id,
    name,
    'Missing user_id - will be inaccessible after RLS fix' as warning
FROM clients
WHERE user_id IS NULL
LIMIT 5;

SELECT '' as separator;

-- ============================================
-- FINAL VERDICT
-- ============================================

SELECT '🎯 FINAL VERDICT' as verdict;
SELECT '' as separator;

WITH 
rls_check AS (
    SELECT COUNT(*) as tables_with_rls
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
policy_check AS (
    SELECT COUNT(DISTINCT tablename) as tables_with_policies
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        'clients', 'projects', 'posts',
        'calendar_unscheduled_posts', 'calendar_scheduled_posts',
        'brand_documents', 'website_scrapes', 'brand_insights',
        'client_approval_sessions', 'post_approvals', 'client_uploads'
    )
),
scheduled_posts_check AS (
    SELECT COUNT(*) as policy_count
    FROM pg_policies 
    WHERE tablename = 'calendar_scheduled_posts'
),
orphaned_clients AS (
    SELECT COUNT(*) as count 
    FROM clients 
    WHERE user_id IS NULL
),
permissive_policies AS (
    SELECT COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND with_check LIKE '%true%'
    AND tablename != 'user_profiles'
)
SELECT 
    CASE 
        WHEN r.tables_with_rls >= 10 
             AND p.tables_with_policies >= 10 
             AND s.policy_count >= 4
             AND o.count = 0
             AND pp.count = 0
        THEN '✅ SECURE - Ready for production'
        WHEN s.policy_count = 0
        THEN '❌ CRITICAL - calendar_scheduled_posts has NO policies!'
        WHEN pp.count > 0
        THEN '❌ CRITICAL - Overly permissive policies found'
        ELSE '⚠️  ISSUES FOUND - Run fix-rls-security-critical.sql'
    END as overall_status,
    r.tables_with_rls || '/11' as tables_with_rls,
    p.tables_with_policies || '/11' as tables_with_policies,
    s.policy_count || '/4' as calendar_scheduled_posts_policies,
    o.count as clients_without_user_id,
    pp.count as overly_permissive_policies
FROM rls_check r, policy_check p, scheduled_posts_check s, orphaned_clients o, permissive_policies pp;

SELECT '' as separator;

-- ============================================
-- RECOMMENDATIONS
-- ============================================

SELECT '💡 RECOMMENDATIONS' as recommendations;
SELECT '' as separator;

-- Check if fix is needed
WITH checks AS (
    SELECT 
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'calendar_scheduled_posts') as sched_policies,
        (SELECT COUNT(*) FROM pg_policies 
         WHERE schemaname = 'public' 
         AND with_check LIKE '%true%' 
         AND tablename != 'user_profiles') as permissive_count
)
SELECT 
    CASE 
        WHEN sched_policies = 0 THEN 
            '🚨 URGENT: Run fix-rls-security-critical.sql immediately! calendar_scheduled_posts is not secured.'
        WHEN permissive_count > 0 THEN
            '⚠️  Run fix-rls-security-critical.sql to fix overly permissive policies.'
        ELSE
            '✅ Your RLS appears to be configured. Run test-rls-functionality.sql to verify everything works.'
    END as recommendation
FROM checks;

SELECT '' as separator;
SELECT '📝 Check complete! Review results above.' as status;

