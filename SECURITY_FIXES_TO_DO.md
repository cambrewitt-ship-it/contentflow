# 🔧 Security Fixes - Action Checklist

## Quick Reference

**Estimated Time:** 4-6 hours  
**Priority:** CRITICAL - Block Launch  
**Status:** Ready to Start

---

## ✅ STEP-BY-STEP FIXES

### 1️⃣ DELETE EXPOSED TEST ENDPOINTS (30 minutes)

**Files to Delete:**
```bash
src/app/api/test-db/route.ts
src/app/api/projects/debug/route.ts
```

**Commands:**
```bash
rm src/app/api/test-db/route.ts
rm src/app/api/projects/debug/route.ts
```

**Also Fix:** `/src/app/api/projects/route.ts`
- Remove test endpoint at lines 191-197
- Remove health check at lines 199-206

**Verification:**
- Search for remaining test endpoints: `grep -r "test=true\|health=true" src/app/api/`
- Should return only this file

---

### 2️⃣ FIX CORS CONFIGURATION (30 minutes)

**Files to Edit:**
- `src/lib/cors.ts` (lines 4-8)
- `src/lib/corsMiddleware.ts` (lines 4-8)

**Current (BROKEN):**
```typescript
const ALLOWED_ORIGINS = {
  production: [
    'https://your-production-domain.com',  // ❌ PLACEHOLDER
    'https://www.your-production-domain.com',  // ❌ PLACEHOLDER
  ],
```

**Replace With:**
```typescript
const ALLOWED_ORIGINS = {
  production: [
    'https://contentflow-v2.vercel.app',  // ✅ Your actual Vercel domain
    'https://contentflow.app',  // ✅ Custom domain if applicable
    process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN || '',
  ].filter(Boolean),
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ],
};
```

**Apply to BOTH files:** cors.ts AND corsMiddleware.ts

**Verification:**
- Check deployment URL: `vercel list`
- Update both CORS files
- Test API call from production

---

### 3️⃣ ADD AUTHENTICATION TO POSTS-BY-ID ROUTE (45 minutes)

**File to Edit:** `src/app/api/posts-by-id/[postId]/route.ts`

**Location:** Lines 386-465 (GET function)

**Add This Code Block at the START of the GET function:**

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let postId: string | undefined;

  try {
    // ✅ ADD THIS ENTIRE BLOCK
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('Authentication error:', { 
        error: authError?.message || 'Invalid token',
        operation: 'get_post'
      });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    // ✅ END OF NEW CODE

    // Existing validation code...
    const validation = await validateApiRequest(request, {
      params: postIdParamSchema,
      paramsObject: params,
    });

    if (!validation.success) {
      return validation.response;
    }

    const { params: validatedParams } = validation.data;
    postId = validatedParams!.postId;

    // ✅ MODIFY THIS SECTION to verify ownership
    let { data: post, error } = await supabase
      .from('posts')
      .select('*, clients!inner(user_id)')  // ✅ Join with clients
      .eq('id', postId)
      .eq('user_id', user.id)  // ✅ Filter by authenticated user
      .single();

    // If not found in posts, check calendar tables (existing code)...
    
    // Rest of existing code...
  }
}
```

**After fetching post, add ownership verification:**

```typescript
// After getting post from any table, verify ownership
if (post && post.client_id) {
  const { data: client } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', post.client_id)
    .single();
  
  if (client && client.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
}
```

**Verification:**
- Test with no auth: Should return 401
- Test with valid auth: Should return post
- Test with other user's post ID: Should return 403

---

### 4️⃣ CREATE .env.example FILE (15 minutes)

**Create new file:** `.env.example`

**Content:**
```bash
# ============================================
# SUPABASE CONFIGURATION
# ============================================

# Public URL - Safe to expose
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Anon key - Safe to expose (protected by RLS)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ⚠️ SECRET - Server-side only, never expose!
NEXT_SUPABASE_SERVICE_ROLE=your-service-role-key-here

# ============================================
# STRIPE CONFIGURATION (Payments)
# ============================================

# Publishable key - Safe to expose
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# ⚠️ SECRET - Server-side only!
STRIPE_SECRET_KEY=sk_test_xxx

# ⚠️ SECRET - Webhook verification
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Price IDs for different plans
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_xxx

# ============================================
# LATE API (Social Media Scheduling)
# ============================================

# ⚠️ SECRET - Server-side only!
LATE_API_KEY=your-late-api-key-here

# ============================================
# APPLICATION CONFIGURATION
# ============================================

# Public app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Environment
NODE_ENV=development

# ============================================
# OPENAI (Optional - for AI features)
# ============================================

# ⚠️ SECRET - Server-side only!
OPENAI_API_KEY=sk-xxx

# ============================================
# SENTRY (Optional - Error Tracking)
# ============================================

SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx

# ============================================
# PRODUCTION ONLY (Uncomment when deploying)
# ============================================

# NEXT_PUBLIC_PRODUCTION_DOMAIN=https://contentflow-v2.vercel.app
```

**Make sure `.env.example` is NOT in .gitignore** (it should be committed)

**Verification:**
- Add to git: `git add .env.example`
- Commit: `git commit -m "Add environment variable documentation"`

---

### 5️⃣ AUDIT CONSOLE.LOG USAGE (2-3 hours)

**Find all console statements:**
```bash
grep -r "console\." src/app/api/ > console-log-report.txt
```

**Priority Files to Fix:**
1. All `/api/projects/` routes
2. All `/api/late/` routes  
3. `/api/clients/` routes
4. Any route exposing environment variables

**Replacement Pattern:**
```typescript
// ❌ BAD
console.log('Environment check', {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceRoleKey: !!supabaseServiceRoleKey
});

// ✅ GOOD
import logger from '@/lib/logger';

logger.debug('Environment check', {
  hasSupabaseUrl: true,  // Don't log actual values
});
```

**No Sensitive Data in Logs:**
- ❌ Don't log tokens, API keys, passwords
- ❌ Don't log full error objects with stack traces in production
- ✅ Log error codes and types only
- ✅ Use logger (already configured in your project)

**Batch Replace (if using same pattern):**
```bash
# Install ripgrep if needed: brew install ripgrep
rg "console.log" src/app/api/ -l | xargs sed -i '' "s/console\.log/logger.debug/g"
rg "console.error" src/app/api/ -l | xargs sed -i '' "s/console\.error/logger.error/g"
rg "console.warn" src/app/api/ -l | xargs sed -i '' "s/console\.warn/logger.warn/g"
```

---

### 6️⃣ REMOVE TEST ENDPOINTS FROM PROJECTS ROUTE (20 minutes)

**File:** `src/app/api/projects/route.ts`

**Remove these endpoints (lines 191-207):**

```typescript
// DELETE THESE LINES:
  // Simple fallback response to test if route is working
  if (req.url.includes('test=true')) {
    return NextResponse.json({
      success: true,
      message: 'Projects API route is working (test mode)',
      timestamp: new Date().toISOString()
    });
  }

  // Very simple health check - always return something
  if (req.url.includes('health=true')) {
    return NextResponse.json({
      status: 'healthy',
      route: 'projects',
      timestamp: new Date().toISOString(),
      message: 'Projects API route is responding'
    });
  }
```

**Replace with:**
Just delete those lines entirely and continue with the existing auth logic.

---

### 7️⃣ TEST EVERYTHING (1 hour)

**Create test script:** `test-security.sh`

```bash
#!/bin/bash

echo "🔍 Testing Security Fixes..."

# Test 1: Verify test endpoints are removed
echo "✓ Checking test endpoints..."
if curl -s http://localhost:3000/api/test-db | grep -q "success"; then
  echo "❌ FAIL: test-db endpoint still accessible"
  exit 1
else
  echo "✓ test-db endpoint removed"
fi

# Test 2: Verify posts-by-id requires auth
echo "✓ Testing posts-by-id authentication..."
response=$(curl -s -w "%{http_code}" http://localhost:3000/api/posts-by-id/test-id)
if [ "$response" != "401" ]; then
  echo "❌ FAIL: posts-by-id should require auth (got $response)"
  exit 1
else
  echo "✓ Authentication required on posts-by-id"
fi

# Test 3: Check for exposed console.log in production build
echo "✓ Checking for console.log in build..."
npm run build > /dev/null 2>&1
if grep -r "console\." .next/static 2>/dev/null; then
  echo "⚠️  WARNING: console.log found in production build"
else
  echo "✓ No console.log in production build"
fi

echo "✅ All security tests passed!"
```

**Run tests:**
```bash
chmod +x test-security.sh
./test-security.sh
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All 4 critical fixes applied
- [ ] `.env.example` created
- [ ] CORS domains updated in BOTH files
- [ ] Test endpoints deleted
- [ ] Authentication added to posts-by-id
- [ ] No console.log in production code
- [ ] Build succeeds: `npm run build`
- [ ] All environment variables set in Vercel
- [ ] Staging deployment tested
- [ ] Production deployment verified

---

## 📊 VERIFICATION COMMANDS

```bash
# 1. Check for test endpoints
find src/app/api -name "test-*" -o -name "debug"

# 2. Search for console.log
grep -r "console\." src/app/api/ | wc -l
# Should be reduced significantly

# 3. Check CORS configuration
grep -A 5 "production:" src/lib/cors.ts
grep -A 5 "production:" src/lib/corsMiddleware.ts
# Should show actual domains, not placeholders

# 4. Verify authentication on posts-by-id
grep -A 5 "authHeader = request.headers.get" src/app/api/posts-by-id/\[postId\]/route.ts
# Should show auth check at start of GET function

# 5. Build test
npm run build
# Should succeed without warnings

# 6. Check for sensitive data
grep -r "API_KEY\|SECRET_KEY\|SERVICE_ROLE" src/app/api/ | grep -v ".example"
# Should show only .env.example references
```

---

## ✅ SIGN-OFF

Once all tasks are complete:

- [ ] Critical fixes implemented
- [ ] All tests passing
- [ ] Build succeeds
- [ ] Staging tested
- [ ] Production verified
- [ ] Ready for launch! 🚀

---

**Estimated Time:** 4-6 hours  
**Priority:** CRITICAL  
**Status:** Ready to Start

Good luck! You're almost there. 🎉

