# Authentication Testing Checklist

## Pre-Testing Setup

### 1. Verify Environment Variables
Check `.env.local` has these variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
CSRF_SECRET_KEY=your-random-secret-key
```

### 2. Clean Build and Restart
```bash
# Stop the dev server (Ctrl+C)
rm -rf .next
npm run dev
```

## Testing Steps

### Test 1: Basic Login Flow ✅

**Steps**:
1. Open browser to `http://localhost:3000/auth/login`
2. Open Browser DevTools (F12)
3. Go to Console tab
4. Enter valid credentials
5. Click "Sign In"

**Expected Results**:

**Browser Console**:
```
📝 Login form submitted
🔐 Starting sign in for: { email: "user@example.com" }
✅ Sign in successful (server-side): { userId: "...", hasUser: true }
✅ Session retrieved successfully after login
✅ Login successful in form handler, redirecting...
```

**Terminal (Server)**:
```
🔐 Server-side login route handler called
📧 Login attempt for: { email: "user@example.com" }
✅ Login successful: { userId: "...", hasSession: true, ... }
✅ Session verification: { hasSession: true, sessionMatches: true }
🔍 Middleware Auth Check: { pathname: "/dashboard", hasSession: true, userId: "..." }
```

**Network Tab** (in DevTools):
- Look for POST request to `/auth/login`
- Status should be `200 OK`
- Response should contain `{ success: true, user: {...}, redirectTo: "/dashboard" }`

**Cookies** (in DevTools → Application → Cookies):
- Should see cookies starting with `sb-` (Supabase auth cookies)
- Example: `sb-localhost-auth-token`

**Page Behavior**:
- Should redirect to `/dashboard`
- Should show the dashboard (not redirect back to login)

---

### Test 2: Session Persistence ✅

**Steps**:
1. After successful login (from Test 1)
2. Refresh the page (F5)

**Expected Results**:
- Should stay on `/dashboard`
- Should NOT redirect to `/auth/login`
- Terminal should show: `🔍 Middleware Auth Check: { ... hasSession: true ... }`

---

### Test 3: Protected Route Access ✅

**Steps**:
1. Log out (if there's a logout button) OR clear cookies manually
2. Try to access `http://localhost:3000/dashboard` directly

**Expected Results**:
- Should redirect to `/auth/login?redirectTo=/dashboard`
- Terminal should show: `🔍 Middleware Auth Check: { ... hasSession: false, userId: "none" }`

---

### Test 4: Redirect After Login ✅

**Steps**:
1. Make sure you're logged out
2. Try to access `http://localhost:3000/monitoring`
3. Should redirect to `/auth/login?redirectTo=/monitoring`
4. Log in with valid credentials

**Expected Results**:
- After successful login, should redirect to `/monitoring` (not `/dashboard`)
- URL should be `http://localhost:3000/monitoring`

---

### Test 5: Invalid Credentials ✅

**Steps**:
1. Go to `/auth/login`
2. Enter invalid credentials (wrong password)
3. Click "Sign In"

**Expected Results**:

**Browser Console**:
```
❌ Login failed in form handler: { message: "Invalid login credentials" }
```

**Terminal**:
```
❌ Login error: { message: "Invalid login credentials", status: 400, email: "..." }
```

**Page Behavior**:
- Should show error message on the page
- Should NOT redirect
- Should stay on `/auth/login`

---

### Test 6: Middleware Cookie Reading ✅

**Steps**:
1. Log in successfully
2. Navigate to `/dashboard`
3. Check terminal output

**Expected Results**:

**Terminal**:
```
🔍 Middleware Auth Check: {
  pathname: "/dashboard",
  method: "GET",
  hasSession: true,
  userId: "...",
  email: "user@example.com",
  cookies: "sb-localhost-auth-token, sb-localhost-auth-token-code-verifier, ..."
}
```

**What to look for**:
- `hasSession: true` ✅
- `userId` is not "none" ✅
- `email` shows the user's email ✅
- `cookies` shows Supabase auth cookies ✅

---

## Common Issues and Solutions

### Issue 1: "hasSession: false" after successful login

**Possible Causes**:
- Cookies not being set correctly
- Supabase client configuration issue
- Cookie domain/path mismatch

**Debug Steps**:
1. Check browser DevTools → Application → Cookies
2. Look for cookies starting with `sb-`
3. If no cookies, check server logs for errors during login
4. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct

**Fix**:
```typescript
// In src/app/auth/login/route.ts, add more logging:
console.log('Cookies being set:', cookieStore.getAll());
```

---

### Issue 2: CSRF Edge Runtime Error

**Error Message**:
```
A Node.js module is loaded ('crypto' at line 2) which is not supported in the Edge Runtime
```

**Solution**: Already fixed in `src/lib/csrfProtection.ts` using Web Crypto API

**Verify Fix**:
```bash
grep -n "import.*crypto" src/lib/csrfProtection.ts
# Should show NO results (no imports from 'crypto')
```

---

### Issue 3: Build Manifest Errors

**Error Message**:
```
ENOENT: no such file or directory, open '.next/dev/server/pages/_app/build-manifest.json'
```

**Solution**:
```bash
rm -rf .next
npm run dev
```

---

### Issue 4: Session Not Persisting

**Symptoms**:
- Login works but user is logged out after refresh
- Middleware shows `hasSession: false` after login

**Debug Steps**:
1. Check if cookies persist after page refresh
2. Look at cookie expiration time
3. Check cookie attributes (httpOnly, secure, sameSite)

**Verify**:
```typescript
// In browser console after login:
document.cookie
// Should show Supabase cookies
```

---

## Success Criteria

All these should be TRUE:

- [ ] Login form submits successfully
- [ ] Server returns 200 OK
- [ ] Cookies are set in browser
- [ ] User is redirected to dashboard
- [ ] Session persists after page refresh
- [ ] Protected routes redirect to login when not authenticated
- [ ] Middleware shows `hasSession: true` after login
- [ ] No CSRF Edge Runtime errors
- [ ] No build manifest errors
- [ ] Invalid credentials show error message

---

## Advanced Debugging

### Enable Verbose Logging

**In `src/app/auth/login/route.ts`**:
```typescript
// Add after creating supabase client:
console.log('🔧 Supabase client created');
console.log('🔧 Cookie store:', cookieStore.getAll().map(c => c.name));

// Add before return:
console.log('🔧 Final response cookies:', response.cookies.getAll());
```

**In `src/middleware.ts`**:
```typescript
// Add before session check:
console.log('🔧 All request cookies:', req.cookies.getAll());
console.log('🔧 Cookie header:', req.headers.get('cookie'));
```

### Check Supabase Auth Logs

1. Go to your Supabase dashboard
2. Navigate to Authentication → Logs
3. Look for recent login attempts
4. Verify the authentication is reaching Supabase

### Network Inspection

**In Browser DevTools → Network Tab**:
1. Filter by "login"
2. Click on the `/auth/login` request
3. Check **Headers** tab:
   - Request Method: `POST`
   - Status Code: `200 OK`
4. Check **Payload** tab:
   - Should show `{ email: "...", password: "..." }`
5. Check **Response** tab:
   - Should show `{ success: true, user: {...}, redirectTo: "..." }`
6. Check **Cookies** tab:
   - Should show cookies being set

---

## Next Steps After Successful Testing

Once all tests pass:

1. **Remove verbose logging** (if added for debugging)
2. **Test in production** with environment variables
3. **Enable CSRF protection** (if needed) by updating API routes
4. **Review security settings**:
   - Cookie settings (httpOnly, secure, sameSite)
   - Session timeout
   - Password requirements
5. **Monitor Sentry** for any auth-related errors

---

## Contact Points for Issues

If you encounter issues not covered here:

1. Check the terminal logs first
2. Check browser console for client-side errors
3. Review `/AUTH_FIXES_SUMMARY.md` for implementation details
4. Check Supabase documentation for auth helpers:
   - https://supabase.com/docs/guides/auth/auth-helpers/nextjs
