import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');

  // Check if this is a password reset flow
  // Supabase sends recovery tokens in hash fragments, which we can't access server-side
  // But if the type parameter is 'recovery' or if we detect it might be a recovery flow,
  // redirect to reset-password page - the hash will be preserved by the browser
  if (type === 'recovery' || requestUrl.pathname.includes('reset') || 
      requestUrl.searchParams.has('type') && requestUrl.searchParams.get('type')?.includes('recovery')) {
    const resetPasswordUrl = requestUrl.origin + '/auth/reset-password';
    console.log('🔄 Password reset flow detected, redirecting to reset-password page');
    // Redirect to reset-password - browser will preserve hash fragment automatically
    return NextResponse.redirect(resetPasswordUrl);
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    // Verify session was established before redirecting
    if (error || !data.session) {
      console.error('Failed to exchange code for session:', error);
      return NextResponse.redirect(requestUrl.origin + '/auth/login?error=authentication_failed');
    }
    
    // Verify we have a user
    if (!data.user) {
      console.error('No user returned from session exchange');
      return NextResponse.redirect(requestUrl.origin + '/auth/login?error=no_user');
    }
    
    console.log('✅ OAuth callback successful, redirecting to dashboard for user:', data.user.email);
    
    // Get state parameter from URL and decode it
    let redirectUrl = requestUrl.origin + '/dashboard';
    const state = requestUrl.searchParams.get('state');
    
    if (state) {
      try {
        // Try to decode and parse the state parameter
        const decodedState = Buffer.from(state, 'base64').toString('utf-8');
        const stateData = JSON.parse(decodedState);
        
        // Extract clientId and returnUrl from state
        if (stateData.returnUrl) {
          redirectUrl = requestUrl.origin + stateData.returnUrl;
          console.log('📋 Using returnUrl from state:', redirectUrl);
        } else if (stateData.clientId) {
          // If we have clientId but no returnUrl, construct the client dashboard URL
          redirectUrl = requestUrl.origin + `/dashboard/client/${stateData.clientId}`;
          console.log('📋 Using clientId from state:', redirectUrl);
        }
      } catch (error) {
        // If decoding fails, log and fall back to /dashboard
        console.error('Failed to decode state parameter:', error);
        console.log('📋 Falling back to /dashboard');
      }
    } else {
      console.log('📋 No state parameter found, using default /dashboard');
    }
    
    // Create a redirect response with the session
    const response = NextResponse.redirect(redirectUrl);
    
    // Return response with proper cookie handling
    return response;
  }

  // No code provided, redirect to login
  return NextResponse.redirect(requestUrl.origin + '/auth/login?error=no_code');
}
