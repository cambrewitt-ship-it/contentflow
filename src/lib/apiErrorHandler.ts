import { NextResponse } from 'next/server';

/**
 * Secure API Error Handler
 * 
 * This utility provides secure error handling for API routes by:
 * - Sanitizing error messages to prevent information leakage
 * - Logging detailed errors server-side for debugging
 * - Returning generic error messages to clients
 * - Maintaining appropriate HTTP status codes
 */

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: string;
}

export interface ErrorContext {
  route: string;
  operation: string;
  userId?: string;
  clientId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Sanitizes error messages to prevent information leakage
 */
function sanitizeErrorMessage(error: any, context: ErrorContext): string {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // List of sensitive patterns to remove or replace
  const sensitivePatterns = [
    // Database table/column names
    /table\s+["']?(\w+)["']?\s+does\s+not\s+exist/gi,
    /column\s+["']?(\w+)["']?\s+does\s+not\s+exist/gi,
    /relation\s+["']?(\w+)["']?\s+does\s+not\s+exist/gi,
    /table\s+["']?(\w+)["']?\s+already\s+exists/gi,
    
    // Database error codes
    /error\s+code:\s*\w+/gi,
    /PGRST\d+/gi,
    /42P\d+/gi,
    
    // File paths
    /\/[a-zA-Z0-9\/\-_\.]+\.(js|ts|json|sql)/gi,
    /at\s+[a-zA-Z0-9\/\-_\.]+\.(js|ts)/gi,
    
    // API keys and tokens
    /[a-zA-Z0-9]{20,}/gi, // Long alphanumeric strings (potential keys)
    /Bearer\s+[a-zA-Z0-9]+/gi,
    /api[_-]?key[:\s=]+[a-zA-Z0-9]+/gi,
    
    // Stack traces
    /at\s+.*\n/g,
    /Stack:/gi,
    /Error:/gi,
    
    // Internal system details
    /supabase/gi,
    /postgres/gi,
    /database/gi,
    /connection/gi,
    /timeout/gi,
    /ECONNREFUSED/gi,
    /ENOTFOUND/gi,
  ];

  let sanitized = errorMessage;
  
  // Apply sanitization patterns
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Additional cleanup
  sanitized = sanitized
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\[REDACTED\]\s*\[REDACTED\]/g, '[REDACTED]') // Remove duplicate redactions
    .trim();

  // If message is too revealing, use generic message
  if (sanitized.length > 100 || sanitized.includes('[REDACTED]')) {
    return 'An error occurred while processing your request';
  }

  return sanitized;
}

/**
 * Determines appropriate HTTP status code based on error type
 */
function getStatusCode(error: any, context: ErrorContext): number {
  // Authentication/Authorization errors
  if (error?.message?.includes('auth') || error?.message?.includes('token') || error?.message?.includes('unauthorized')) {
    return 401;
  }
  
  if (error?.message?.includes('forbidden') || error?.message?.includes('access denied')) {
    return 403;
  }

  // Not found errors
  if (error?.message?.includes('not found') || error?.code === 'PGRST116') {
    return 404;
  }

  // Validation errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid') || error?.message?.includes('required')) {
    return 400;
  }

  // Rate limiting
  if (error?.message?.includes('rate limit') || error?.message?.includes('too many requests')) {
    return 429;
  }

  // Database connection issues
  if (error?.message?.includes('connection') || error?.message?.includes('timeout')) {
    return 503; // Service Unavailable
  }

  // Default to 500 for server errors
  return 500;
}

/**
 * Creates a generic error message based on status code
 */
function getGenericErrorMessage(status: number, context: ErrorContext): string {
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Access denied';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Conflict - resource already exists or is in use';
    case 422:
      return 'Invalid data provided';
    case 429:
      return 'Too many requests - please try again later';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service temporarily unavailable';
    default:
      return 'An error occurred';
  }
}

/**
 * Logs detailed error information server-side
 */
function logError(error: any, context: ErrorContext, sanitizedMessage: string): void {
  const logData = {
    timestamp: new Date().toISOString(),
    route: context.route,
    operation: context.operation,
    userId: context.userId,
    clientId: context.clientId,
    errorType: error?.constructor?.name || 'Unknown',
    errorMessage: error?.message || 'No message',
    sanitizedMessage,
    stack: error?.stack || 'No stack trace',
    additionalData: context.additionalData,
  };

  // Use console.error for now - in production, this should go to a proper logging service
  console.error('API Error Details:', JSON.stringify(logData, null, 2));
}

/**
 * Main error handler function
 */
export function handleApiError(
  error: any,
  context: ErrorContext
): NextResponse {
  const sanitizedMessage = sanitizeErrorMessage(error, context);
  const status = getStatusCode(error, context);
  const genericMessage = getGenericErrorMessage(status, context);

  // Log detailed error server-side
  logError(error, context, sanitizedMessage);

  // Return sanitized response to client
  const response: any = {
    error: genericMessage,
    success: false,
  };

  // Add specific details only for client errors (4xx)
  if (status >= 400 && status < 500) {
    // For client errors, we can be slightly more specific
    if (status === 400 && sanitizedMessage !== genericMessage) {
      response.details = sanitizedMessage;
    }
  }

  return NextResponse.json(response, { status });
}

/**
 * Wrapper for async API route handlers with automatic error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse>,
  context: Omit<ErrorContext, 'operation'>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, {
        ...context,
        operation: 'unknown',
      });
    }
  };
}

/**
 * Specific error handlers for common scenarios
 */
export const ApiErrors = {
  // Authentication errors
  unauthorized: (message = 'Authentication required') => 
    NextResponse.json({ error: message, success: false }, { status: 401 }),
  
  forbidden: (message = 'Access denied') => 
    NextResponse.json({ error: message, success: false }, { status: 403 }),
  
  // Not found errors
  notFound: (resource = 'Resource') => 
    NextResponse.json({ error: `${resource} not found`, success: false }, { status: 404 }),
  
  // Validation errors
  badRequest: (message = 'Invalid request') => 
    NextResponse.json({ error: message, success: false }, { status: 400 }),
  
  // Server errors
  internalError: (message = 'Internal server error') => 
    NextResponse.json({ error: message, success: false }, { status: 500 }),
  
  // Service unavailable
  serviceUnavailable: (message = 'Service temporarily unavailable') => 
    NextResponse.json({ error: message, success: false }, { status: 503 }),
};

/**
 * Database error handler specifically for Supabase errors
 */
export function handleDatabaseError(
  error: any,
  context: ErrorContext,
  fallbackMessage = 'Database operation failed'
): NextResponse {
  // Log the full database error server-side
  console.error('Database Error:', {
    ...context,
    error: {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    },
  });

  // Map common database errors to appropriate HTTP status codes
  if (error?.code === 'PGRST116') {
    return ApiErrors.notFound();
  }

  if (error?.code === '23505') { // Unique constraint violation
    return NextResponse.json({ 
      error: 'Resource already exists', 
      success: false 
    }, { status: 409 });
  }

  if (error?.code === '23503') { // Foreign key constraint violation
    return NextResponse.json({ 
      error: 'Invalid reference', 
      success: false 
    }, { status: 400 });
  }

  // For other database errors, return generic message
  return NextResponse.json({ 
    error: fallbackMessage, 
    success: false 
  }, { status: 500 });
}

/**
 * Validation error handler
 */
export function handleValidationError(
  errors: string[],
  context: ErrorContext
): NextResponse {
  console.error('Validation Error:', {
    ...context,
    validationErrors: errors,
  });

  return NextResponse.json({
    error: 'Validation failed',
    details: errors,
    success: false,
  }, { status: 400 });
}
