import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { simpleRateLimitMiddleware } from './lib/simpleRateLimit';
// NOTE: CSRF protection removed from middleware - causes Edge Runtime errors with crypto module
// CSRF protection should be implemented at the API route level instead
// import { enhancedCSRFProtection } from './lib/csrfProtection';

export async function middleware(req: NextRequest) {
  // Apply rate limiting to API routes first
  const rateLimitResponse = await simpleRateLimitMiddleware(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // CSRF protection disabled in middleware - implement at API route level if needed
  // Middleware runs in Edge Runtime which doesn't support Node.js crypto module
  // const csrfResponse = await enhancedCSRFProtection(req);
  // if (csrfResponse) {
  //   return csrfResponse;
  // }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Get session and refresh if needed
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  // Debug logging for auth issues
  if (req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/auth/login') ||
      req.nextUrl.pathname.startsWith('/monitoring')) {
    console.log('🔍 Middleware Auth Check:', {
      pathname: req.nextUrl.pathname,
      method: req.method,
      hasSession: !!session,
      userId: session?.user?.id || 'none',
      email: session?.user?.email || 'none',
      cookies: req.cookies.getAll().map(c => c.name).join(', ')
    });
  }

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/pricing',
    '/features',
    '/contact',
    '/terms',
  ];

  // Define public API routes that don't require authentication
  const publicApiPrefixes = [
    '/api/portal/', // Client portal (uses token auth)
    '/api/auth/',   // Auth endpoints
    '/api/stripe/webhook', // Stripe webhooks
    '/api/stripe/callback', // Stripe checkout callback (handles auth internally)
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
    // Only redirect if we have a valid session with a user
    if (session?.user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
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
     * - static assets (served from /public), e.g. images, videos, fonts, etc.
     *
     * Important: if media files (like .mp4) are not excluded here, the middleware
     * can intercept the request and apply auth redirects, causing <video> to
     * "load forever" on public pages like the landing page.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|pdf|zip|woff|woff2|ttf|eot|otf|mp4|webm|mov|m4v|avi|mpeg|mpg|mp3|wav|ogg)$).*)',
  ],
};
