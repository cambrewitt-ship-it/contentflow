# 🚀 LAUNCH SECURITY CHECKLIST

**Last Updated:** ${new Date().toLocaleDateString()}  
**Status:** ⚠️ NOT READY FOR LAUNCH  
**Required Actions:** 8 critical/high priority fixes

---

## ⏱️ QUICK TIMELINE

| Task | Priority | Time | Status |
|------|----------|------|--------|
| Fix upload-image auth | CRITICAL | 30 min | ❌ |
| Fix XSS vulnerability | CRITICAL | 30 min | ❌ |
| Update Next.js | CRITICAL | 15 min | ❌ |
| Portal rate limiting | HIGH | 1 hour | ❌ |
| File upload validation | HIGH | 1 hour | ❌ |
| Stripe env validation | HIGH | 30 min | ❌ |
| Strong passwords | HIGH | 1 hour | ❌ |
| UUID validation | HIGH | 30 min | ❌ |

**Total Estimated Time:** 5-6 hours  
**Target Completion:** Within 2 days

---

## 🔴 CRITICAL BLOCKERS (Must Fix Today)

### ✅ Checklist

- [ ] **1. Upload-Image Authentication**
  - Add auth check to `/src/app/api/upload-image/route.ts`
  - Validate user token before upload
  - Add file size and type validation
  - Test with authenticated and unauthenticated requests
  - **Files to modify:** `src/app/api/upload-image/route.ts`

- [ ] **2. XSS Vulnerability Fix**
  - Remove `innerHTML` usage in MonthViewCalendar
  - Create SafeImage component
  - Replace vulnerable code with React components
  - Test with malicious image URLs
  - **Files to modify:** `src/components/MonthViewCalendar.tsx`, create `src/components/SafeImage.tsx`

- [ ] **3. Next.js Security Update**
  - Run: `npm install next@15.5.4`
  - Test build: `npm run build`
  - Verify no breaking changes
  - Deploy to staging
  - **Command:** `npm install next@15.5.4`

---

## 🟠 HIGH PRIORITY (Must Fix Before Launch)

### ✅ Checklist

- [ ] **4. Portal Rate Limiting**
  - Update rate limits in `simpleRateLimit.ts`
  - Add `portalAuth` tier (5/hour)
  - Change portal tier to 20/hour
  - Test rate limit enforcement
  - **Files to modify:** `src/lib/simpleRateLimit.ts`

- [ ] **5. File Upload Validation**
  - Add MIME type validation
  - Add file extension check
  - Implement file size limits (50MB)
  - Prevent path traversal attacks
  - **Files to modify:** `src/app/api/portal/upload/route.ts`

- [ ] **6. Stripe Environment Validation**
  - Add startup validation for STRIPE_SECRET_KEY
  - Check for test keys in production
  - Validate webhook secret
  - Test with missing env vars
  - **Files to modify:** `src/lib/stripe.ts`

- [ ] **7. Strong Password Requirements**
  - Increase minimum length to 12 characters
  - Require complexity (3 of 4 types)
  - Block common patterns
  - Add password strength indicator
  - **Files to modify:** `src/app/auth/signup/page.tsx`

- [ ] **8. UUID Validation**
  - Create validation helper library
  - Add UUID format validation
  - Apply to all dynamic routes
  - Test with invalid IDs
  - **Files to create:** `src/lib/validators.ts`
  - **Files to modify:** All API routes with dynamic IDs

---

## 🟡 RECOMMENDED (Fix Before Launch)

### ✅ Checklist

- [ ] **9. HTTPS Enforcement**
  - Add HTTPS redirect in middleware
  - Test redirect logic
  - Verify in staging
  - **Files to modify:** `src/middleware.ts`

- [ ] **10. Error Message Sanitization**
  - Remove detailed errors in production
  - Keep verbose errors in development
  - Update all API error responses
  - **Files to modify:** All API routes

- [ ] **11. CORS Origin Restriction**
  - Add ALLOWED_ORIGINS env variable
  - Restrict to specific domains
  - Update next.config.ts
  - **Files to modify:** `next.config.ts`

- [ ] **12. External API Timeouts**
  - Add 10-second timeout to LATE API calls
  - Handle timeout errors gracefully
  - Test with slow networks
  - **Files to modify:** LATE integration files

---

## 🟢 NICE TO HAVE (Post-Launch)

### ✅ Checklist

- [ ] **13. Replace console.log**
  - Find all console.log usage
  - Replace with logger
  - Verify no sensitive data logged
  - **Command:** `grep -r "console\." src/`

- [ ] **14. API Security Headers**
  - Add X-Content-Type-Options
  - Add X-Frame-Options
  - Add to all API responses
  - **Files to modify:** API route templates

---

## 🔧 ENVIRONMENT SETUP

### Required Environment Variables

**Production (Vercel):**
```bash
# Authentication
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_SUPABASE_SERVICE_ROLE=your_supabase_service_role

# Payments
STRIPE_SECRET_KEY=sk_live_xxx  # ⚠️ Must start with sk_live_ in production
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_xxx

# AI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o

# Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Social Media
LATE_API_KEY=your_late_api_key

# Security (NEW - Add these)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production
```

**Staging:**
```bash
# Same as production but use test keys:
STRIPE_SECRET_KEY=sk_test_xxx  # ✅ Test key is OK for staging
NODE_ENV=staging
```

### ⚠️ Security Validation

Before launch, verify:
- [ ] All environment variables are set
- [ ] No test keys in production
- [ ] Webhook secrets configured
- [ ] ALLOWED_ORIGINS set correctly
- [ ] No secrets in git repository
- [ ] .env files are gitignored

**Check Command:**
```bash
# Verify environment variables
node -e "console.log(Object.keys(process.env).filter(k => k.includes('STRIPE') || k.includes('SUPABASE') || k.includes('OPENAI')))"
```

---

## 🧪 TESTING PROTOCOL

### Pre-Deployment Testing

**1. Local Development:**
```bash
# Install dependencies
npm install

# Run build
npm run build

# Run development server
npm run dev

# Run linting
npm run lint

# Check for vulnerabilities
npm audit
```

**2. Security Testing:**
```bash
# Test authentication
curl -X POST http://localhost:3000/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{"imageData":"test","filename":"test.jpg"}'
# Should return 401 Unauthorized

# Test with auth (replace TOKEN)
curl -X POST http://localhost:3000/api/upload-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"imageData":"data:image/jpeg;base64,/9j/4AAQ...","filename":"test.jpg"}'
# Should succeed
```

**3. Rate Limiting Test:**
```bash
# Install Apache Bench
brew install ab

# Test rate limiting (should see 429 after limit)
ab -n 100 -c 10 http://localhost:3000/api/portal/validate?token=test
```

**4. XSS Testing:**
- Try uploading image with script tag in filename
- Test with malicious URLs
- Verify no script execution

**5. Password Testing:**
```
Test Cases:
✅ "short" - Should fail (< 12 chars)
✅ "verylongpasswordwithnouppercase" - Should fail (no uppercase)
✅ "VERYLONGPASSWORDWITHNOLOWERCASE" - Should fail (no lowercase)
✅ "VeryLongPasswordWithNoNumbers" - Should fail (no numbers)
✅ "MySecureP@ssw0rd2024!" - Should succeed
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deploy
- [ ] All critical fixes implemented
- [ ] All high priority fixes implemented
- [ ] Code reviewed by second developer
- [ ] All tests passing locally
- [ ] npm audit shows 0 vulnerabilities
- [ ] Environment variables configured in Vercel
- [ ] Staging deployment successful
- [ ] Security testing completed

### Deploy to Staging
```bash
# Push to staging branch
git checkout -b staging
git merge main
git push origin staging

# Deploy to Vercel staging
vercel --prod=false

# Run tests on staging URL
```

### Staging Verification
- [ ] Authentication works
- [ ] File uploads require auth
- [ ] Rate limiting active
- [ ] Invalid files rejected
- [ ] Weak passwords rejected
- [ ] Portal tokens validated
- [ ] Stripe test payments work
- [ ] No console errors

### Deploy to Production
```bash
# Merge to main
git checkout main
git merge staging
git push origin main

# Deploy to production
vercel --prod

# Monitor deployment
vercel logs --follow
```

### Post-Deploy Verification
- [ ] Site loads correctly
- [ ] Authentication working
- [ ] Payment flow working
- [ ] File uploads secured
- [ ] Rate limiting active
- [ ] No critical errors in logs
- [ ] SSL certificate valid
- [ ] All environment variables working

---

## 📊 SECURITY SCORE TRACKER

### Current Score: 7.5/10

| Category | Current | Target | Status |
|----------|---------|--------|--------|
| Authentication | 9/10 | 9/10 | ✅ |
| Authorization | 8.5/10 | 9/10 | ⚠️ |
| Input Validation | 7/10 | 9/10 | ❌ |
| API Security | 7/10 | 9/10 | ❌ |
| Data Protection | 8/10 | 9/10 | ⚠️ |
| Error Handling | 6/10 | 8/10 | ❌ |
| Dependencies | 7/10 | 9/10 | ❌ |
| Frontend Security | 8/10 | 9/10 | ⚠️ |

**After Fixes:** Expected 9/10 ✅

---

## 🔍 MONITORING SETUP

### Post-Launch Monitoring

**1. Error Monitoring:**
- [ ] Sentry configured and working (already done ✅)
- [ ] Error alerts sent to team email
- [ ] Daily error summary enabled

**2. Security Monitoring:**
- [ ] Enable Vercel Security features
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure rate limit alerts
- [ ] Monitor failed auth attempts

**3. Performance Monitoring:**
- [ ] Vercel Analytics enabled
- [ ] Core Web Vitals tracked
- [ ] API response times monitored

**4. Security Alerts:**
- [ ] GitHub Dependabot enabled
- [ ] npm audit scheduled weekly
- [ ] Security update notifications

---

## 🚨 INCIDENT RESPONSE

### If Security Issue Found Post-Launch:

**1. Immediate Actions:**
```bash
# Rollback to previous version
vercel rollback

# Or disable affected functionality
# Update environment variable to disable feature
```

**2. Investigation:**
- Check Sentry for error details
- Review affected user accounts
- Analyze attack vectors
- Document findings

**3. Fix & Deploy:**
- Implement security fix
- Test thoroughly
- Deploy to staging first
- Then deploy to production

**4. Communication:**
- Notify affected users (if any)
- Update security documentation
- Post-mortem analysis

---

## 📋 FINAL APPROVAL

### Sign-Off Required

**Security Checklist:**
- [ ] All CRITICAL issues fixed
- [ ] All HIGH issues fixed
- [ ] Code reviewed
- [ ] Security tested
- [ ] Staging verified
- [ ] Environment variables set
- [ ] Monitoring enabled
- [ ] Incident response plan ready

**Approved By:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | _________ | _________ | _____ |
| Code Reviewer | _________ | _________ | _____ |
| Security Lead | _________ | _________ | _____ |
| Product Owner | _________ | _________ | _____ |

---

## ✅ LAUNCH DECISION

### Current Status: ⚠️ NOT READY

**Blocking Issues:** 8  
**Time to Ready:** 5-6 hours  
**Target Launch:** After all critical/high fixes

### Ready to Launch When:
- ✅ All CRITICAL issues resolved
- ✅ All HIGH priority issues resolved
- ✅ Security testing passed
- ✅ Staging verification complete
- ✅ Sign-offs received

---

## 📞 SUPPORT CONTACTS

**For Issues During Launch:**

- **Developer Lead:** [Your Name]
- **DevOps:** [Contact]
- **Security:** [Contact]
- **Emergency:** [24/7 Contact]

**External Support:**
- Vercel Support: support@vercel.com
- Supabase Support: support@supabase.io
- Stripe Support: support@stripe.com

---

**Note:** Do not proceed with launch until all checkboxes in CRITICAL and HIGH sections are complete. Your application's security and your users' data depend on these fixes.

**Last Updated:** ${new Date().toISOString()}

