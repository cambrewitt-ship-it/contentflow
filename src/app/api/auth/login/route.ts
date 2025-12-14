import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Server-side login route handler called');
    
    const requestUrl = new URL(request.url);
    const { email, password } = await request.json();
    
    console.log('📧 Login attempt for:', { email });

    // Create Supabase client with proper cookie handling
    // Next.js 15+ requires await for cookies()
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login error:', {
        message: error.message,
        status: error.status,
        email
      });
      
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 401 }
      );
    }

    if (!data.session) {
      console.error('❌ No session created after successful login');
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    console.log('✅ Login successful:', {
      userId: data.user?.id,
      email: data.user?.email,
      hasSession: !!data.session,
      hasAccessToken: !!data.session.access_token,
      hasRefreshToken: !!data.session.refresh_token
    });

    // Verify the session was set by getting it again
    const { data: verifyData } = await supabase.auth.getSession();
    console.log('✅ Session verification:', {
      hasSession: !!verifyData.session,
      sessionMatches: verifyData.session?.access_token === data.session.access_token
    });

    // Get redirect URL from query params or default to dashboard
    const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
    
    // Create response with proper headers
    const response = NextResponse.json(
      { 
        success: true,
        user: {
          id: data.user?.id,
          email: data.user?.email
        },
        redirectTo
      },
      { status: 200 }
    );

    // Note: Cookies are automatically handled by createRouteHandlerClient
    // The Supabase client sets the auth cookies when signInWithPassword succeeds
    
    return response;

  } catch (err) {
    console.error('💥 Unexpected login error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
