import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  console.log('🚀 Facebook callback route called');
  
  try {
    const { searchParams } = new URL(req.url);
    console.log('📥 Search params received:', Object.fromEntries(searchParams.entries()));
    
    // Extract parameters from URL
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const profileId = searchParams.get('profileId');
    let clientId = searchParams.get('clientId');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    // If clientId is not in query params, try to extract it from the redirect_url
    if (!clientId) {
      const redirectUrl = searchParams.get('redirect_url');
      if (redirectUrl) {
        try {
          const redirectUrlObj = new URL(redirectUrl);
          const pathParts = redirectUrlObj.pathname.split('/');
          const clientIdIndex = pathParts.indexOf('client');
          if (clientIdIndex !== -1 && pathParts[clientIdIndex + 1]) {
            clientId = pathParts[clientIdIndex + 1];
            console.log('🔍 Extracted clientId from redirect_url:', clientId);
          }
        } catch (err) {
          console.log('Could not parse redirect_url for clientId extraction');
        }
      }
    }
    
    console.log('🔍 Extracted parameters:', {
      success,
      error,
      errorDescription,
      profileId,
      clientId,
      hasCode: !!code,
      hasState: !!state
    });

    // Handle OAuth errors
    if (error) {
      console.log('❌ OAuth error received:', { error, errorDescription });
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=${encodeURIComponent(errorDescription || error)}`
        : `${appUrl}/dashboard?oauth_error=facebook&error_description=${encodeURIComponent(errorDescription || error)}`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Validate required parameters
    if (!success || !profileId || !clientId || !code) {
      console.log('❌ Missing required parameters');
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=Missing required OAuth parameters`
        : `${appUrl}/dashboard?oauth_error=facebook&error_description=Missing required OAuth parameters`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Check environment variables
    if (!lateApiKey) {
      console.log('❌ LATE_API_KEY is missing');
      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=Configuration error: LATE_API_KEY not set`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    console.log('✅ OAuth parameters validated, proceeding to fetch Facebook pages');

    // Fetch available Facebook pages from LATE API
    console.log('🌐 Fetching Facebook pages from LATE API for profileId:', profileId);
    const pagesResponse = await fetch(`https://getlate.dev/api/v1/facebook/pages?profileId=${profileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`
      }
    });

    console.log('📡 LATE API pages response:', {
      status: pagesResponse.status,
      statusText: pagesResponse.statusText
    });

    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('❌ LATE API pages error:', {
        status: pagesResponse.status,
        body: errorText
      });
      
      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=Failed to fetch Facebook pages: ${pagesResponse.status}`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    const pagesData = await pagesResponse.json();
    console.log('✅ Facebook pages received:', pagesData);

    // Extract available pages
    const availablePages = pagesData.pages || pagesData.data || [];
    
    if (!Array.isArray(availablePages) || availablePages.length === 0) {
      console.log('❌ No Facebook pages available');
      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=No Facebook pages available for this account`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    console.log('📋 Available Facebook pages:', availablePages);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=facebook&error_description=Client not found`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    console.log('✅ Client found:', client);

    // Generate a unique session ID for this page selection
    const sessionId = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the page selection data temporarily (you might want to use a proper session store or database)
    // For now, we'll pass it via URL parameters to the page selection interface
    
    // Build the page selection URL with all necessary data
    const pageSelectionUrl = `${appUrl}/dashboard/client/${clientId}/facebook-page-selection?` + 
      `sessionId=${sessionId}` +
      `&profileId=${profileId}` +
      `&clientId=${clientId}` +
      `&clientName=${encodeURIComponent(client.name)}` +
      `&pages=${encodeURIComponent(JSON.stringify(availablePages))}` +
      `&code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state || '')}`;

    console.log('🔗 Redirecting to page selection interface:', pageSelectionUrl);
    
    return NextResponse.redirect(pageSelectionUrl);

  } catch (error: unknown) {
    console.error('💥 Error in Facebook callback route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Try to extract clientId from the error context for better error handling
    let clientId = '';
    try {
      const { searchParams } = new URL(req.url);
      clientId = searchParams.get('clientId') || '';
    } catch (e) {
      console.log('Could not extract clientId from URL for error redirect');
    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?oauth_error=facebook&error_description=Unexpected error during Facebook OAuth`
      : `${appUrl}/dashboard?oauth_error=facebook&error_description=Unexpected error during Facebook OAuth`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
