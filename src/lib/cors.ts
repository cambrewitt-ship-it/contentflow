import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins
const ALLOWED_ORIGINS = {
  production: [
    'https://your-production-domain.com', // Replace with your actual production domain
    'https://www.your-production-domain.com', // Replace with your actual production domain
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

// CORS configuration for different route types
export const CORS_CONFIG = {
  // Strict CORS for regular API routes
  api: {
    allowedOrigins: getAllowedOrigins(),
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
    allowedOrigins: getAllowedOrigins(),
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

// Check if origin is allowed
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

// Get CORS config based on route path
function getCorsConfig(pathname: string) {
  if (pathname.startsWith('/api/portal/')) {
    return CORS_CONFIG.portal;
  }
  return CORS_CONFIG.api;
}

// Set CORS headers
function setCorsHeaders(
  response: NextResponse,
  origin: string | null,
  corsConfig: typeof CORS_CONFIG.api
): NextResponse {
  // Set Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (corsConfig.allowedOrigins.length === 1) {
    // If only one origin is allowed, set it directly
    response.headers.set('Access-Control-Allow-Origin', corsConfig.allowedOrigins[0]);
  }

  // Set other CORS headers
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

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Handle CORS preflight requests
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  const corsConfig = getCorsConfig(pathname);

  // Check if origin is allowed
  if (origin && !isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    return new NextResponse(null, { status: 403 });
  }

  // Create response for preflight
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response, origin, corsConfig);
}

// Apply CORS headers to response
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  const corsConfig = getCorsConfig(pathname);

  // Check if origin is allowed
  if (origin && !isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    return new NextResponse(null, { status: 403 });
  }

  return setCorsHeaders(response, origin, corsConfig);
}

// Validate CORS for API routes
export function validateCors(request: NextRequest): { isValid: boolean; response?: NextResponse } {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;
  const corsConfig = getCorsConfig(pathname);

  // Allow same-origin requests
  if (!origin) {
    return { isValid: true };
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin, corsConfig.allowedOrigins)) {
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
