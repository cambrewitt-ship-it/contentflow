# Secure API Error Handling Guide

## Overview

This guide documents the secure error handling patterns implemented across all API routes to prevent information leakage and maintain security best practices.

## Security Issues Fixed

### ❌ **Before: Exposed Sensitive Information**

```typescript
// VULNERABLE - Exposes database details
if (error) {
  console.error('❌ Supabase error:', error);
  return NextResponse.json(
    { error: `Database error: ${error.message}` },
    { status: 500 }
  );
}

// VULNERABLE - Exposes stack traces
} catch (error) {
  console.error('💥 Unexpected error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Failed to process' },
    { status: 500 }
  );
}
```

### ✅ **After: Secure Error Handling**

```typescript
// SECURE - Sanitized error messages
if (error) {
  return handleDatabaseError(error, {
    route: '/api/endpoint',
    operation: 'operation_name',
    clientId: clientId,
  }, 'Operation failed');
}

// SECURE - Generic error responses
} catch (error) {
  return handleApiError(error, {
    route: '/api/endpoint',
    operation: 'operation_name',
    additionalData: { context }
  });
}
```

## Error Handler Utility

### Core Functions

#### `handleApiError(error, context)`
- Sanitizes error messages
- Logs detailed errors server-side
- Returns generic error responses to clients
- Maintains appropriate HTTP status codes

#### `handleDatabaseError(error, context, fallbackMessage)`
- Specialized for database operations
- Maps database error codes to HTTP status codes
- Sanitizes database-specific error details

#### `ApiErrors.*`
- Pre-built error responses for common scenarios
- Consistent error message formatting
- Appropriate HTTP status codes

### Usage Examples

```typescript
import { handleApiError, handleDatabaseError, ApiErrors } from '../../../lib/apiErrorHandler';

// For general errors
try {
  // API logic
} catch (error) {
  return handleApiError(error, {
    route: '/api/endpoint',
    operation: 'operation_name',
    userId: userId,
    clientId: clientId,
    additionalData: { customData }
  });
}

// For database errors
if (dbError) {
  return handleDatabaseError(dbError, {
    route: '/api/endpoint',
    operation: 'database_operation',
    clientId: clientId,
  }, 'Resource not found');
}

// For specific error types
if (!authorized) {
  return ApiErrors.forbidden('Access denied');
}

if (!found) {
  return ApiErrors.notFound('Resource not found');
}
```

## Security Features

### 1. **Message Sanitization**
- Removes database table/column names
- Strips API keys and tokens
- Eliminates file paths and stack traces
- Normalizes error messages

### 2. **Sensitive Pattern Detection**
```typescript
const sensitivePatterns = [
  /table\s+["']?(\w+)["']?\s+does\s+not\s+exist/gi,
  /column\s+["']?(\w+)["']?\s+does\s+not\s+exist/gi,
  /PGRST\d+/gi,  // Supabase error codes
  /42P\d+/gi,    // PostgreSQL error codes
  /[a-zA-Z0-9]{20,}/gi,  // Potential API keys
  /at\s+[a-zA-Z0-9\/\-_\.]+\.(js|ts)/gi,  // File paths
];
```

### 3. **Server-Side Logging**
- Detailed error information logged server-side
- Includes context, user IDs, operation details
- Structured logging for debugging
- No sensitive data sent to clients

### 4. **HTTP Status Code Mapping**
- 400: Invalid request
- 401: Authentication required
- 403: Access denied
- 404: Resource not found
- 409: Conflict
- 422: Validation failed
- 429: Rate limited
- 500: Internal server error
- 503: Service unavailable

## Implementation Examples

### Example 1: Posts API Route

**Before:**
```typescript
if (error) {
  console.error('❌ Supabase error:', error);
  return NextResponse.json(
    { error: `Database error: ${error.message}` },
    { status: 500 }
  );
}
```

**After:**
```typescript
if (error) {
  return handleDatabaseError(error, {
    route: '/api/posts-by-id/[postId]',
    operation: 'fetch_post',
    clientId: client_id,
    additionalData: { postId }
  }, 'Post not found');
}
```

### Example 2: Client API Route

**Before:**
```typescript
} catch (error: unknown) {
  console.error('💥 Error in get client route:', error);
  return NextResponse.json({ 
    error: 'Internal server error', 
    details: error instanceof Error ? error.message : String(error)
  }, { status: 500 });
}
```

**After:**
```typescript
} catch (error: unknown) {
  return handleApiError(error, {
    route: '/api/clients/[clientId]',
    operation: 'fetch_client',
    additionalData: { clientId }
  });
}
```

### Example 3: AI API Route

**Before:**
```typescript
} catch (error) {
  console.error('AI API Error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**After:**
```typescript
} catch (error) {
  return handleApiError(error, {
    route: '/api/ai',
    operation: 'ai_request',
    additionalData: { action: action || 'unknown' }
  });
}
```

## Error Response Format

### Client Response (Sanitized)
```json
{
  "error": "Internal server error",
  "success": false
}
```

### Server Log (Detailed)
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "route": "/api/posts-by-id/[postId]",
  "operation": "fetch_post",
  "userId": "user-123",
  "clientId": "client-456",
  "errorType": "PostgrestError",
  "errorMessage": "relation \"posts\" does not exist",
  "sanitizedMessage": "An error occurred while processing your request",
  "stack": "Error: relation \"posts\" does not exist\n    at ...",
  "additionalData": { "postId": "post-789" }
}
```

## Best Practices

### ✅ **Do:**
- Use the error handler utility for all API routes
- Provide meaningful context in error handlers
- Log detailed errors server-side
- Return generic messages to clients
- Use appropriate HTTP status codes
- Sanitize all error messages

### ❌ **Don't:**
- Expose database error details to clients
- Return stack traces in API responses
- Include file paths or internal system details
- Log sensitive data (passwords, tokens, etc.)
- Use generic 500 errors for client errors
- Skip error handling in API routes

## Migration Checklist

For each API route:

- [ ] Import error handler utilities
- [ ] Replace direct error responses with `handleApiError`
- [ ] Replace database error responses with `handleDatabaseError`
- [ ] Use `ApiErrors.*` for common error scenarios
- [ ] Add meaningful context to error handlers
- [ ] Test error responses don't leak information
- [ ] Verify server-side logging works correctly

## Testing Error Handling

### Test Cases:
1. **Database Connection Errors** - Should return 503, not expose connection details
2. **Authentication Failures** - Should return 401, not expose token details
3. **Validation Errors** - Should return 400, not expose validation internals
4. **Not Found Errors** - Should return 404, not expose table/column names
5. **Permission Errors** - Should return 403, not expose access control details

### Example Test:
```typescript
// Test that database errors are sanitized
const response = await fetch('/api/posts/invalid-id');
const data = await response.json();

// Should NOT contain:
// - Database table names
// - SQL error codes
// - Stack traces
// - File paths

// Should contain:
// - Generic error message
// - Appropriate status code
// - No sensitive information
```

## Security Benefits

1. **Prevents Information Disclosure** - No internal system details leaked
2. **Consistent Error Handling** - All routes follow same security patterns
3. **Better Debugging** - Detailed server-side logging for developers
4. **Improved User Experience** - Clear, non-technical error messages
5. **Compliance Ready** - Meets security standards for error handling
6. **Attack Surface Reduction** - Less information for attackers to exploit

## Future Enhancements

1. **Structured Logging** - Integrate with logging service (e.g., DataDog, New Relic)
2. **Error Monitoring** - Set up alerts for error patterns
3. **Rate Limiting** - Add rate limiting to error responses
4. **Error Analytics** - Track error trends and patterns
5. **Custom Error Pages** - User-friendly error pages for web routes
