# 🔒 Row Level Security (RLS) Audit Report

**Date:** October 9, 2025  
**App:** ContentFlow v2  
**Status:** ⚠️ CRITICAL SECURITY ISSUES FOUND

---

## Executive Summary

Your Supabase database has RLS enabled on most tables, but there are **several critical security vulnerabilities** that need to be addressed before launching to production. The most serious issues involve:

1. ❌ **Missing RLS policies on scheduled_posts/calendar_scheduled_posts tables**
2. ❌ **Overly permissive INSERT policy on unscheduled posts**
3. ⚠️ **Incorrect RLS policy in client_uploads table**
4. ⚠️ **Service role key exposed in API routes (potential risk)**
5. ⚠️ **No RLS policies for scheduled_posts/calendar_scheduled_posts**

---

## Critical Issues (MUST FIX BEFORE LAUNCH)

### 🚨 Issue #1: Missing RLS on Scheduled Posts Tables

**Severity:** CRITICAL  
**Risk:** Anyone with database access could view/modify ALL scheduled posts across ALL clients

**Problem:**
```sql
-- From corrected-planner-scheduled-posts-schema.sql
CREATE TABLE IF NOT EXISTS planner_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  client_id UUID NOT NULL,
  caption TEXT,
  image_url TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  late_status TEXT,
  late_post_id TEXT,
  platforms_scheduled TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO RLS POLICIES DEFINED! ❌
```

**Impact:**
- Without RLS policies, if the table has RLS enabled but no policies, NO ONE can access data (breaks app)
- If RLS is disabled, ANYONE can access ALL scheduled posts (major security breach)

**Fix Required:**
```sql
-- Enable RLS on scheduled posts table
ALTER TABLE calendar_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for scheduled posts
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
```

---

### 🚨 Issue #2: Overly Permissive INSERT Policy

**Severity:** HIGH  
**Risk:** Any authenticated user can create posts for ANY client

**Problem:**
```sql
-- From fix-planner-unscheduled-posts-rls.sql (line 25-28)
CREATE POLICY "Allow authenticated users to insert posts" ON planner_unscheduled_posts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);  -- ❌ This allows ANY authenticated user!
```

**Impact:**
- Any logged-in user could create posts for clients they don't own
- Data integrity compromise
- Potential for spam/abuse

**Fix Required:**
```sql
-- Drop the permissive policy
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
```

---

### 🚨 Issue #3: Incorrect RLS Policy in client_uploads

**Severity:** HIGH  
**Risk:** client_uploads table has wrong comparison logic

**Problem:**
```sql
-- From add-portal-fields.sql (line 35-44)
CREATE POLICY "Clients can view their own uploads" ON client_uploads
  FOR SELECT USING (client_id = auth.uid()::text);  -- ❌ WRONG!

-- client_id is UUID referencing clients(id), NOT auth user ID
```

**Impact:**
- Users cannot access their uploads because `client_id` is not the same as `auth.uid()`
- The comparison is checking if the client UUID equals the user UUID (will always be false)

**Fix Required:**
```sql
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
```

---

## Medium Priority Issues

### ⚠️ Issue #4: Inconsistent Policy Patterns

**Problem:** Your RLS policies use different patterns across tables, making them harder to maintain:

**Pattern 1 (Incorrect):**
```sql
-- This pattern doesn't check user ownership
client_id IN (
  SELECT id FROM clients 
  WHERE id = table_name.client_id  -- Just checks if client exists
)
```

**Pattern 2 (Correct):**
```sql
-- This pattern properly checks user ownership
client_id IN (
  SELECT id FROM clients 
  WHERE user_id = auth.uid()  -- ✅ Checks user owns the client
)
```

**Tables Affected:**
- `projects` (uses Pattern 1)
- `posts` (uses Pattern 1)
- `brand_documents` (uses Pattern 1)
- `website_scrapes` (uses Pattern 1)
- `brand_insights` (uses Pattern 1)
- `client_approval_sessions` (uses Pattern 1)
- `post_approvals` (uses Pattern 1)

**Risk:** Pattern 1 doesn't actually enforce user ownership! It only checks if the client_id exists in the clients table, not if the user owns that client.

**Fix Required:** Update ALL policies to use Pattern 2 (check `user_id = auth.uid()`).

---

### ⚠️ Issue #5: Service Role Key Usage

**Current Implementation:**
```typescript
// From multiple API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!  // ⚠️ Bypasses ALL RLS
);
```

**Risk Level:** MEDIUM (if your API routes have proper auth)

**Why It's a Concern:**
- Service role key bypasses ALL RLS policies
- If an API route is compromised or has an auth bug, attackers get full database access
- Your API routes ARE checking authentication, which is good
- However, this creates a single point of failure

**Current Mitigation:**
✅ You DO check auth tokens in most routes (e.g., `/api/clients/route.ts`)  
✅ You DO validate portal tokens for portal access  
✅ You DO check `portal_enabled` flag

**Recommendation:**
Consider using user-specific tokens instead of service role where possible:

```typescript
// Better approach for user-authenticated routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Get user token from request
const token = req.headers.get('authorization')?.replace('Bearer ', '');

// Create client with user's token (respects RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey);
await supabase.auth.setSession({ access_token: token, refresh_token: '' });
```

---

### ⚠️ Issue #6: Portal Token Security

**Current Implementation:**
```sql
-- From add-portal-fields.sql
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;
```

**Concerns:**
1. Portal tokens appear to be permanent (no expiration)
2. No rate limiting visible on portal endpoints
3. Tokens are simple UUIDs (not signed JWT)

**Risk:** 
- If a portal token leaks, it provides permanent access until manually revoked
- No automatic expiration means tokens could be used indefinitely

**Recommendations:**
1. Add token expiration:
   ```sql
   ALTER TABLE clients ADD COLUMN portal_token_expires_at TIMESTAMP WITH TIME ZONE;
   ```
2. Add token refresh mechanism
3. Implement rate limiting on portal endpoints (you have rate limiting infrastructure)
4. Consider using signed JWTs instead of plain UUIDs
5. Add audit logging for portal access

---

## Tables with Good RLS Implementation ✅

These tables have proper RLS policies:

1. **user_profiles** ✅
   - Proper user-specific policies
   - Users can only view/update their own profile

2. **clients** ✅
   - Proper user ownership check (`auth.uid() = user_id`)
   - Users can only see their own clients

3. **calendar_unscheduled_posts** ✅ (if using the fix-planner-unscheduled-posts-rls.sql)
   - Proper user ownership via clients table
   - Note: Still has the overly permissive INSERT policy issue

---

## Tables Requiring RLS Policies

These tables need RLS policies added:

1. ❌ **calendar_scheduled_posts** (or planner_scheduled_posts)
2. ❌ **scheduled_posts** (if exists separately)
3. ❌ **unscheduled_posts** (if exists separately)

---

## SQL Migration Script to Fix All Issues

```sql
-- ============================================
-- CRITICAL FIX: Add RLS to calendar_scheduled_posts
-- ============================================

-- Enable RLS on calendar_scheduled_posts
ALTER TABLE calendar_scheduled_posts ENABLE ROW LEVEL SECURITY;

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
-- FIX: Remove overly permissive INSERT policy
-- ============================================

-- Drop the permissive policy
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
-- FIX: Correct client_uploads RLS policies
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

-- Keep service role policy for API access
-- CREATE POLICY "Service role full access" ON client_uploads
--   FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FIX: Update projects table policies
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
-- FIX: Update posts table policies
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
-- FIX: Update brand_documents policies
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
-- FIX: Update website_scrapes policies
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
-- FIX: Update brand_insights policies
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
-- FIX: Update client_approval_sessions policies
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
-- FIX: Update post_approvals policies
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
-- VERIFY: Check all RLS policies are correct
-- ============================================

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
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- VERIFY: Check which tables have RLS enabled
-- ============================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

---

## Additional Security Recommendations

### 1. Enable Realtime RLS
If you're using Supabase Realtime subscriptions, ensure RLS is enforced:

```sql
-- Check realtime settings
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
-- ... add other tables as needed
```

### 2. Add Audit Logging
Consider adding audit logging for sensitive operations:

```sql
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow viewing own audit logs
CREATE POLICY "Users can view their own audit logs" ON audit_log
  FOR SELECT USING (auth.uid() = user_id);
```

### 3. Add Rate Limiting to Portal
Your portal endpoints need rate limiting:

```typescript
// Add to portal routes
import { simpleRateLimit } from '@/lib/simpleRateLimit';

export async function GET(request: NextRequest) {
  // Rate limit portal access
  const ip = request.ip ?? 'unknown';
  const { success } = await simpleRateLimit(ip, 100, 3600); // 100 req/hour
  
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  // ... rest of portal logic
}
```

### 4. Environment Variable Security Checklist

Ensure these are set correctly:

```bash
# ✅ Public (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ⚠️ PRIVATE (never expose to client)
NEXT_SUPABASE_SERVICE_ROLE=your-service-role-key  # Keep secret!
LATE_API_KEY=your-late-api-key  # Keep secret!
```

Make sure:
- Service role key is NEVER sent to client
- Service role key is NOT in git
- Service role key is in `.env.local` (gitignored)
- Production uses environment variables, not .env files

---

## Pre-Launch Checklist

Before going live, complete these steps:

- [ ] Run the SQL migration script above in Supabase SQL Editor
- [ ] Verify all tables have RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
- [ ] Test user isolation: Create 2 test users, ensure they can't see each other's data
- [ ] Test portal access with valid and invalid tokens
- [ ] Add rate limiting to all portal endpoints
- [ ] Review all API routes for proper authentication
- [ ] Enable Supabase database backups
- [ ] Set up monitoring/alerts for failed auth attempts
- [ ] Document your RLS policies for your team
- [ ] Add portal token expiration mechanism
- [ ] Test with service role disabled (temporarily) to ensure RLS works
- [ ] Review Supabase logs for any RLS policy violations

---

## Testing Your RLS Policies

### Test 1: User Isolation
```sql
-- As User A (logged in)
SELECT * FROM clients WHERE user_id != auth.uid();
-- Should return 0 rows

-- As User B (logged in)
INSERT INTO clients (name, user_id) VALUES ('Test', 'user-a-id');
-- Should fail with RLS violation
```

### Test 2: Portal Access
```bash
# Test with invalid token
curl https://your-app.com/api/portal/calendar?token=invalid
# Should return 401

# Test with valid but disabled token
curl https://your-app.com/api/portal/calendar?token=valid-but-disabled
# Should return 401 "Portal access is disabled"
```

### Test 3: Service Role Bypass
```typescript
// Temporarily comment out service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // Use anon instead
);
// Test if your app still works (it should, via user tokens)
```

---

## Summary

**Status:** 🔴 **DO NOT LAUNCH WITHOUT FIXES**

**Critical Fixes Required:**
1. Add RLS policies to `calendar_scheduled_posts` table
2. Fix overly permissive INSERT policy on unscheduled posts
3. Correct `client_uploads` RLS policies
4. Update all policies to use proper user ownership checks

**After Fixes:**
- Run migration script
- Test thoroughly with multiple users
- Enable monitoring
- Add rate limiting to portal

**Estimated Time to Fix:** 1-2 hours  
**Risk if Launched Without Fixes:** HIGH - Data breach, unauthorized access

---

## Questions or Concerns?

If you need help implementing these fixes or have questions about any of the recommendations, please ask! Security is critical for protecting your users' data.

**Priority:** Fix Critical Issues → Test → Add Rate Limiting → Launch ✅

