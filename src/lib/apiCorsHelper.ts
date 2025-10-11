import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, validateCors } from './corsMiddleware';

// Helper function to wrap API route handlers with CORS
export function withCors<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Validate CORS for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const corsValidation = validateCors(request);
      if (!corsValidation.isValid) {
        return corsValidation.response!;
      }
    }

    // Call the original handler
    const response = await handler(request, ...args);

    // Apply CORS headers to the response
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return applyCorsHeaders(request, response);
    }

    return response;
  };
}

// Example usage for API routes
export function createCorsResponse(
  request: NextRequest,
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): NextResponse {
  const response = NextResponse.json(data, { status, headers: additionalHeaders });
  
  // Apply CORS headers if it's an API route
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return applyCorsHeaders(request, response);
  }
  
  return response;
}

// Example usage for error responses
export function createCorsErrorResponse(
  request: NextRequest,
  error: string,
  status: number = 400,
  details?: string
): NextResponse {
  const errorData = {
    error,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
  
  return createCorsResponse(request, errorData, status);
}
