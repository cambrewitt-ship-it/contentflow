# 🛡️ SECURITY QUICK REFERENCE GUIDE

**For Developers:** Keep this handy while coding  
**Last Updated:** ${new Date().toLocaleDateString()}

---

## 🚨 CRITICAL SECURITY RULES

### ❌ NEVER DO THIS:
```typescript
// ❌ No authentication check
export async function POST(request: NextRequest) {
  const data = await request.json();
  // Process data without auth
}

// ❌ Using innerHTML
element.innerHTML = userContent;

// ❌ Weak password validation
if (password.length > 5) { /* OK */ }

// ❌ No input validation
.eq('id', userId) // userId not validated

// ❌ Exposing secrets
const apiKey = 'sk_live_12345'; // Hardcoded

// ❌ Detailed error messages in production
return { error: error.stack };
```

### ✅ ALWAYS DO THIS:
```typescript
// ✅ Always authenticate
const authHeader = request.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ✅ Create elements safely
const element = document.createElement('div');
element.textContent = userContent;

// ✅ Strong password validation
if (password.length < 12 || !hasComplexity(password)) {
  return { error: 'Weak password' };
}

// ✅ Validate all inputs
if (!isValidUUID(userId)) {
  return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
}

// ✅ Use environment variables
const apiKey = process.env.STRIPE_SECRET_KEY!;

// ✅ Generic errors in production
const isDev = process.env.NODE_ENV === 'development';
return { 
  error: 'Server error',
  ...(isDev && { details: error.message })
};
```

---

## 🔐 AUTHENTICATION PATTERN

**Every Protected API Route Must:**

```typescript
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: NextRequest) {
  try {
    // 1. Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];
    
    // 3. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // 4. Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn('Invalid auth token', { error: authError?.message });
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // 5. Now process authenticated request
    const body = await request.json();
    
    // ... your logic here with user.id
    
  } catch (error) {
    logger.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🔍 INPUT VALIDATION PATTERNS

### UUID Validation
```typescript
import { isValidUUID, sanitizeUUID } from '@/lib/validators';

// Method 1: Validate and reject
if (!isValidUUID(clientId)) {
  return NextResponse.json(
    { error: 'Invalid ID format' },
    { status: 400 }
  );
}

// Method 2: Sanitize (returns null if invalid)
const cleanId = sanitizeUUID(clientId);
if (!cleanId) {
  return NextResponse.json(
    { error: 'Invalid ID' },
    { status: 400 }
  );
}
```

### File Validation
```typescript
// MIME type validation
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'application/pdf'
];

if (!ALLOWED_TYPES.includes(fileType)) {
  return NextResponse.json(
    { error: 'Invalid file type' },
    { status: 400 }
  );
}

// File size validation
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
if (fileSize > MAX_SIZE) {
  return NextResponse.json(
    { error: 'File too large' },
    { status: 413 }
  );
}

// Filename sanitization
const safeName = filename
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .slice(0, 255);
```

### Email Validation
```typescript
import { isValidEmail } from '@/lib/validators';

if (!isValidEmail(email)) {
  return NextResponse.json(
    { error: 'Invalid email format' },
    { status: 400 }
  );
}
```

---

## 🚦 RATE LIMITING

### How to Add Rate Limiting

**Already configured in middleware, but to add custom:**

```typescript
import { checkSimpleRateLimit, createRateLimitResponse } from '@/lib/simpleRateLimit';

export async function POST(request: NextRequest) {
  // Check rate limit first
  const rateLimitCheck = checkSimpleRateLimit(
    request,
    'api', // tier: 'ai' | 'authenticated' | 'public' | 'portal' | 'auth'
    getUserIdentifier(request)
  );

  if (!rateLimitCheck.success) {
    return createRateLimitResponse(
      rateLimitCheck.limit,
      rateLimitCheck.remaining,
      rateLimitCheck.reset
    );
  }

  // Continue with request...
}
```

### Rate Limit Tiers

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| `ai` | 20 requests | 1 hour | AI endpoints |
| `authenticated` | 100 requests | 15 min | User API calls |
| `public` | 10 requests | 15 min | Public endpoints |
| `portal` | 20 requests | 1 hour | Portal access |
| `auth` | 20 requests | 15 min | Login/signup |
| `portalAuth` | 5 requests | 1 hour | Token validation |

---

## 🔒 PASSWORD REQUIREMENTS

### Validation Function
```typescript
function validatePassword(password: string): { valid: boolean; error?: string } {
  // Minimum 12 characters
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters' };
  }

  // Complexity check
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const complexity = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (complexity < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters'
    };
  }

  // Block common patterns
  const blocked = ['password', '12345', 'qwerty', 'abc123'];
  if (blocked.some(pattern => password.toLowerCase().includes(pattern))) {
    return { valid: false, error: 'Password contains common patterns' };
  }

  return { valid: true };
}
```

---

## 🛡️ XSS PREVENTION

### Safe DOM Manipulation

**❌ NEVER:**
```typescript
element.innerHTML = userInput;
element.outerHTML = userInput;
```

**✅ ALWAYS:**
```typescript
// Method 1: textContent
element.textContent = userInput;

// Method 2: createElement
const div = document.createElement('div');
div.textContent = userInput;
parent.appendChild(div);

// Method 3: React (best)
<div>{userInput}</div>
```

### Safe React Patterns

**❌ Dangerous:**
```typescript
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**✅ Safe:**
```typescript
// For text
<div>{userContent}</div>

// For images with error handling
<SafeImage
  src={imageUrl}
  alt={altText}
  onError={(e) => e.target.src = '/placeholder.png'}
/>
```

---

## 🔐 ENVIRONMENT VARIABLES

### Required Validation

**At application startup:**
```typescript
// src/lib/stripe.ts or similar
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error('STRIPE_SECRET_KEY not set');
}

if (!stripeKey.startsWith('sk_')) {
  throw new Error('Invalid STRIPE_SECRET_KEY format');
}

if (process.env.NODE_ENV === 'production' && stripeKey.startsWith('sk_test_')) {
  throw new Error('Cannot use test key in production');
}
```

### Environment Checklist

**Production:**
- [ ] `NODE_ENV=production`
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`
- [ ] `ALLOWED_ORIGINS` set to production domains
- [ ] All `NEXT_PUBLIC_*` variables set
- [ ] Webhook secrets configured

**Development:**
- [ ] `NODE_ENV=development`
- [ ] `STRIPE_SECRET_KEY` starts with `sk_test_`
- [ ] Local `.env.local` file exists
- [ ] Not using production secrets

---

## 🚨 ERROR HANDLING

### Safe Error Responses

```typescript
import logger from '@/lib/logger';

try {
  // Your code
} catch (error) {
  // Log detailed error
  logger.error('Operation failed:', {
    error: error instanceof Error ? error.message : 'Unknown',
    stack: error instanceof Error ? error.stack : undefined,
    userId: user?.id,
    operation: 'operation_name'
  });

  // Return generic error to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return NextResponse.json(
    {
      error: 'Operation failed',
      ...(isDevelopment && { 
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    },
    { status: 500 }
  );
}
```

### Error Response Codes

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Bad Request | Invalid input format |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Valid auth but no permission |
| 404 | Not Found | Resource doesn't exist |
| 413 | Payload Too Large | File size exceeded |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error (generic) |

---

## 🔍 SQL INJECTION PREVENTION

### Supabase Safe Patterns

**✅ Safe (parameterized):**
```typescript
// Supabase automatically handles parameterization
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('id', clientId)  // Safe if clientId is validated
  .single();
```

**⚠️ Validate First:**
```typescript
// Always validate IDs before using
if (!isValidUUID(clientId)) {
  throw new Error('Invalid ID');
}

const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('id', clientId)  // Now safe
  .single();
```

**❌ Never build raw SQL:**
```typescript
// ❌ NEVER DO THIS
const query = `SELECT * FROM clients WHERE id = '${clientId}'`;
```

---

## 📝 LOGGING BEST PRACTICES

### Using the Logger

```typescript
import logger from '@/lib/logger';

// ✅ Development-only debug logs
logger.debug('Detailed debug info', { data });

// ✅ General information
logger.info('User logged in', { userId: user.id });

// ✅ Warnings (production)
logger.warn('Rate limit approaching', { userId, remaining: 5 });

// ✅ Errors (production)
logger.error('Database query failed', { 
  error: error.message,
  userId,
  operation: 'fetch_clients'
});
```

### Auto-Redacted Keys

The logger automatically redacts:
- `token`
- `password`
- `apiKey`, `api_key`
- `secret`
- `authorization`
- `accessToken`, `access_token`
- `sessionToken`, `session_token`
- All Stripe-related secrets

**Result:**
```typescript
logger.debug('User data', {
  userId: '123',
  token: 'abc123',  // ← Becomes '[REDACTED]'
  email: 'user@example.com'
});
// Output: { userId: '123', token: '[REDACTED]', email: 'user@example.com' }
```

---

## 🔧 SECURITY HEADERS

### API Response Headers

```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

return NextResponse.json(
  { data },
  { 
    status: 200,
    headers: securityHeaders
  }
);
```

### Already Configured (next.config.ts)

- ✅ Content-Security-Policy
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer-Policy
- ✅ Permissions-Policy

---

## 🚀 COMMON PATTERNS CHEAT SHEET

### Protected API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validators';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 401 });
    }

    // 2. Validate input
    const body = await request.json();
    const { clientId, ...otherData } = body;

    if (!isValidUUID(clientId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // 3. Check authorization (if needed)
    const { data: client } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (client?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Process request
    const result = await performOperation(clientId, otherData);

    // 5. Return success
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    logger.error('Operation failed:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
```

### Portal Authentication Template

```typescript
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: client } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (!client || !client.portal_enabled) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Process portal request...
  }
}
```

---

## 📊 SECURITY TESTING COMMANDS

### Quick Security Checks

```bash
# 1. Dependency vulnerabilities
npm audit

# 2. Find potential secrets
grep -r "sk_live" src/
grep -r "password.*=" src/

# 3. Find console.log (should use logger)
grep -r "console\." src/

# 4. Find innerHTML usage
grep -r "innerHTML" src/

# 5. Check environment variables
node -e "console.log(Object.keys(process.env).filter(k => k.includes('STRIPE')))"

# 6. TypeScript check
npx tsc --noEmit

# 7. Build check
npm run build
```

### Manual Testing

```bash
# Test rate limiting
for i in {1..20}; do
  curl -X GET "http://localhost:3000/api/portal/validate?token=test"
done

# Test authentication (should fail)
curl -X POST http://localhost:3000/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{"imageData":"test","filename":"test.jpg"}'

# Test with large file (should fail)
# Create 11MB file
dd if=/dev/zero of=large.txt bs=1M count=11
# Try to upload (should reject)
```

---

## ✅ PRE-COMMIT CHECKLIST

Before every commit, verify:

- [ ] No `console.log` in committed code (use `logger`)
- [ ] No hardcoded secrets or API keys
- [ ] All user inputs validated
- [ ] Authentication checks in place
- [ ] No `innerHTML` usage
- [ ] Error messages don't expose internals
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] No new security vulnerabilities (`npm audit`)

---

## 🆘 EMERGENCY CONTACTS

**Security Issue Found?**

1. **Stop:** Don't deploy if critical
2. **Assess:** Check impact and affected users
3. **Fix:** Implement security patch
4. **Test:** Verify fix works
5. **Deploy:** Push to production ASAP
6. **Notify:** Inform affected users if needed
7. **Document:** Update security docs

**Get Help:**
- Security Lead: [Contact]
- DevOps: [Contact]
- Supabase Support: support@supabase.io
- Stripe Support: support@stripe.com

---

**Remember:** Security is not optional. When in doubt, ask for a security review before deploying!

**Keep Updated:** Review this guide weekly and update with new patterns as needed.

