# CORS Security Configuration

This document outlines the comprehensive CORS (Cross-Origin Resource Sharing) security setup implemented for the ContentFlow application.

## Overview

The CORS configuration provides different security levels for different parts of the application:
- **Strict CORS** for regular API routes (`/api/*`)
- **Permissive CORS** for portal routes (`/api/portal/*`)
- **Security headers** for all routes

## Configuration Files

### 1. CORS Middleware (`src/lib/corsMiddleware.ts`)

Contains the core CORS logic with different configurations for different route types.

**Key Features:**
- Environment-based origin whitelisting
- Different CORS rules for portal vs API routes
- Origin validation
- Preflight request handling

### 2. Next.js Configuration (`next.config.ts`)

Adds security headers and additional CORS configuration at the framework level.

### 3. API CORS Helper (`src/lib/apiCorsHelper.ts`)

Provides utility functions to easily apply CORS to API routes.

## Configuration Details

### Allowed Origins

**Development:**
- `http://localhost:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`
- Production domains (for testing)

**Production:**
- `https://your-production-domain.com` (REPLACE WITH ACTUAL DOMAIN)
- `https://www.your-production-domain.com` (REPLACE WITH ACTUAL DOMAIN)

### CORS Rules by Route Type

#### Regular API Routes (`/api/*`)
```typescript
{
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours
  credentials: true,
}
```

#### Portal Routes (`/api/portal/*`)
```typescript
{
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'X-Portal-Token', // Custom header for portal authentication
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining', 'X-Portal-Status'],
  maxAge: 3600, // 1 hour (shorter for portal)
  credentials: false, // Portal doesn't need credentials
}
```

## Usage Examples

### 1. Using CORS Helper in API Routes

```typescript
import { withCors, createCorsResponse, createCorsErrorResponse } from '@/lib/apiCorsHelper';

// Wrap your API handler with CORS
export const GET = withCors(async (request: NextRequest) => {
  try {
    const data = await fetchData();
    return createCorsResponse(request, { data });
  } catch (error) {
    return createCorsErrorResponse(request, 'Failed to fetch data', 500);
  }
});
```

### 2. Manual CORS Application

```typescript
import { applyCorsHeaders, validateCors } from '@/lib/corsMiddleware';

export async function GET(request: NextRequest) {
  // Validate CORS
  const corsValidation = validateCors(request);
  if (!corsValidation.isValid) {
    return corsValidation.response!;
  }

  // Your API logic here
  const response = NextResponse.json({ data: 'example' });
  
  // Apply CORS headers
  return applyCorsHeaders(request, response);
}
```

### 3. Handling OPTIONS Requests

The middleware automatically handles OPTIONS preflight requests, but you can also create specific handlers:

```typescript
// src/app/api/cors-options/route.ts
import { handleCorsPreflight } from '@/lib/corsMiddleware';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 200 });
}
```

## Security Headers

The configuration includes these security headers for all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Setup Instructions

### 1. Update Production Domains

Edit `src/lib/corsMiddleware.ts` and replace the placeholder domains:

```typescript
const ALLOWED_ORIGINS = {
  production: [
    'https://your-actual-domain.com', // Replace this
    'https://www.your-actual-domain.com', // Replace this
  ],
  // ... rest of config
};
```

### 2. Environment Variables

No additional environment variables are required. The configuration automatically detects the environment.

### 3. Testing CORS

You can test CORS configuration using curl:

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3000/api/clients

# Test actual request
curl -X GET \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/clients
```

## Portal-Specific Configuration

Portal routes (`/api/portal/*`) have more permissive CORS settings to allow client access:

- **Credentials**: Disabled (portal doesn't need cookies/auth headers)
- **Custom Headers**: Includes `X-Portal-Token` for portal authentication
- **Shorter Cache**: 1 hour instead of 24 hours for security
- **Additional Methods**: Includes `OPTIONS` for preflight handling

## Monitoring and Debugging

### CORS Violations

CORS violations will return a 403 status with this response:
```json
{
  "error": "CORS policy violation: Origin not allowed"
}
```

### Debugging Tips

1. Check browser developer tools for CORS errors
2. Verify the origin is in the allowed list
3. Ensure preflight requests are handled correctly
4. Check that required headers are included in the request

## Security Considerations

1. **Origin Validation**: Only whitelisted origins can access the API
2. **Method Restrictions**: Only necessary HTTP methods are allowed
3. **Header Validation**: Only required headers are permitted
4. **Credential Handling**: Credentials are only allowed for authenticated API routes
5. **Cache Control**: Appropriate cache times for different route types

## Maintenance

- Update allowed origins when adding new domains
- Review and update allowed methods/headers as needed
- Monitor CORS violations in logs
- Test CORS configuration after any changes

## Troubleshooting

### Common Issues

1. **CORS Error in Browser**: Check if origin is whitelisted
2. **Preflight Fails**: Ensure OPTIONS method is handled
3. **Credentials Not Sent**: Check if credentials are enabled for the route type
4. **Headers Blocked**: Verify all required headers are in the allowed list

### Quick Fixes

1. Add missing origin to whitelist
2. Include missing headers in allowed list
3. Enable credentials if needed for the route type
4. Check that preflight requests are properly handled
