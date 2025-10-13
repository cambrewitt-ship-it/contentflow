-- ============================================
-- OPTIONAL: Add Missing RLS Policies
-- ============================================
-- These are NOT critical for launch, but add complete CRUD coverage
-- Only run if you actually need UPDATE/DELETE on these tables
-- ============================================

-- ============================================
-- brand_insights - Add UPDATE and DELETE
-- ============================================

CREATE POLICY "Users can update brand insights for their clients" ON brand_insights
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete brand insights for their clients" ON brand_insights
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- website_scrapes - Add UPDATE and DELETE
-- ============================================

CREATE POLICY "Users can update website scrapes for their clients" ON website_scrapes
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete website scrapes for their clients" ON website_scrapes
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- client_approval_sessions - Add UPDATE and DELETE
-- ============================================

CREATE POLICY "Users can update approval sessions for their clients" ON client_approval_sessions
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete approval sessions for their clients" ON client_approval_sessions
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- post_approvals - Add DELETE
-- ============================================

CREATE POLICY "Users can delete approvals for their clients" ON post_approvals
  FOR DELETE USING (
    session_id IN (
      SELECT cas.id FROM client_approval_sessions cas
      JOIN clients c ON c.id = cas.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ============================================
-- user_profiles - Add DELETE (be careful with this!)
-- ============================================

-- Only add this if users should be able to delete their own profiles
-- Usually this is handled by the auth system, not direct SQL
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (
    id = auth.uid()
  );

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETE'
        ELSE '⚠️ ' || COUNT(*) || ' policies'
    END as status
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'brand_insights', 
    'website_scrapes', 
    'client_approval_sessions', 
    'post_approvals', 
    'user_profiles'
)
GROUP BY tablename
ORDER BY tablename;

