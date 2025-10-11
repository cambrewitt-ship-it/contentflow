# 🚀 Pre-Launch Security Checklist

**Status:** 🔴 **NOT READY FOR PRODUCTION**

---

## ⚠️ CRITICAL ISSUES (Must Fix Before Launch)

- [ ] **Run `fix-rls-security-critical.sql` in Supabase SQL Editor**
  - This fixes all critical RLS policy issues
  - Takes ~5-10 minutes to complete
  - Location: `/fix-rls-security-critical.sql`

- [ ] **Verify RLS is working correctly**
  - Create 2 test users
  - Ensure User A cannot see User B's clients/data
  - Test with SQL: `SELECT * FROM clients WHERE user_id != auth.uid();` (should return 0 rows)

- [ ] **Test scheduled posts security**
  - Verify calendar_scheduled_posts table has RLS enabled
  - Test that users can only see their own scheduled posts
  - Check: `SELECT * FROM pg_policies WHERE tablename = 'calendar_scheduled_posts';`

---

## 🔒 High Priority Security Items

- [ ] **Review service role key usage**
  - Ensure `NEXT_SUPABASE_SERVICE_ROLE` is NOT in git
  - Verify it's in `.env.local` (gitignored)
  - Confirm production uses environment variables

- [ ] **Add rate limiting to portal endpoints**
  - `/api/portal/validate`
  - `/api/portal/calendar`
  - `/api/portal/approvals`
  - `/api/portal/upload`
  - Use: `simpleRateLimit(ip, 100, 3600)` (100 requests/hour)

- [ ] **Add portal token expiration**
  ```sql
  ALTER TABLE clients ADD COLUMN portal_token_expires_at TIMESTAMP WITH TIME ZONE;
  ```

- [ ] **Test portal security**
  - Try accessing portal with invalid token (should fail)
  - Try accessing with `portal_enabled = false` (should fail)
  - Verify only correct client's data is returned

---

## 📊 Medium Priority Items

- [ ] **Enable Supabase database backups**
  - Go to Supabase Dashboard → Settings → Backups
  - Enable automated daily backups
  - Test restore process

- [ ] **Set up monitoring/alerts**
  - Monitor failed authentication attempts
  - Alert on unusual API patterns
  - Track RLS policy violations

- [ ] **Add audit logging**
  - Log portal access attempts
  - Log data modifications
  - Track user actions

- [ ] **Review environment variables**
  ```bash
  # Verify these are set:
  NEXT_PUBLIC_SUPABASE_URL=✓
  NEXT_PUBLIC_SUPABASE_ANON_KEY=✓
  NEXT_SUPABASE_SERVICE_ROLE=✓ (KEEP SECRET!)
  LATE_API_KEY=✓ (KEEP SECRET!)
  ```

---

## 🧪 Testing Checklist

### Test 1: User Data Isolation
- [ ] Create User A with Client A
- [ ] Create User B with Client B
- [ ] Log in as User A → verify only sees Client A
- [ ] Log in as User B → verify only sees Client B
- [ ] Try to access User B's client via API as User A (should fail)

### Test 2: Portal Security
- [ ] Generate portal token for a client
- [ ] Access portal with valid token → should work
- [ ] Access portal with invalid token → should fail with 401
- [ ] Disable portal access → should fail with "Portal access disabled"
- [ ] Try to access another client's data via portal → should fail

### Test 3: RLS Policies
```sql
-- As authenticated user, try to view other users' data
SELECT * FROM clients WHERE user_id != auth.uid();
-- Should return 0 rows

-- Try to insert data for another user
INSERT INTO clients (name, user_id) VALUES ('Test', 'other-user-id');
-- Should fail with RLS policy violation
```

### Test 4: API Authentication
- [ ] Try accessing `/api/clients` without auth token → should fail
- [ ] Try accessing `/api/projects` without auth token → should fail
- [ ] Try accessing client data with wrong user's token → should fail

---

## 🚨 Security Vulnerabilities Found

### CRITICAL (Fixed by running fix-rls-security-critical.sql)

1. **❌ Missing RLS on scheduled_posts**
   - Severity: CRITICAL
   - Impact: Anyone could view/modify ALL scheduled posts
   - Status: Fixed by migration script

2. **❌ Overly permissive INSERT policy**
   - Severity: HIGH
   - Impact: Any authenticated user could create posts for ANY client
   - Status: Fixed by migration script

3. **❌ Incorrect client_uploads RLS**
   - Severity: HIGH
   - Impact: Users couldn't access their own uploads
   - Status: Fixed by migration script

### MEDIUM (Manual fixes required)

4. **⚠️ No portal rate limiting**
   - Severity: MEDIUM
   - Impact: Portal could be abused/DOS'd
   - Status: Need to add to portal routes

5. **⚠️ No token expiration**
   - Severity: MEDIUM
   - Impact: Leaked tokens work forever
   - Status: Need to add expiration logic

---

## ✅ What's Already Secure

- ✅ User profiles have proper RLS
- ✅ Clients table has user ownership checks
- ✅ API routes check authentication
- ✅ Portal validates tokens before access
- ✅ Service role key is used server-side only
- ✅ You have rate limiting infrastructure in place

---

## 📝 Post-Fix Verification

After running `fix-rls-security-critical.sql`, verify:

```sql
-- 1. Check all tables have RLS enabled
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Verify calendar_scheduled_posts has policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'calendar_scheduled_posts';
-- Should see: SELECT, INSERT, UPDATE, DELETE policies
```

---

## 🎯 Quick Action Plan

### Step 1: Fix Critical Issues (30 minutes)
1. Open Supabase SQL Editor
2. Copy contents of `fix-rls-security-critical.sql`
3. Run the script
4. Verify output shows all tables with RLS enabled

### Step 2: Test Security (1 hour)
1. Create 2 test user accounts
2. Add test client for each user
3. Test user isolation (complete Test 1 above)
4. Test portal access (complete Test 2 above)

### Step 3: Add Rate Limiting (30 minutes)
1. Add rate limiting to portal routes
2. Test rate limit is enforced
3. Document rate limits for users

### Step 4: Final Checks (30 minutes)
1. Review all environment variables
2. Verify backups are enabled
3. Test one more time with fresh users
4. Document any remaining issues

**Total Time Estimate: 2.5 - 3 hours**

---

## 🆘 If Something Goes Wrong

### If users can't access their data after fix:
```sql
-- Check if RLS policies exist
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- Temporarily check user_id assignment
SELECT id, name, user_id FROM clients LIMIT 10;

-- Ensure all clients have user_id
UPDATE clients SET user_id = 'your-user-id' WHERE user_id IS NULL;
```

### If portal stops working:
1. Check if portal_enabled is true: `SELECT portal_enabled FROM clients WHERE id = 'client-id';`
2. Verify portal_token exists: `SELECT portal_token FROM clients WHERE id = 'client-id';`
3. Check API logs for specific error messages

### If scheduled posts disappear:
```sql
-- Check if data still exists
SELECT COUNT(*) FROM calendar_scheduled_posts;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'calendar_scheduled_posts';

-- Temporarily disable RLS to verify data exists (DON'T LEAVE DISABLED!)
ALTER TABLE calendar_scheduled_posts DISABLE ROW LEVEL SECURITY;
SELECT COUNT(*) FROM calendar_scheduled_posts;
ALTER TABLE calendar_scheduled_posts ENABLE ROW LEVEL SECURITY;
```

---

## 📞 Support Resources

- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- Detailed audit report: `RLS_SECURITY_AUDIT.md`
- Fix script: `fix-rls-security-critical.sql`

---

## ✅ Ready to Launch?

Only check this box when ALL of the following are true:

- [ ] Ran `fix-rls-security-critical.sql` successfully
- [ ] Tested with 2+ users and verified data isolation
- [ ] Added rate limiting to portal endpoints  
- [ ] Verified all environment variables are secure
- [ ] Tested portal with valid/invalid tokens
- [ ] Enabled database backups
- [ ] Reviewed and understand all security recommendations

**If all boxes are checked:** 🎉 **You're ready to launch!**

**If any boxes are unchecked:** ⚠️ **DO NOT LAUNCH - Complete remaining items first**

---

**Last Updated:** October 9, 2025  
**Next Review:** After running fix script + Before each major release

