-- ============================================
-- RLS Functionality Test Script
-- ============================================
-- Purpose: Verify that RLS policies work AND don't break functionality
-- Run this AFTER applying fix-rls-security-critical.sql
-- ============================================

-- ============================================
-- TEST 1: Verify RLS is enabled on all tables
-- ============================================

SELECT '🧪 TEST 1: Checking RLS Status' as test_name;
SELECT '' as separator;

SELECT 
    CASE 
        WHEN rowsecurity THEN '✅' 
        ELSE '❌' 
    END as status,
    tablename,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED' 
        ELSE 'RLS DISABLED - SECURITY RISK!' 
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
-- TEST 2: Verify all tables have policies
-- ============================================

SELECT '🧪 TEST 2: Counting Policies Per Table' as test_name;
SELECT '' as separator;

SELECT 
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅' 
        WHEN COUNT(*) = 1 THEN '⚠️ ' 
        ELSE '❌' 
    END as status,
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 2 THEN 'Good'
        WHEN COUNT(*) = 1 THEN 'Missing policies'
        ELSE 'NO POLICIES - SECURITY RISK!'
    END as assessment
FROM pg_policies 
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
GROUP BY tablename
ORDER BY policy_count DESC, tablename;

SELECT '' as separator;

-- ============================================
-- TEST 3: Verify critical table policies
-- ============================================

SELECT '🧪 TEST 3: Checking Critical Table Policies' as test_name;
SELECT '' as separator;

-- Check calendar_scheduled_posts
SELECT 
    CASE WHEN COUNT(*) >= 4 THEN '✅' ELSE '❌' END as status,
    'calendar_scheduled_posts' as table_name,
    COUNT(*) as policies,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'Has SELECT, INSERT, UPDATE, DELETE'
        ELSE 'MISSING POLICIES - CRITICAL!'
    END as assessment
FROM pg_policies 
WHERE tablename = 'calendar_scheduled_posts';

-- Check calendar_unscheduled_posts
SELECT 
    CASE WHEN COUNT(*) >= 4 THEN '✅' ELSE '❌' END as status,
    'calendar_unscheduled_posts' as table_name,
    COUNT(*) as policies,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'Has SELECT, INSERT, UPDATE, DELETE'
        ELSE 'MISSING POLICIES - CRITICAL!'
    END as assessment
FROM pg_policies 
WHERE tablename = 'calendar_unscheduled_posts';

-- Check clients table
SELECT 
    CASE WHEN COUNT(*) >= 4 THEN '✅' ELSE '❌' END as status,
    'clients' as table_name,
    COUNT(*) as policies,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'Has SELECT, INSERT, UPDATE, DELETE'
        ELSE 'MISSING POLICIES - CRITICAL!'
    END as assessment
FROM pg_policies 
WHERE tablename = 'clients';

SELECT '' as separator;

-- ============================================
-- TEST 4: Check for overly permissive policies
-- ============================================

SELECT '🧪 TEST 4: Checking for Overly Permissive Policies' as test_name;
SELECT '' as separator;

-- Look for policies with "true" in WITH CHECK (too permissive)
SELECT 
    '⚠️ ' as status,
    tablename,
    policyname,
    'WITH CHECK (true) - TOO PERMISSIVE!' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND with_check LIKE '%true%'
AND tablename != 'user_profiles';  -- user_profiles might legitimately have this

-- If no results, that's good!
SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND with_check LIKE '%true%'
    AND tablename != 'user_profiles'
) THEN '✅ No overly permissive policies found' 
ELSE '❌ Found overly permissive policies above'
END as result;

SELECT '' as separator;

-- ============================================
-- TEST 5: Verify policies check user ownership
-- ============================================

SELECT '🧪 TEST 5: Checking Policies Check User Ownership' as test_name;
SELECT '' as separator;

-- Check if policies properly check auth.uid()
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%user_id = auth.uid()%' THEN '✅'
        WHEN with_check LIKE '%auth.uid()%' OR with_check LIKE '%user_id = auth.uid()%' THEN '✅'
        ELSE '⚠️ '
    END as status,
    CASE 
        WHEN qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' THEN 'Checks user ownership'
        ELSE 'May not check user ownership'
    END as assessment
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('clients', 'projects', 'calendar_unscheduled_posts', 'calendar_scheduled_posts')
ORDER BY tablename, policyname;

SELECT '' as separator;

-- ============================================
-- TEST 6: Sample data check (if you have test data)
-- ============================================

SELECT '🧪 TEST 6: Sample Data Check' as test_name;
SELECT '' as separator;

-- Count records in key tables
SELECT 
    'clients' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as unique_users
FROM clients;

SELECT 
    'calendar_unscheduled_posts' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT client_id) as unique_clients
FROM calendar_unscheduled_posts;

SELECT 
    'calendar_scheduled_posts' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT client_id) as unique_clients  
FROM calendar_scheduled_posts;

SELECT '' as separator;

-- ============================================
-- TEST 7: Check for NULL user_ids (data issue)
-- ============================================

SELECT '🧪 TEST 7: Checking for NULL user_ids in clients' as test_name;
SELECT '' as separator;

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅'
        ELSE '⚠️ '
    END as status,
    COUNT(*) as clients_without_user_id,
    CASE 
        WHEN COUNT(*) = 0 THEN 'All clients have user_id'
        ELSE 'Some clients missing user_id - will be inaccessible!'
    END as assessment
FROM clients
WHERE user_id IS NULL;

-- Show which clients are affected (if any)
SELECT 
    '⚠️ ' as status,
    id,
    name,
    'Missing user_id' as issue
FROM clients
WHERE user_id IS NULL
LIMIT 5;

SELECT '' as separator;

-- ============================================
-- FINAL SUMMARY
-- ============================================

SELECT '📊 TEST SUMMARY' as summary;
SELECT '' as separator;

-- Overall RLS status
WITH rls_status AS (
    SELECT 
        COUNT(*) as tables_with_rls
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'clients', 'projects', 'posts',
        'calendar_unscheduled_posts', 'calendar_scheduled_posts',
        'brand_documents', 'website_scrapes', 'brand_insights',
        'client_approval_sessions', 'post_approvals',
        'client_uploads', 'user_profiles'
    )
),
policy_count AS (
    SELECT 
        COUNT(DISTINCT tablename) as tables_with_policies
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        'clients', 'projects', 'posts',
        'calendar_unscheduled_posts', 'calendar_scheduled_posts',
        'brand_documents', 'website_scrapes', 'brand_insights',
        'client_approval_sessions', 'post_approvals',
        'client_uploads', 'user_profiles'
    )
),
orphaned_clients AS (
    SELECT COUNT(*) as count FROM clients WHERE user_id IS NULL
)
SELECT 
    CASE 
        WHEN r.tables_with_rls >= 10 AND p.tables_with_policies >= 10 AND o.count = 0 
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as overall_status,
    r.tables_with_rls || '/12' as tables_with_rls,
    p.tables_with_policies || '/12' as tables_with_policies,
    o.count as clients_without_user_id,
    CASE 
        WHEN r.tables_with_rls >= 10 AND p.tables_with_policies >= 10 AND o.count = 0 
        THEN '✅ Ready for production'
        ELSE '⚠️  Fix issues above before launch'
    END as recommendation
FROM rls_status r, policy_count p, orphaned_clients o;

SELECT '' as separator;
SELECT '✅ Tests complete! Review results above.' as status;
SELECT '⚠️  If you see any ❌ or warnings, address them before launch.' as reminder;

