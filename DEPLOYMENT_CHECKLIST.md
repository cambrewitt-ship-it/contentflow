# 🚀 DEPLOYMENT CHECKLIST - Security Fixes

## ✅ PRE-DEPLOYMENT VERIFICATION

### 1. Environment Variables
Ensure all required environment variables are set:

```bash
# Run this locally to test validation:
npm run dev

# Should see: "✅ All required environment variables are set"
# If any are missing, you'll get a clear error message
```

**Required Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_SUPABASE_SERVICE_ROLE`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `LATE_API_KEY`
- `CSRF_SECRET_KEY` ⚠️ **NEW - Generate this!**
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

### 2. Generate CSRF_SECRET_KEY

```bash
# Generate a secure 256-bit random key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local and Vercel environment variables:
# CSRF_SECRET_KEY=<generated_key>
```

### 3. Test CSRF Endpoint

```bash
# Start dev server:
npm run dev

# Test CSRF endpoint:
curl http://localhost:3000/api/csrf

# Expected response:
# {"csrfToken":"<base64_token>","success":true}
```

### 4. Verify Linting

```bash
npm run lint

# Should complete with no errors
```

### 5. Test Build

```bash
npm run build

# Should complete successfully
# Environment validation will run during build
```

---

## 🔧 VERCEL DEPLOYMENT STEPS

### Step 1: Add Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add the following **if not already present:**

```
CSRF_SECRET_KEY=<your_generated_key>
```

**Production, Preview, Development:** Check all three

### Step 2: Deploy

```bash
git add .
git commit -m "Security fixes: CSRF, PII scrubbing, env validation, auth middleware"
git push origin main
```

Vercel will automatically deploy.

### Step 3: Verify Deployment

After deployment completes:

1. **Check Environment Validation:**
   - View deployment logs in Vercel
   - Should see: "✅ All required environment variables are set"
   - If missing vars, deployment will fail with clear error

2. **Test CSRF Endpoint:**
   ```bash
   curl https://your-domain.com/api/csrf
   # Should return: {"csrfToken":"...","success":true}
   ```

3. **Check Sentry:**
   - Go to Sentry dashboard
   - Trigger a test error
   - Verify NO sensitive data appears (tokens, passwords, etc.)

4. **Test Stripe Webhooks:**
   - Make a test payment
   - Verify webhook is processed (not rate-limited)
   - Check: 1000 req/hour limit (previously 10 req/15min)

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Authentication
```bash
# Test authenticated endpoint:
curl -H "Authorization: Bearer <your_token>" \
  https://your-domain.com/api/clients

# Should return 401 if token is expired (new JWT expiration check)
```

### Test 2: GTM Validation
- View page source
- Verify GTM script tag is present (if GTM_ID is valid)
- Invalid GTM IDs should be rejected silently

### Test 3: Rate Limiting
```bash
# Test webhook endpoint (should have high limit):
curl -X POST https://your-domain.com/api/stripe/webhook

# Should allow 1000 requests per hour
```

### Test 4: Logger (No Console.log in Production)
- Open browser console on your deployed site
- Navigate through the app
- **Should NOT see console.log statements** in:
  - API routes
  - Approval pages
  - Portal pages
  - Calendar components

---

## 🔍 MONITORING

### Week 1 Post-Deployment

Monitor these metrics:

1. **Sentry Errors:**
   - Check for PII leakage (should be none)
   - Verify error context is still useful

2. **Stripe Webhooks:**
   - Monitor webhook success rate
   - Should NOT see rate limit errors

3. **Authentication:**
   - Monitor 401 errors
   - Check for token expiration issues

4. **Environment Validation:**
   - Check server startup logs
   - Verify no missing env var errors

---

## 🚨 ROLLBACK PLAN

If issues occur:

### Option 1: Quick Fix
```bash
# Revert specific changes:
git revert <commit_hash>
git push origin main
```

### Option 2: Full Rollback
```bash
# In Vercel Dashboard:
# Deployments → Previous Deployment → Promote to Production
```

### Common Issues & Fixes

**Issue:** "CSRF_SECRET_KEY missing"
- **Fix:** Add CSRF_SECRET_KEY to Vercel environment variables

**Issue:** "Environment validation failing"
- **Fix:** Check Vercel environment variables for typos or missing values

**Issue:** Sentry not receiving errors
- **Fix:** Verify `sendDefaultPii: false` is not blocking too much data

**Issue:** Stripe webhooks failing
- **Fix:** Verify webhook rate limit tier is set correctly

---

## 📋 VERIFICATION CHECKLIST

After deployment, verify each fix:

- [ ] ✅ **GTM Validation:** Invalid GTM IDs rejected
- [ ] ✅ **Webhook Rate Limits:** Stripe webhooks have 1000/hr limit
- [ ] ✅ **CSRF Endpoint:** `/api/csrf` returns valid token
- [ ] ✅ **JWT Expiration:** Expired tokens return 401
- [ ] ✅ **Console.log Removed:** No console statements in critical files
- [ ] ✅ **Sentry PII:** No sensitive data in Sentry errors
- [ ] ✅ **Env Validation:** App starts with all required vars
- [ ] ✅ **Auth Middleware:** Available for use in API routes

---

## 🎉 SUCCESS CRITERIA

Deployment is successful when:

1. ✅ All environment variables validated on startup
2. ✅ CSRF endpoint returns tokens
3. ✅ No PII visible in Sentry errors
4. ✅ Stripe webhooks processing correctly
5. ✅ No console.log statements in production logs
6. ✅ Expired JWT tokens rejected properly
7. ✅ GTM loads only with valid IDs
8. ✅ No linter errors
9. ✅ All tests passing

---

## 📞 SUPPORT

If you encounter issues:

1. Check deployment logs in Vercel
2. Review Sentry for error details
3. Test endpoints individually using curl
4. Verify environment variables are set correctly
5. Check this document's troubleshooting section

---

**Last Updated:** December 14, 2025  
**Next Review:** After first production deployment

