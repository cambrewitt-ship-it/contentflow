-- ============================================
-- SIMPLE RLS VERIFICATION - Single Result Set
-- ============================================
-- This version shows everything in one easy-to-read table
-- ============================================

-- Combined check with all critical information
SELECT 
    '1. RLS Status Check' as check_category,
    t.tablename as table_name,
    CASE 
        WHEN t.rowsecurity THEN '✅ ENABLED' 
        WHEN t.tablename IS NOT NULL THEN '❌ DISABLED'
        ELSE '⚠️ MISSING'
    END as rls_status,
    COALESCE(p.policy_count, 0) as policies,
    CASE 
        WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) >= 4 THEN '✅ GOOD'
        WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN '⚠️ INCOMPLETE'
        WHEN t.rowsecurity THEN '❌ NO POLICIES'
        ELSE '❌ RLS DISABLED'
    END as verdict
FROM (
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
    ]) as tablename
) tables
LEFT JOIN pg_tables t ON t.tablename = tables.tablename AND t.schemaname = 'public'
LEFT JOIN (
    SELECT tablename, COUNT(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
) p ON p.tablename = t.tablename
ORDER BY 
    CASE 
        WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) >= 4 THEN 1
        WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN 2
        WHEN t.rowsecurity THEN 3
        WHEN t.tablename IS NOT NULL THEN 4
        ELSE 5
    END,
    t.tablename;

