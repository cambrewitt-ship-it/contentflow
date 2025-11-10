import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import logger from '@/lib/logger';

// Validate CSRF secret exists at startup
if (!process.env.CSRF_SECRET_KEY) {
  throw new Error(
    'CRITICAL: CSRF_SECRET_KEY environment variable is not set. ' +
    'Generate a random 256-bit secret and configure it in all environments.'
  );
}

// CSRF configuration
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  COOKIE_NAME: 'csrf-token',
  HEADER_NAME: 'x-csrf-token',
  MAX_AGE: 60 * 60 * 1000, // 1 hour
  SECRET_KEY: process.env.CSRF_SECRET_KEY,
} as const;

// CSRF token interface
interface CSRFToken {
  token: string;
  timestamp: number;
  expires: number;
}

// Generate a secure CSRF token
export function generateCSRFToken(): string {
  const randomToken = randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex');
  const timestamp = Date.now();
  const expires = timestamp + CSRF_CONFIG.MAX_AGE;
  
  // Create HMAC signature for token integrity
  const hmac = createHmac('sha256', CSRF_CONFIG.SECRET_KEY);
  hmac.update(randomToken);
  hmac.update(timestamp.toString());
  hmac.update(expires.toString());
  
  const signature = hmac.digest('hex');
  
  // Combine token data with signature
  const tokenData = {
    token: randomToken,
    timestamp,
    expires,
    signature
  };
  
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

// Verify CSRF token
export function verifyCSRFToken(token: string): boolean {
  try {
    // Decode token
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as CSRFToken & { signature: string };
    
    // Check if token is expired
    if (Date.now() > tokenData.expires) {
      logger.warn('CSRF token expired');
      return false;
    }
    
    // Verify HMAC signature
    const hmac = createHmac('sha256', CSRF_CONFIG.SECRET_KEY);
    hmac.update(tokenData.token);
    hmac.update(tokenData.timestamp.toString());
    hmac.update(tokenData.expires.toString());
    
    const expectedSignature = hmac.digest('hex');
    
    if (tokenData.signature !== expectedSignature) {
      logger.warn('CSRF token signature verification failed');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('CSRF token verification error:', error);
    return false;
  }
}

// Extract CSRF token from request
async function extractCSRFToken(request: Request): Promise<string | null> {
  // Try header first
  const headerToken = request.headers.get(CSRF_CONFIG.HEADER_NAME);
  if (headerToken) return headerToken;

  // Try body for POST/PUT/PATCH
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const clone = request.clone();
      const body = await clone.json();
      return (
        body?.csrfToken ||
        body?.[CSRF_CONFIG.HEADER_NAME] ||
        body?._csrf ||
        null
      );
    } catch {
      return null;
    }
  }

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const clone = request.clone();
      const formData = await clone.formData();
      return (
        (formData.get(CSRF_CONFIG.HEADER_NAME) as string | null) ||
        (formData.get('_csrf') as string | null)
      );
    } catch {
      return null;
    }
  }

  // Try query parameter (fallback)
  try {
    const url = new URL(request.url);
    return (
      url.searchParams.get(CSRF_CONFIG.HEADER_NAME) ||
      url.searchParams.get('csrfToken') ||
      url.searchParams.get('_csrf')
    );
  } catch {
    return null;
  }
  return null;
}

// Validate CSRF token from request
export async function validateCSRFToken(
  request: NextRequest | Request
): Promise<{ isValid: boolean; error?: string }> {
  const token = await extractCSRFToken(request);
  
  if (!token) {
    return {
      isValid: false,
      error: 'CSRF token not provided'
    };
  }
  
  if (!verifyCSRFToken(token)) {
    return {
      isValid: false,
      error: 'Invalid or expired CSRF token'
    };
  }
  
  return { isValid: true };
}

// Create CSRF token response with cookie
export function createCSRFTokenResponse(): NextResponse {
  const token = generateCSRFToken();
  
  const response = NextResponse.json({ 
    success: true,
    csrfToken: token 
  });
  
  // Set CSRF token as HTTP-only cookie
  response.cookies.set(CSRF_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.MAX_AGE / 1000, // Convert to seconds
    path: '/'
  });
  
  return response;
}

// CSRF protection middleware
export async function csrfProtectionMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip CSRF protection for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null;
  }
  
  // Skip CSRF protection for public API routes
  const publicRoutes = [
    '/api/auth/',
    '/api/stripe/webhook',
    '/api/portal/validate',
    '/api/portal/verify'
  ];
  
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return null;
  }
  
  // Validate CSRF token
  const validation = await validateCSRFToken(request);
  
  if (!validation.isValid) {
    logger.warn('CSRF protection blocked request:', {
      pathname,
      method: request.method,
      error: validation.error,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });
    
    return NextResponse.json(
      { 
        error: 'CSRF protection failed',
        message: validation.error 
      },
      { status: 403 }
    );
  }
  
  return null;
}

// Helper function to add CSRF token to form data
export function addCSRFTokenToFormData(formData: FormData, token: string): FormData {
  formData.set(CSRF_CONFIG.HEADER_NAME, token);
  formData.set('_csrf', token);
  return formData;
}

// Helper function to add CSRF token to headers
export function addCSRFTokenToHeaders(headers: Headers, token: string): Headers {
  headers.set(CSRF_CONFIG.HEADER_NAME, token);
  return headers;
}

// Validate Origin and Referer headers
export function validateOriginAndReferer(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  if (!origin && !referer) {
    logger.warn('Missing Origin and Referer headers');
    return false;
  }
  
  // Check Origin header
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        logger.warn('Origin header mismatch:', { origin, host });
        return false;
      }
    } catch (error) {
      logger.warn('Invalid Origin header:', origin);
      return false;
    }
  }
  
  // Check Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        logger.warn('Referer header mismatch:', { referer, host });
        return false;
      }
    } catch (error) {
      logger.warn('Invalid Referer header:', referer);
      return false;
    }
  }
  
  return true;
}

// Enhanced CSRF protection with Origin/Referer validation
export async function enhancedCSRFProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  // First check basic CSRF protection
  const csrfResponse = await csrfProtectionMiddleware(request);
  if (csrfResponse) {
    return csrfResponse;
  }
  
  // Then validate Origin and Referer headers
  if (!validateOriginAndReferer(request)) {
    logger.warn('CSRF protection failed due to Origin/Referer validation');
    
    return NextResponse.json(
      { 
        error: 'CSRF protection failed',
        message: 'Invalid Origin or Referer header'
      },
      { status: 403 }
    );
  }
  
  return null;
}

// Generate CSRF token for client-side use
export function generateClientCSRFToken(): { token: string; expires: number } {
  const token = generateCSRFToken();
  const expires = Date.now() + CSRF_CONFIG.MAX_AGE;
  
  return { token, expires };
}

// CSRF token refresh endpoint handler
export function handleCSRFTokenRefresh(): NextResponse {
  return createCSRFTokenResponse();
}
