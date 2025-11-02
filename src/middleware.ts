import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { simpleRateLimitMiddleware } from './lib/simpleRateLimit';
import { enhancedCSRFProtection } from './lib/csrfProtection';

export async function middleware(req: NextRequest) {
  // Apply rate limiting to API routes first
  const rateLimitResponse = await simpleRateLimitMiddleware(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Apply CSRF protection to API routes
  const csrfResponse = enhancedCSRFProtection(req);
  if (csrfResponse) {
    return csrfResponse;
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/pricing',
  ];

  // Define public API routes that don't require authentication
  const publicApiPrefixes = [
    '/api/portal/', // Client portal (uses token auth)
    '/api/auth/',   // Auth endpoints
    '/api/stripe/webhook', // Stripe webhooks
  ];

  // Define public dynamic routes
  const publicDynamicPrefixes = [
    '/portal/',     // Client portal pages
    '/approval/',   // Approval pages with tokens
  ];

  const pathname = req.nextUrl.pathname;

  // Check if it's a public route
  const isPublicRoute = publicRoutes.includes(pathname);
  const isPublicApi = publicApiPrefixes.some(prefix => pathname.startsWith(prefix));
  const isPublicDynamic = publicDynamicPrefixes.some(prefix => pathname.startsWith(prefix));
  
  // If it's a public route, allow access
  if (isPublicRoute || isPublicApi || isPublicDynamic) {
    // Redirect authenticated users away from auth pages to dashboard
    if (session && (pathname === '/auth/login' || pathname === '/auth/signup')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return res;
  }

  // For all other routes, require authentication
  if (!session) {
    // Store the original URL to redirect back after login
    const redirectUrl = new URL('/auth/login', req.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
