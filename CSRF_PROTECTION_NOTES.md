# CSRF Protection Implementation Notes

## Current Status: ⚠️ CSRF Protection Disabled in Middleware

### Why Disabled?

CSRF protection was **temporarily disabled in middleware** due to two critical issues:

1. **Edge Runtime Incompatibility**
   - Middleware runs in Vercel Edge Runtime
   - `csrfProtection.ts` uses Node.js `crypto` module (`createHmac`, `randomBytes`)
   - Node.js modules are **not supported** in Edge Runtime
   - Error: `A Node.js module is loaded ('crypto' at line 2) which is not supported in the Edge Runtime`

2. **Authentication Flow Blocking**
   - CSRF middleware was blocking authentication requests
   - Caused redirect loop: `/auth/login?redirectTo=%2Fdashboard`
   - User unable to sign in or access dashboard

### What's Working

✅ **CSRF Token Generation Endpoint** - `/api/csrf/route.ts` works (API routes use Node runtime)
✅ **CSRF Protection Library** - `src/lib/csrfProtection.ts` functions work in API routes
✅ **Rate Limiting** - Still active in middleware

### Solutions (Choose One)

#### Option 1: CSRF Protection at API Route Level (Recommended)
Apply CSRF protection individually in API routes that need it:

```typescript
// In each API route that needs CSRF protection
import { validateCSRFToken } from '@/lib/csrfProtection';

export async function POST(req: NextRequest) {
  // Validate CSRF token
  const validation = await validateCSRFToken(req);
  if (!validation.isValid) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }
  
  // Continue with request...
}
```

**Pros:**
- Works immediately with existing code
- Fine-grained control over which routes need CSRF
- No Edge Runtime issues

**Cons:**
- Must add to each route manually
- Less centralized

#### Option 2: Convert to Web Crypto API (Future Enhancement)
Rewrite `csrfProtection.ts` to use Web Crypto API (Edge Runtime compatible):

```typescript
// Instead of Node.js crypto:
import { createHmac, randomBytes } from 'crypto';

// Use Web Crypto API:
const crypto = globalThis.crypto;

// Generate random bytes:
const randomBytes = crypto.getRandomValues(new Uint8Array(32));

// Create HMAC:
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(SECRET_KEY),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);
const signature = await crypto.subtle.sign('HMAC', key, data);
```

**Pros:**
- Can be used in middleware
- Centralized protection
- Edge Runtime compatible

**Cons:**
- Requires rewriting CSRF library (~2-3 hours)
- More complex API
- Testing needed

#### Option 3: Use Alternative CSRF Strategy
Implement CSRF using double-submit cookie pattern without cryptography:

1. Generate random token (UUID) - no crypto needed
2. Set as httpOnly cookie
3. Require same token in request header
4. Compare in middleware/routes

**Pros:**
- Simpler implementation
- Edge Runtime compatible
- No crypto dependencies

**Cons:**
- Slightly less secure than HMAC-signed tokens
- Still need to implement

### Recommended Next Steps

**Immediate (Production Ready):**
1. ✅ Keep CSRF disabled in middleware
2. ✅ Use API route-level protection for critical endpoints
3. ✅ Document which routes need CSRF protection

**Future Enhancement (When Time Allows):**
1. Rewrite `csrfProtection.ts` using Web Crypto API
2. Re-enable in middleware
3. Test thoroughly

### API Routes That Should Have CSRF Protection

When implementing route-level CSRF, prioritize these:

**High Priority:**
- `/api/clients/*` - Client management
- `/api/posts/*` - Post management
- `/api/projects/*` - Project management
- `/api/user/delete-account` - Account deletion

**Medium Priority:**
- `/api/ai` - AI generation
- `/api/upload-*` - File uploads

**Low Priority / Skip:**
- `/api/auth/*` - Auth endpoints (already have protection)
- `/api/stripe/webhook` - Webhooks (signature verified)
- `/api/portal/*` - Token-based auth

### Current Implementation

```typescript
// middleware.ts (CSRF disabled)
export async function middleware(req: NextRequest) {
  // Rate limiting still active
  const rateLimitResponse = await simpleRateLimitMiddleware(req);
  if (rateLimitResponse) return rateLimitResponse;

  // CSRF protection commented out
  // const csrfResponse = await enhancedCSRFProtection(req);
  // if (csrfResponse) return csrfResponse;

  // Auth checks continue as normal
  // ...
}
```

---

## Testing Checklist

After re-enabling CSRF (if using Web Crypto API):

- [ ] User can sign in successfully
- [ ] User can access dashboard after login
- [ ] No Edge Runtime errors in console
- [ ] CSRF endpoint `/api/csrf` returns tokens
- [ ] Protected API routes validate CSRF tokens
- [ ] Public routes (auth, webhooks) bypass CSRF
- [ ] Rate limiting still works

---

**Last Updated:** December 14, 2025  
**Status:** CSRF protection disabled in middleware, enabled for API route endpoint only


