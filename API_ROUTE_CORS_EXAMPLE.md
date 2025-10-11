# API Route CORS Integration Examples

This document shows how to integrate the CORS configuration into your existing API routes.

## Example 1: Using the CORS Helper (Recommended)

Here's how to update your existing API routes to use the CORS helper:

### Before (Original Route)
```typescript
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Your existing logic here
    const clients = await fetchClients();
    return NextResponse.json({ success: true, clients });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
```

### After (With CORS)
```typescript
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors, createCorsResponse, createCorsErrorResponse } from '@/lib/apiCorsHelper';

export const GET = withCors(async (req: NextRequest) => {
  try {
    // Your existing logic here
    const clients = await fetchClients();
    return createCorsResponse(req, { success: true, clients });
  } catch (error) {
    return createCorsErrorResponse(req, 'Failed to fetch clients', 500);
  }
});
```

## Example 2: Manual CORS Integration

If you prefer manual control over CORS handling:

```typescript
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, validateCors } from '@/lib/corsMiddleware';

export async function GET(req: NextRequest) {
  // Validate CORS
  const corsValidation = validateCors(req);
  if (!corsValidation.isValid) {
    return corsValidation.response!;
  }

  try {
    // Your existing logic here
    const clients = await fetchClients();
    const response = NextResponse.json({ success: true, clients });
    
    // Apply CORS headers
    return applyCorsHeaders(req, response);
  } catch (error) {
    const errorResponse = NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    return applyCorsHeaders(req, errorResponse);
  }
}
```

## Example 3: Portal Route with Custom Headers

For portal routes that need custom headers:

```typescript
// src/app/api/portal/calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors, createCorsResponse } from '@/lib/apiCorsHelper';

export const GET = withCors(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return createCorsResponse(request, { error: 'Token is required' }, 400);
    }

    // Your existing logic here
    const posts = await fetchCalendarPosts(token);
    
    // Create response with custom headers
    const response = createCorsResponse(request, { posts });
    response.headers.set('X-Portal-Status', 'active');
    
    return response;
  } catch (error) {
    return createCorsResponse(request, { error: 'Internal server error' }, 500);
  }
});
```

## Example 4: Handling Different HTTP Methods

```typescript
// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors, createCorsResponse, createCorsErrorResponse } from '@/lib/apiCorsHelper';

export const GET = withCors(async (req: NextRequest) => {
  try {
    const clients = await fetchClients();
    return createCorsResponse(req, { success: true, clients });
  } catch (error) {
    return createCorsErrorResponse(req, 'Failed to fetch clients', 500);
  }
});

export const POST = withCors(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const newClient = await createClient(body);
    return createCorsResponse(req, { success: true, client: newClient }, 201);
  } catch (error) {
    return createCorsErrorResponse(req, 'Failed to create client', 500);
  }
});

export const DELETE = withCors(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    
    if (!clientId) {
      return createCorsErrorResponse(req, 'Client ID is required', 400);
    }

    await deleteClient(clientId);
    return createCorsResponse(req, { success: true, message: 'Client deleted' });
  } catch (error) {
    return createCorsErrorResponse(req, 'Failed to delete client', 500);
  }
});
```

## Example 5: Error Handling with CORS

```typescript
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors, createCorsErrorResponse } from '@/lib/apiCorsHelper';

export const POST = withCors(async (req: NextRequest) => {
  try {
    // Check file size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      return createCorsErrorResponse(req, 'File too large', 413, 'Maximum file size is 10MB');
    }

    // Check content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return createCorsErrorResponse(req, 'Invalid file type', 400, 'Only image files are allowed');
    }

    // Your upload logic here
    const result = await uploadFile(req);
    return createCorsResponse(req, { success: true, file: result });
    
  } catch (error) {
    console.error('Upload error:', error);
    return createCorsErrorResponse(req, 'Upload failed', 500, 'Internal server error');
  }
});
```

## Migration Checklist

When updating your existing API routes:

1. **Import CORS utilities**:
   ```typescript
   import { withCors, createCorsResponse, createCorsErrorResponse } from '@/lib/apiCorsHelper';
   ```

2. **Wrap handlers with `withCors`**:
   ```typescript
   export const GET = withCors(async (req: NextRequest) => {
     // Your existing logic
   });
   ```

3. **Use CORS response helpers**:
   - `createCorsResponse()` for successful responses
   - `createCorsErrorResponse()` for error responses

4. **Test the changes**:
   ```bash
   npm run test:cors
   ```

5. **Verify in browser**:
   - Check Network tab for CORS headers
   - Test from different origins
   - Verify preflight requests work

## Benefits of This Approach

1. **Automatic CORS handling**: No need to manually set headers
2. **Consistent error responses**: Standardized error format
3. **Security**: Origin validation built-in
4. **Maintainable**: Centralized CORS configuration
5. **Type-safe**: Full TypeScript support

## Testing Your Changes

After updating your routes, test them with:

```bash
# Test CORS configuration
npm run test:cors

# Test specific route
curl -X GET \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/clients
```

This ensures your CORS configuration is working correctly and your API routes are properly secured.
