# Content Security Policy (CSP) Security Guide

## Overview

This application uses a comprehensive Content-Security-Policy to prevent XSS (Cross-Site Scripting) attacks while maintaining compatibility with modern frameworks and libraries.

## Current CSP Configuration

### Development Mode
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' ${SUPABASE_URL} http://localhost:* ws://localhost:* wss://localhost:*;
media-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
frame-src 'self';
```

### Production Mode
Same as development, but with these differences:
- `connect-src` removes localhost/websocket entries
- Adds `upgrade-insecure-requests` directive
- HSTS header is enabled

## CSP Directives Explained

### `default-src 'self'`
**Purpose:** Default policy for all resource types not explicitly defined.
**Security:** Only allows resources from the same origin.

### `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
**Purpose:** Controls JavaScript execution.
- `'self'`: Allows scripts from same origin
- `'unsafe-eval'`: Required for Next.js (webpack, hot reload)
- `'unsafe-inline'`: Required for React hydration and Next.js

**⚠️ Security Note:** `'unsafe-inline'` and `'unsafe-eval'` reduce XSS protection. Consider migrating to nonces or hashes in the future for stricter security.

**Alternative (More Secure):** Use CSP nonces:
```javascript
// In middleware or page
const nonce = crypto.randomBytes(16).toString('base64');
// Then use: script-src 'self' 'nonce-${nonce}'
```

### `style-src 'self' 'unsafe-inline'`
**Purpose:** Controls CSS loading and inline styles.
- Required for **Radix UI** components (dynamic positioning, animations)
- Required for **Tailwind CSS** arbitrary values (e.g., `bg-[#hexcolor]`)
- Allows inline `<style>` tags

**Why Needed:**
- Radix UI injects inline styles for overlays, tooltips, and dropdowns
- Tailwind arbitrary values compile to inline styles
- CSS-in-JS solutions often use inline styles

### `img-src 'self' data: blob: https:`
**Purpose:** Controls image sources.
- `'self'`: Same-origin images
- `data:`: Base64-encoded images (SVGs, icons)
- `blob:`: Next.js Image Optimization creates blob URLs
- `https:`: External HTTPS images (Supabase storage)

**🔒 Tightening Security:** In production, consider restricting to specific domains:
```
img-src 'self' data: blob: https://*.supabase.co https://yourdomain.com;
```

### `connect-src 'self' ${SUPABASE_URL} ...`
**Purpose:** Controls API calls, WebSockets, and data fetching.
- Allows connections to your Supabase backend
- In development: allows localhost and WebSocket connections for hot reload

**Security:** This is properly restricted to only your Supabase instance in production.

### `frame-ancestors 'none'`
**Purpose:** Prevents clickjacking attacks.
- Disallows your app from being embedded in iframes
- More modern than `X-Frame-Options: DENY`

### `object-src 'none'`
**Purpose:** Blocks `<object>`, `<embed>`, and `<applet>` tags.
- Prevents Flash and other plugin-based XSS vectors

## Additional Security Headers

### `X-DNS-Prefetch-Control: off`
Prevents DNS prefetching to avoid leaking user browsing patterns.

### `Strict-Transport-Security` (HSTS)
**Production Only:** Forces HTTPS for 2 years, including subdomains.
```
max-age=63072000; includeSubDomains; preload
```
**Why Only Production:** Avoids issues with localhost development.

### `X-Download-Options: noopen`
Prevents Internet Explorer from opening file downloads directly.

### `Permissions-Policy`
Disables unnecessary browser APIs:
- Camera
- Microphone
- Geolocation
- FLoC (interest-cohort) - Google's tracking mechanism

## Compatibility Matrix

| Technology | CSP Requirement | Status |
|------------|----------------|--------|
| **Radix UI** | `style-src 'unsafe-inline'` | ✅ Supported |
| **Tailwind CSS** | `style-src 'unsafe-inline'` | ✅ Supported |
| **Next.js** | `script-src 'unsafe-eval' 'unsafe-inline'` | ✅ Supported |
| **Next.js Image** | `img-src blob: data:` | ✅ Supported |
| **Supabase API** | `connect-src ${SUPABASE_URL}` | ✅ Supported |
| **Supabase Storage** | `img-src https:` | ✅ Supported |
| **Hot Reload** | Development WebSocket permissions | ✅ Supported |

## Testing Your CSP

### 1. Browser Console Test
Open browser DevTools (F12) and check for CSP violations:
```
Refused to load the script 'https://...' because it violates the following Content Security Policy directive: ...
```

### 2. Test Critical Features

#### Test Radix UI Components
- [ ] Open dropdowns/select menus
- [ ] Open modal dialogs
- [ ] Hover tooltips
- [ ] Check for styling issues

#### Test Tailwind Arbitrary Values
- [ ] Elements with `bg-[#hexcolor]`
- [ ] Custom spacing like `p-[13px]`
- [ ] Arbitrary breakpoints

#### Test Next.js Features
- [ ] Image optimization works
- [ ] Page navigation (client-side routing)
- [ ] API calls succeed
- [ ] Hot reload in development

#### Test Supabase Integration
- [ ] API calls to Supabase
- [ ] Image loading from Supabase storage
- [ ] Authentication flows

### 3. Automated Testing

Create a test script to verify headers:

```javascript
// test-csp.js
const https = require('https');

https.get('https://yourdomain.com', (res) => {
  console.log('CSP Header:', res.headers['content-security-policy']);
  console.log('HSTS Header:', res.headers['strict-transport-security']);
  console.log('X-Frame-Options:', res.headers['x-frame-options']);
});
```

### 4. Online CSP Evaluator
Use [CSP Evaluator](https://csp-evaluator.withgoogle.com/) to analyze your policy.

## Common CSP Issues and Solutions

### Issue: Radix UI Dropdowns Not Appearing
**Cause:** Missing `style-src 'unsafe-inline'`
**Solution:** Already included in our CSP

### Issue: Tailwind Arbitrary Values Not Working
**Cause:** Missing `style-src 'unsafe-inline'`
**Solution:** Already included in our CSP

### Issue: External Images Not Loading
**Cause:** Restrictive `img-src`
**Solution:** Our CSP allows `https:`, but consider restricting to specific domains in production

### Issue: Supabase API Calls Blocked
**Cause:** Missing Supabase URL in `connect-src`
**Solution:** Ensure `NEXT_PUBLIC_SUPABASE_URL` environment variable is set

### Issue: WebSocket Connection Failed (Development)
**Cause:** Missing WebSocket permissions in `connect-src`
**Solution:** Already included for development mode

## Future Improvements

### 1. Implement CSP Nonces
Replace `'unsafe-inline'` with nonces for scripts:
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(request: Request) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const response = NextResponse.next();
  
  response.headers.set(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}'`
  );
  
  return response;
}
```

### 2. Report-Only Mode
Test stricter policies without breaking the app:
```typescript
{
  key: 'Content-Security-Policy-Report-Only',
  value: 'default-src 'self'; report-uri /api/csp-report'
}
```

### 3. CSP Reporting
Implement CSP violation reporting:
```typescript
// app/api/csp-report/route.ts
export async function POST(req: Request) {
  const report = await req.json();
  console.log('CSP Violation:', report);
  // Log to monitoring service
}
```

### 4. Stricter Image Policy
In production, restrict to specific domains:
```typescript
const imageHosts = [
  "'self'",
  "data:",
  "blob:",
  "https://*.supabase.co",
  "https://yourdomain.com"
].join(' ');
```

## Security Checklist

- [x] CSP header configured
- [x] Different policies for dev/prod
- [x] HSTS enabled in production
- [x] Clickjacking prevention (`frame-ancestors 'none'`)
- [x] XSS protection headers
- [x] DNS prefetch control
- [x] Permissions policy configured
- [x] Supabase URL whitelisted
- [ ] CSP reporting endpoint (optional)
- [ ] CSP nonces for scripts (future improvement)
- [ ] Regular security audits

## Resources

- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)

## Support

If you encounter CSP-related issues:
1. Check browser console for violation reports
2. Verify environment variables are set
3. Test in both development and production modes
4. Review this guide's compatibility matrix
5. Consider temporarily using `Content-Security-Policy-Report-Only` for debugging

