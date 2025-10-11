# CSP Quick Reference

## 🚀 Quick Start

Your Content-Security-Policy is now configured in `next.config.ts` and automatically applies to all routes.

### Test Your Headers

```bash
# Start your dev server
npm run dev

# In another terminal, test headers
node scripts/test-csp.js

# Test production build
npm run build
npm start
node scripts/test-csp.js http://localhost:3000

# Test with full header dump
node scripts/test-csp.js --verbose
```

## 📋 Configured Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Dynamic (see below) | Prevent XSS attacks |
| `X-Frame-Options` | DENY | Prevent clickjacking |
| `X-Content-Type-Options` | nosniff | Prevent MIME sniffing |
| `X-XSS-Protection` | 1; mode=block | Legacy XSS protection |
| `X-DNS-Prefetch-Control` | off | Privacy protection |
| `X-Download-Options` | noopen | IE security |
| `Strict-Transport-Security` | (prod only) | Force HTTPS |
| `Referrer-Policy` | strict-origin-when-cross-origin | Control referrer info |
| `Permissions-Policy` | Restrictive | Disable unnecessary APIs |

## 🔒 CSP Policy Summary

### Development
```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https:
font-src 'self' data:
connect-src 'self' [SUPABASE] http://localhost:* ws://localhost:*
media-src 'self' blob:
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'
frame-src 'self'
```

### Production
Same as development, but:
- ❌ No localhost/websocket in `connect-src`
- ✅ Adds `upgrade-insecure-requests`
- ✅ HSTS header enabled

## ✅ Compatibility Verified

| Component | Requirement | Status |
|-----------|-------------|--------|
| Radix UI dropdowns | `style-src 'unsafe-inline'` | ✅ |
| Tailwind arbitrary values | `style-src 'unsafe-inline'` | ✅ |
| Next.js hot reload | `script-src 'unsafe-eval'` | ✅ |
| Next.js Image | `img-src blob: data:` | ✅ |
| Supabase API | `connect-src [URL]` | ✅ |
| Supabase Storage | `img-src https:` | ✅ |

## 🐛 Troubleshooting

### CSP Violation in Browser Console?

1. **Open DevTools** (F12)
2. **Check Console** for errors like:
   ```
   Refused to load ... because it violates CSP directive: ...
   ```
3. **Identify the blocked resource**
4. **Update CSP** in `next.config.ts` if needed

### Common Issues

#### ❌ Images not loading from Supabase
**Solution:** Verify `NEXT_PUBLIC_SUPABASE_URL` is set in `.env.local`

#### ❌ API calls failing
**Solution:** Check `connect-src` includes your Supabase URL

#### ❌ Radix UI components unstyled
**Solution:** Verify `style-src 'unsafe-inline'` is present

#### ❌ Hot reload not working (dev)
**Solution:** Check `connect-src` includes `ws://localhost:*`

### Debug Mode

Test with report-only mode (doesn't block, only reports):

```typescript
// In next.config.ts, temporarily change:
{
  key: 'Content-Security-Policy-Report-Only',
  value: buildCSP(),
}
```

## 🔧 Customization

### Allow Additional Image Domains

```typescript
// In next.config.ts, update img-src:
"img-src 'self' data: blob: https://*.supabase.co https://yourdomain.com"
```

### Allow Additional API Endpoints

```typescript
// In next.config.ts, update connect-src:
`connect-src 'self' ${supabaseUrl} https://api.example.com`
```

### Add CSP Nonces (Advanced)

For stricter security, implement nonces:

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(request: Request) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const csp = `script-src 'self' 'nonce-${nonce}'`;
  
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  
  // Store nonce for use in app
  response.headers.set('X-Nonce', nonce);
  
  return response;
}
```

## 📊 Testing Checklist

Before deploying to production:

- [ ] Run `node scripts/test-csp.js` locally
- [ ] Test in development mode (`npm run dev`)
- [ ] Test production build (`npm run build && npm start`)
- [ ] Open all pages and check browser console for CSP violations
- [ ] Test Radix UI components (dropdowns, modals, tooltips)
- [ ] Test Tailwind arbitrary values (e.g., `bg-[#fff]`)
- [ ] Verify images load from Supabase storage
- [ ] Verify API calls to Supabase work
- [ ] Test authentication flows
- [ ] Check hot reload works in development

## 📚 Environment Variables Required

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🎯 Security Score

Test your security headers:
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

Expected score: **A** or **A+**

## 🚨 Important Notes

1. **'unsafe-inline' and 'unsafe-eval'** reduce CSP effectiveness but are currently required for:
   - Next.js framework functionality
   - React hydration
   - Radix UI components
   - Tailwind CSS arbitrary values

2. **HSTS** is only enabled in production to avoid localhost issues

3. **WebSocket permissions** are only in development for hot reload

4. **img-src https:** allows all HTTPS images. Consider restricting to specific domains in production for tighter security.

## 📞 Need Help?

1. Check `CSP_SECURITY_GUIDE.md` for detailed documentation
2. Run `node scripts/test-csp.js --verbose` for full header dump
3. Use browser DevTools to inspect CSP violations
4. Test with `Content-Security-Policy-Report-Only` before deploying

## 🔄 Regular Maintenance

- **Monthly:** Review CSP violations in browser console
- **Quarterly:** Audit security headers with online tools
- **Before major releases:** Run full security header tests
- **After dependency updates:** Verify components still work with CSP

