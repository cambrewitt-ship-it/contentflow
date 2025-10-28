import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins based on environment
const ALLOWED_ORIGINS = {
  production: [
    'https://content-manager.io',
    'https://www.content-manager.io',
  ],
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ],
};

// Get allowed origins based on environment
function getAllowedOrigins(): string[] {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return isDevelopment 
    ? [...ALLOWED_ORIGINS.development, ...ALLOWED_ORIGINS.production]
    : ALLOWED_ORIGINS.production;
}

// Check if origin is allowed
function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

// CORS configuration for different route types
const CORS_CONFIG = {
  // Strict CORS for regular API routes
  api: {
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
  },
  
  // More permissive CORS for portal routes
  portal: {
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
  },
};

// Get CORS config based on route path
function getCorsConfig(pathname: string) {
  if (pathname.startsWith('/api/portal/')) {
    return CORS_CONFIG.portal;
  }
  return CORS_CONFIG.api;
}

// Handle CORS preflight requests
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  
  // Allow same-origin requests
  if (!origin) {
    return null;
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  const corsConfig = getCorsConfig(pathname);
  
  // Create response for preflight
  const response = new NextResponse(null, { status: 200 });
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  );
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  
  if (corsConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

// Apply CORS headers to response
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  
  // Allow same-origin requests
  if (!origin) {
    return response;
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin)) {
    return new NextResponse(
      JSON.stringify({ error: 'CORS policy violation: Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const corsConfig = getCorsConfig(pathname);
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  );
  
  if (corsConfig.exposedHeaders.length > 0) {
    response.headers.set(
      'Access-Control-Expose-Headers',
      corsConfig.exposedHeaders.join(', ')
    );
  }
  
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  
  if (corsConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

// Validate CORS for API routes
export function validateCors(request: NextRequest): { isValid: boolean; response?: NextResponse } {
  const origin = request.headers.get('origin');
  
  // Allow same-origin requests
  if (!origin) {
    return { isValid: true };
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin)) {
    return {
      isValid: false,
      response: new NextResponse(
        JSON.stringify({ error: 'CORS policy violation: Origin not allowed' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  return { isValid: true };
}
