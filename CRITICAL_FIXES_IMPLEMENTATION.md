# 🚨 CRITICAL SECURITY FIXES - IMPLEMENTATION GUIDE

**Priority:** MUST FIX BEFORE LAUNCH  
**Estimated Time:** 4-6 hours total  
**Developer:** Assign to senior developer

---

## 📋 QUICK START CHECKLIST

- [ ] **FIX #1:** Add authentication to upload-image route (30 mins)
- [ ] **FIX #2:** Remove XSS vulnerability in MonthViewCalendar (30 mins)  
- [ ] **FIX #3:** Update Next.js to patched version (15 mins)
- [ ] **FIX #4:** Implement strict portal rate limiting (1 hour)
- [ ] **FIX #5:** Add file validation to portal uploads (1 hour)
- [ ] **FIX #6:** Validate Stripe environment variables (30 mins)
- [ ] **FIX #7:** Strengthen password requirements (1 hour)
- [ ] **FIX #8:** Add UUID validation helper (30 mins)

---

## 🔧 IMPLEMENTATION STEPS

### FIX #1: Upload-Image Authentication (CRITICAL)

**File:** `/src/app/api/upload-image/route.ts`

**Current Code (VULNERABLE):**
```typescript
export async function POST(request: NextRequest) {
  try {
    const { imageData, filename } = await request.json();
    // No authentication check!
```

**Replace with:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import { base64ToBlob } from '../../../lib/blobUpload';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: NextRequest) {
  try {
    // ✅ CRITICAL FIX: Add authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Upload attempt without authentication');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn('Invalid authentication token for upload', { error: authError?.message });
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const { imageData, filename } = await request.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL FIX: Validate file size
    const base64Length = imageData.length;
    const sizeInBytes = (base64Length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (sizeInBytes > maxSize) {
      logger.warn('Upload rejected: file too large', { 
        size: sizeInBytes, 
        maxSize, 
        userId: user.id 
      });
      return NextResponse.json(
        { error: 'File too large. Maximum 10MB allowed.' },
        { status: 413 }
      );
    }

    // ✅ CRITICAL FIX: Validate file type
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(mimeType)) {
      logger.warn('Upload rejected: invalid file type', { 
        mimeType, 
        userId: user.id 
      });
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images allowed.' },
        { status: 400 }
      );
    }
    
    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.error('BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      );
    }

    // Convert base64 to blob
    const blob = base64ToBlob(imageData, mimeType);

    // Upload to Vercel Blob with user ID in path for tracking
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filepath = `uploads/${user.id}/${Date.now()}-${sanitizedFilename}`;
    
    const result = await put(filepath, blob, {
      access: 'public',
    });

    logger.info('Image uploaded successfully', { 
      userId: user.id, 
      filepath, 
      size: sizeInBytes 
    });

    return NextResponse.json({ 
      success: true, 
      url: result.url,
      filename: result.pathname
    });
    
  } catch (error) {
    logger.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
```

---

### FIX #2: Remove XSS Vulnerability (CRITICAL)

**File:** `/src/components/MonthViewCalendar.tsx`

**Lines to Replace:** 476-483 and 513-519

**Current Code (VULNERABLE):**
```typescript
parent.innerHTML = `
  <div class="w-full h-full bg-gray-200 flex items-center justify-center">
    <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
    </svg>
  </div>
`;
```

**Replace with Safe React Component:**
```typescript
// Add this helper component at the top of the file
const ImagePlaceholder = ({ bgColor = 'bg-gray-200', iconColor = 'text-gray-400' }: { bgColor?: string, iconColor?: string }) => (
  <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
    <svg className={`w-3 h-3 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
    </svg>
  </div>
);

// Then replace the vulnerable code with:
// Around line 476:
<img
  src={post.image_url}
  alt={post.caption?.slice(0, 50) || 'Post image'}
  className="w-full h-full object-cover"
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  }}
/>
{/* Show placeholder if image fails */}
<ImagePlaceholder />

// Around line 513:
<img
  src={upload.file_url}
  alt={upload.file_name}
  className="w-full h-full object-cover"
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  }}
/>
{/* Show placeholder if image fails */}
<ImagePlaceholder bgColor="bg-blue-100" iconColor="text-blue-500" />
```

**Better Solution - Completely Rewrite Image Handling:**
```typescript
// Create a separate component file: /src/components/SafeImage.tsx
'use client';

import { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderBgColor?: string;
  placeholderIconColor?: string;
}

export const SafeImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholderBgColor = 'bg-gray-200',
  placeholderIconColor = 'text-gray-400'
}: SafeImageProps) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className={`${className} ${placeholderBgColor} flex items-center justify-center`}>
        <svg className={`w-3 h-3 ${placeholderIconColor}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImageError(true)}
    />
  );
};

// Then in MonthViewCalendar.tsx, import and use:
import { SafeImage } from './SafeImage';

// Replace the vulnerable image code with:
<SafeImage
  src={post.image_url}
  alt={post.caption?.slice(0, 50) || 'Post image'}
  className="w-full h-full object-cover"
/>

<SafeImage
  src={upload.file_url}
  alt={upload.file_name}
  className="w-full h-full object-cover"
  placeholderBgColor="bg-blue-100"
  placeholderIconColor="text-blue-500"
/>
```

---

### FIX #3: Update Next.js (CRITICAL)

**File:** `package.json`

```bash
# Run this command:
npm install next@15.5.4

# Or if using exact versions:
npm install --save-exact next@15.5.4

# Then rebuild:
npm run build

# Test locally:
npm run dev
```

**Verify the update:**
```bash
# Check package.json shows:
"next": "15.5.4"

# Run audit again:
npm audit
# Should show 0 vulnerabilities
```

---

### FIX #4: Strict Portal Rate Limiting (HIGH)

**File:** `/src/lib/simpleRateLimit.ts`

**Update the rate limits:**
```typescript
// Update these lines (around line 13-19):
const rateLimits = {
  ai: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  authenticated: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 per 15 min
  public: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
  portal: { requests: 20, windowMs: 60 * 60 * 1000 }, // ✅ CHANGED: 20 per hour (was 50 per 15min)
  auth: { requests: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 min
  portalAuth: { requests: 5, windowMs: 60 * 60 * 1000 }, // ✅ NEW: 5 per hour for token validation
};
```

**Add to route patterns:**
```typescript
// Update routePatterns (around line 24):
const routePatterns: Record<string, RateLimitTier> = {
  '/api/ai': 'ai',
  '/api/analyze-website-temp': 'ai',
  '/api/auth': 'auth',
  '/auth/login': 'auth',
  '/auth/signup': 'auth',
  '/auth/callback': 'auth',
  '/api/portal/validate': 'portalAuth', // ✅ NEW: Stricter limit for token validation
  '/api/portal': 'portal',
  '/portal': 'portal',
  '/api/clients': 'authenticated',
  '/api': 'public',
};
```

---

### FIX #5: Portal Upload Validation (HIGH)

**File:** `/src/app/api/portal/upload/route.ts`

**Add this at the top of the file:**
```typescript
// ✅ File validation constants
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.pdf',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function validateFile(fileName: string, fileType: string, fileSize: number): { valid: boolean; error?: string } {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `Invalid file type: ${fileType}. Allowed types: images, videos, PDFs only.`
    };
  }

  // Validate extension
  const fileExtension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Validate size
  if (fileSize > MAX_FILE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File too large: ${sizeMB}MB. Maximum allowed: ${maxMB}MB`
    };
  }

  // Validate filename (prevent path traversal)
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename: path characters not allowed'
    };
  }

  return { valid: true };
}
```

**Update the POST handler (around line 85):**
```typescript
export async function POST(request: NextRequest) {
  try {
    const { token, fileName, fileType, fileSize, fileUrl, notes, targetDate } = await request.json();

    if (!token || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL: Validate file before processing
    const validation = validateFile(fileName, fileType || 'unknown', fileSize || 0);
    if (!validation.valid) {
      logger.warn('Portal upload rejected:', { error: validation.error, fileName, fileType });
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // ... rest of the existing code
  }
}
```

---

### FIX #6: Stripe Environment Validation (HIGH)

**File:** `/src/lib/stripe.ts`

**Replace the initialization code (lines 1-7):**
```typescript
import Stripe from 'stripe';

// ✅ Validate Stripe configuration on startup
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error(
    'CRITICAL: STRIPE_SECRET_KEY environment variable is not set. ' +
    'Add it to your .env.local file or Vercel environment variables.'
  );
}

if (!stripeSecretKey.startsWith('sk_')) {
  throw new Error(
    'CRITICAL: STRIPE_SECRET_KEY has invalid format. ' +
    'It should start with "sk_test_" or "sk_live_"'
  );
}

// ✅ Prevent using test keys in production
if (process.env.NODE_ENV === 'production') {
  if (stripeSecretKey.startsWith('sk_test_')) {
    throw new Error(
      'CRITICAL: Cannot use Stripe test key (sk_test_) in production. ' +
      'Update STRIPE_SECRET_KEY to use your live key (sk_live_)'
    );
  }
  
  if (!stripeWebhookSecret) {
    throw new Error(
      'CRITICAL: STRIPE_WEBHOOK_SECRET is required in production'
    );
  }
}

// ✅ Warn about missing webhook secret in development
if (process.env.NODE_ENV === 'development' && !stripeWebhookSecret) {
  console.warn(
    '⚠️  WARNING: STRIPE_WEBHOOK_SECRET is not set. ' +
    'Webhook signature verification will fail.'
  );
}

// Initialize Stripe with the validated secret key
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
});

// ... rest of the file
```

---

### FIX #7: Strong Password Requirements (HIGH)

**File:** `/src/app/auth/signup/page.tsx`

**Add this function before the SignupForm component:**
```typescript
// ✅ Strong password validation
interface PasswordValidation {
  valid: boolean;
  error?: string;
  strength?: 'weak' | 'medium' | 'strong';
}

function validatePassword(password: string): PasswordValidation {
  // Minimum length
  if (password.length < 12) {
    return { 
      valid: false, 
      error: 'Password must be at least 12 characters long',
      strength: 'weak'
    };
  }

  // Check complexity
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

  if (complexityCount < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
      strength: 'weak'
    };
  }

  // Check for common patterns
  const commonPatterns = [
    /password/i,
    /12345/,
    /qwerty/i,
    /abc123/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      return {
        valid: false,
        error: 'Password contains common patterns. Please choose a more unique password.',
        strength: 'weak'
      };
  }
  }

  // Determine strength
  const strength = password.length >= 16 && complexityCount === 4 ? 'strong' : 'medium';

  return { valid: true, strength };
}
```

**Update the handleSubmit function (around line 36):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setMessage('');

  // ✅ Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    setError(passwordValidation.error!);
    setLoading(false);
    return;
  }

  if (password !== confirmPassword) {
    setError('Passwords do not match');
    setLoading(false);
    return;
  }

  if (!acceptedTerms) {
    setError('You must accept the Terms and Conditions to sign up');
    setLoading(false);
    return;
  }

  // ... rest of signup logic
};
```

**Optional: Add password strength indicator:**
```typescript
// Add this state:
const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

// Update password onChange:
onChange={(e) => {
  setPassword(e.target.value);
  const validation = validatePassword(e.target.value);
  setPasswordStrength(validation.strength || 'weak');
}}

// Add strength indicator in UI (after password input):
{password && (
  <div className="mt-2">
    <div className="flex items-center gap-2">
      <div className={`h-2 flex-1 rounded ${
        passwordStrength === 'weak' ? 'bg-red-500' :
        passwordStrength === 'medium' ? 'bg-yellow-500' :
        'bg-green-500'
      }`} />
      <span className="text-xs text-muted-foreground capitalize">
        {passwordStrength} password
      </span>
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      Use 12+ characters with uppercase, lowercase, numbers, and symbols
    </p>
  </div>
)}
```

---

### FIX #8: UUID Validation Helper (HIGH)

**File:** Create `/src/lib/validators.ts`

```typescript
/**
 * Security validation utilities
 */

/**
 * Validates UUID format (v4)
 * Prevents SQL injection and invalid ID attacks
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates and sanitizes UUID
 * Returns null if invalid
 */
export function sanitizeUUID(uuid: string | null | undefined): string | null {
  if (!uuid) return null;
  
  // Remove any whitespace
  const cleaned = uuid.trim();
  
  // Validate
  if (!isValidUUID(cleaned)) {
    return null;
  }
  
  return cleaned.toLowerCase();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320; // RFC 5321 max length
}

/**
 * Validates URL format
 * Only allows http and https protocols
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes filename - removes path traversal attempts
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Only allow safe characters
    .replace(/\.{2,}/g, '_')            // Remove multiple dots
    .replace(/^\./, '_')                 // Remove leading dot
    .slice(0, 255);                      // Limit length
}

/**
 * Validates JWT token format (basic check)
 */
export function isValidJWT(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  return parts.length === 3;
}
```

**Update API routes to use validators:**

**Example: `/src/app/api/clients/[clientId]/route.ts`**
```typescript
import { isValidUUID, sanitizeUUID } from '@/lib/validators';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let clientId: string | undefined;
  try {
    const paramsData = await params;
    clientId = paramsData.clientId;

    // ✅ CRITICAL: Validate UUID format
    const sanitizedClientId = sanitizeUUID(clientId);
    if (!sanitizedClientId) {
      logger.warn('Invalid client ID format', { clientId });
      return NextResponse.json(
        { error: 'Invalid client ID format' },
        { status: 400 }
      );
    }

    // ... rest of the code using sanitizedClientId
  }
}
```

**Apply to all API routes that accept IDs:**
- `/api/clients/[clientId]/route.ts`
- `/api/posts/[clientId]/route.ts`
- `/api/posts-by-id/[postId]/route.ts`
- `/api/projects/[projectId]/route.ts`
- All other dynamic routes with IDs

---

## 🧪 TESTING CHECKLIST

### After Each Fix:
- [ ] Run `npm run build` - should succeed
- [ ] Run `npm run dev` - should start without errors
- [ ] Test the specific functionality
- [ ] Check browser console for errors
- [ ] Test with invalid inputs
- [ ] Verify error messages are appropriate

### Complete Testing:
```bash
# 1. Install updated dependencies
npm install

# 2. Run build
npm run build

# 3. Check for TypeScript errors
npx tsc --noEmit

# 4. Run dev server
npm run dev

# 5. Test critical paths:
# - User signup with weak password (should fail)
# - User signup with strong password (should succeed)
# - Image upload without auth (should fail)
# - Image upload with auth (should succeed)
# - Portal file upload with invalid type (should fail)
# - API calls with invalid UUIDs (should fail)
```

### Security Testing:
```bash
# 1. Run npm audit
npm audit

# 2. Check for exposed secrets
git secrets --scan

# 3. Test rate limiting
# Use tools like Apache Bench or Postman to test rate limits

# 4. Test XSS protection
# Try uploading files with script tags in names
# Test with malicious URLs
```

---

## 📊 PROGRESS TRACKING

### Day 1:
- [ ] Fix #1: Upload-image auth
- [ ] Fix #2: XSS vulnerability
- [ ] Fix #3: Update Next.js
- [ ] Test and verify

### Day 2:
- [ ] Fix #4: Portal rate limiting
- [ ] Fix #5: File validation
- [ ] Fix #6: Stripe validation
- [ ] Test and verify

### Day 3:
- [ ] Fix #7: Password requirements
- [ ] Fix #8: UUID validation
- [ ] Apply UUID validation to all routes
- [ ] Final testing

---

## ✅ VERIFICATION STEPS

**Before marking as complete:**

1. **Code Review:**
   ```bash
   git diff main HEAD
   # Review all changes with another developer
   ```

2. **Security Scan:**
   ```bash
   npm audit
   # Should show 0 vulnerabilities
   ```

3. **Build Test:**
   ```bash
   npm run build
   # Should complete without errors
   ```

4. **Manual Testing:**
   - [ ] Cannot upload files without authentication
   - [ ] XSS attacks blocked in image handling
   - [ ] Portal has strict rate limits
   - [ ] Invalid file types rejected
   - [ ] Weak passwords rejected
   - [ ] Invalid UUIDs rejected

5. **Deploy to Staging:**
   ```bash
   vercel --prod=false
   # Test on staging environment
   ```

---

## 🚀 DEPLOYMENT

**After all fixes are complete and tested:**

1. **Create Pull Request:**
   ```bash
   git checkout -b security-critical-fixes
   git add .
   git commit -m "SECURITY: Fix critical vulnerabilities before launch"
   git push origin security-critical-fixes
   ```

2. **Code Review:**
   - Have another developer review all changes
   - Run security checklist
   - Verify all tests pass

3. **Deploy to Production:**
   ```bash
   # After PR approval
   git checkout main
   git merge security-critical-fixes
   git push origin main
   
   # Deploy to Vercel
   vercel --prod
   ```

4. **Post-Deployment Verification:**
   - [ ] Test all critical paths in production
   - [ ] Monitor error logs for 24 hours
   - [ ] Run security scan on live site
   - [ ] Verify rate limiting works
   - [ ] Test authentication flows

---

## 📞 SUPPORT

**If you encounter issues:**

1. **Build Errors:** Check TypeScript types, imports
2. **Runtime Errors:** Check environment variables
3. **Test Failures:** Review validation logic
4. **Performance Issues:** Check rate limiting configuration

**Resources:**
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs
- OWASP Top 10: https://owasp.org/Top10/

---

## ✅ SIGN-OFF

**After completing all fixes:**

- [ ] All CRITICAL issues fixed
- [ ] All HIGH issues fixed
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Deployed to staging
- [ ] Security verified
- [ ] Ready for production launch

**Completed by:** _________________  
**Date:** _________________  
**Reviewed by:** _________________

