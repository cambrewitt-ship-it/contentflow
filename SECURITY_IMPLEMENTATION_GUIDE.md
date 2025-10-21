# ContentFlow Security Implementation Guide

## 🛡️ Overview

This document outlines the comprehensive security measures implemented in ContentFlow v2 to protect against common web application vulnerabilities and ensure data integrity.

## 🔐 Security Features Implemented

### 1. **Supabase Client Separation**

**Problem**: Service role keys were being used in client-side code and API routes, creating security vulnerabilities.

**Solution**: Implemented proper client separation:

- **Server-side Admin Client** (`src/lib/supabaseServer.ts`):
  - Uses service role key only for admin operations
  - Bypasses RLS for system-level operations
  - Never exposed to client-side code

- **Server-side User Client**:
  - Uses anon key with user tokens
  - Respects RLS policies
  - For authenticated API operations

- **Client-side Client** (`src/lib/supabaseClient.ts`):
  - Uses only anon key
  - Validates key format
  - Includes helper functions for authentication

**Usage**:
```typescript
// For admin operations (server-only)
const supabase = createSupabaseAdmin();

// For user operations (API routes)
const supabase = createSupabaseWithToken(userToken);

// For client-side operations
import { supabase } from '@/lib/supabaseClient';
```

### 2. **Enhanced Webhook Signature Validation**

**Problem**: Basic webhook signature validation was vulnerable to replay attacks and lacked proper error handling.

**Solution**: Implemented comprehensive webhook security:

- **Timestamp Validation**: Prevents replay attacks (5-minute tolerance)
- **Event Age Checking**: Rejects old events
- **Suspicious Event Detection**: Logs potentially malicious events
- **Enhanced Error Logging**: Sanitized error messages with detailed server-side logging

**Usage**:
```typescript
// Basic validation
const event = verifyWebhookSignature(payload, signature);

// Enhanced validation with timestamp checking
const event = verifyWebhookSignatureWithTimestamp(payload, signature, 300);
```

### 3. **File Upload Security**

**Problem**: File uploads were vulnerable to malicious file uploads and lacked proper validation.

**Solution**: Implemented multi-layered file security:

- **Magic Number Validation**: Verifies file content matches declared MIME type
- **File Size Limits**: Configurable limits per file type
- **Content Scanning**: Detects suspicious patterns in file content
- **Secure Filename Generation**: Prevents path traversal attacks
- **File Quarantine**: Isolates suspicious uploads

**Features**:
- Supports JPEG, PNG, GIF, WebP with proper magic number validation
- Configurable size limits (1MB for logos, 2MB for avatars, 10MB for images)
- Scans for script injection patterns
- Generates secure, timestamped filenames

**Usage**:
```typescript
const validation = await validateBase64ImageUpload(
  base64Data, 
  mimeType, 
  maxSize
);

if (!validation.isValid) {
  // Handle validation errors
  console.log(validation.errors);
}
```

### 4. **Redis-Based Rate Limiting**

**Problem**: In-memory rate limiting didn't persist across server restarts and wasn't distributed.

**Solution**: Implemented Redis-based distributed rate limiting:

- **Multiple Tiers**: Different limits for different operation types
- **Progressive Delays**: Increasing delays for repeated violations
- **IP-based Blocking**: Blocks persistent violators
- **Persistent Storage**: Survives server restarts
- **Fallback Support**: Graceful degradation when Redis unavailable

**Rate Limits**:
- AI endpoints: 20 requests/hour
- Authenticated users: 100 requests/15 minutes
- Public routes: 10 requests/15 minutes
- Portal routes: 50 requests/15 minutes
- Auth routes: 20 requests/15 minutes

### 5. **Error Message Sanitization**

**Problem**: Error messages exposed sensitive information about the system.

**Solution**: Implemented secure error handling:

- **Production-Safe Messages**: Generic error messages for clients
- **Detailed Server Logging**: Full error details logged server-side
- **Error Severity Levels**: Categorized error handling
- **Context Extraction**: Rich error context for debugging

**Error Categories**:
- Authentication errors
- Database errors
- File upload errors
- Rate limiting errors
- Validation errors

**Usage**:
```typescript
return handleApiError(
  error,
  { userId, operation: 'user_action' },
  'DATABASE_ERROR'
);
```

### 6. **CSRF Protection**

**Problem**: No protection against Cross-Site Request Forgery attacks.

**Solution**: Implemented comprehensive CSRF protection:

- **Token Generation**: Cryptographically secure tokens with HMAC signatures
- **Token Validation**: Verifies token integrity and expiration
- **Origin/Referer Validation**: Additional header validation
- **Middleware Integration**: Automatic protection for API routes
- **Safe Method Exemption**: GET, HEAD, OPTIONS requests exempted

**Features**:
- 32-byte random tokens with HMAC signatures
- 1-hour token expiration
- HTTP-only cookies for token storage
- Origin and Referer header validation
- Automatic middleware protection

### 7. **Secure Authentication Patterns**

**Problem**: Inconsistent authentication patterns across API routes.

**Solution**: Standardized secure authentication:

- **Token Validation**: Centralized user token validation
- **Access Control**: Resource-level access validation
- **Context Extraction**: Rich error context for security monitoring
- **RLS Enforcement**: Proper Row Level Security usage

## 🚀 Implementation Status

### ✅ Completed Features

1. **Supabase Client Separation** - Complete
2. **Webhook Signature Validation** - Complete
3. **File Upload Security** - Complete
4. **Error Message Sanitization** - Complete
5. **CSRF Protection** - Complete
6. **Rate Limiting** - Complete
7. **Security Migration Scripts** - Complete
8. **Verification Scripts** - Complete

### 📋 Migration Guide

To apply security updates to existing API routes:

1. **Run the migration script**:
   ```bash
   node scripts/security-migration.js
   ```

2. **Verify security implementation**:
   ```bash
   node scripts/security-verification.js
   ```

3. **Test security features**:
   ```bash
   # Test authentication
   curl -H "Authorization: Bearer invalid_token" /api/clients
   
   # Test rate limiting
   for i in {1..20}; do curl /api/ai; done
   
   # Test file upload security
   curl -X POST /api/upload-image -F "file=@malicious.exe"
   ```

## 🔧 Configuration

### Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_SUPABASE_SERVICE_ROLE=your_service_role_key

# Redis Configuration (for rate limiting)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# CSRF Protection
CSRF_SECRET_KEY=your_csrf_secret_key

# Stripe Webhook
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

### Security Headers

The application automatically sets security headers:

- `X-RateLimit-Limit`: Current rate limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp
- `X-CSRF-Token`: CSRF token for forms

## 🧪 Testing Security

### Automated Testing

Run the security verification script:
```bash
node scripts/security-verification.js
```

### Manual Testing

1. **Authentication Testing**:
   - Test with invalid tokens
   - Test with expired tokens
   - Test without authorization headers

2. **Rate Limiting Testing**:
   - Send rapid requests to test limits
   - Verify progressive delays
   - Test IP-based blocking

3. **File Upload Testing**:
   - Upload malicious files
   - Test file size limits
   - Test MIME type validation

4. **CSRF Testing**:
   - Test without CSRF tokens
   - Test with invalid tokens
   - Test cross-origin requests

## 📊 Monitoring

### Security Logs

All security events are logged with appropriate severity levels:

- **CRITICAL**: Service role key exposure, admin privilege escalation
- **HIGH**: Authentication failures, database errors
- **MEDIUM**: Rate limit violations, file upload warnings
- **LOW**: General security events

### Metrics to Monitor

1. **Authentication Failures**: Track failed login attempts
2. **Rate Limit Violations**: Monitor abuse patterns
3. **File Upload Rejections**: Track malicious upload attempts
4. **CSRF Protection Blocks**: Monitor attack attempts
5. **Error Rates**: Track system health

## 🚨 Incident Response

### Security Incident Checklist

1. **Immediate Response**:
   - Check security logs for the incident
   - Identify affected systems and data
   - Implement temporary mitigations

2. **Investigation**:
   - Analyze attack vectors
   - Review access logs
   - Check for data exfiltration

3. **Recovery**:
   - Patch vulnerabilities
   - Reset compromised credentials
   - Update security measures

4. **Post-Incident**:
   - Document lessons learned
   - Update security procedures
   - Conduct security review

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Stripe Webhook Security](https://stripe.com/docs/webhooks/signatures)

## 🤝 Contributing

When adding new features or modifying existing code:

1. Follow the established security patterns
2. Use the secure error handling functions
3. Implement proper authentication checks
4. Add appropriate rate limiting
5. Test security measures thoroughly
6. Update this documentation

## 📞 Support

For security-related questions or to report vulnerabilities:

1. Check this documentation first
2. Run the security verification script
3. Review the security logs
4. Contact the development team

---

**Last Updated**: December 2024
**Version**: 2.0
**Status**: Production Ready
