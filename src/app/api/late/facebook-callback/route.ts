import { NextRequest, NextResponse } from 'next/server';

// Get the correct app URL - prefer environment variable, but fallback to detecting from request
function getAppUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // If environment URL is ngrok, try to detect the real URL from the request
  if (envUrl && envUrl.includes('ngrok')) {
    console.log('⚠️ Detected ngrok URL in NEXT_PUBLIC_APP_URL, attempting to detect real URL');
    
    // Try to get the host from the request
    const host = req.headers.get('host');
    if (host && !host.includes('ngrok')) {
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const detectedUrl = `${protocol}://${host}`;
      console.log('✅ Detected real URL from request:', detectedUrl);
      return detectedUrl;
    }
  }
  
  // If no environment URL or it's production URL, try to detect localhost from request
  const host = req.headers.get('host');
  if (host && host.includes('localhost')) {
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const detectedUrl = `${protocol}://${host}`;
    console.log('✅ Detected localhost URL from request:', detectedUrl);
    return detectedUrl;
  }
  
  return envUrl || 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  console.log('🚀 Facebook callback route called');
  console.log('🔍 Raw request URL:', req.url);
  console.log('🔍 Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Get the correct app URL
  const appUrl = getAppUrl(req);
  
  try {
    // Handle malformed URLs with multiple ? characters
    let cleanUrl = req.url;
    if (cleanUrl.includes('??') || cleanUrl.split('?').length > 2) {
      console.log('🔧 Detected malformed URL with multiple ? characters:', cleanUrl);
      // Split on first ? and take everything after it, then replace subsequent ? with &
      const [baseUrl, queryString] = cleanUrl.split('?', 2);
      if (queryString) {
        const cleanedQueryString = queryString.replace(/\?/g, '&');
        cleanUrl = `${baseUrl}?${cleanedQueryString}`;
        console.log('✅ Cleaned URL:', cleanUrl);
      }
    }
    
    const { searchParams } = new URL(cleanUrl);
    console.log('📥 Search params received:', Object.fromEntries(searchParams.entries()));
    
    // Extract parameters from Facebook OAuth callback
    const connected = searchParams.get('connected');
    const profileId = searchParams.get('profileId');
    const username = searchParams.get('username');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    let clientId = searchParams.get('clientId');
    
    // Clean up clientId if it has additional data appended (common issue with some OAuth flows)
    if (clientId && clientId.includes('-ct_')) {
      console.log('🔧 Cleaning up malformed clientId:', clientId);
      clientId = clientId.split('-ct_')[0];
      console.log('✅ Cleaned clientId:', clientId);
    }
    
    // Additional debugging for client ID extraction
    console.log('🔍 Client ID extraction debug:', {
      originalClientId: searchParams.get('clientId'),
      cleanedClientId: clientId,
      hasClientId: !!clientId,
      clientIdLength: clientId?.length,
      isValidUUID: clientId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) : false
    });
    
    console.log('🔍 Extracted OAuth parameters:', {
      connected,
      profileId,
      username,
      error,
      errorDescription,
      clientId
    });
    
    // Additional debugging for OAuth errors
    if (error || errorDescription) {
      console.log('🚨 OAuth error detected:', {
        error,
        errorDescription,
        hasError: !!error,
        hasErrorDescription: !!errorDescription,
        rawUrl: req.url,
        cleanedUrl: cleanUrl
      });
    }

    // Validate clientId is present
    if (!clientId) {
      console.log('❌ Missing clientId parameter');
      const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=facebook&error_description=Missing client ID`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle OAuth errors from Facebook
    if (error) {
      console.log('❌ Facebook OAuth error received:', { error, errorDescription });
      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || error)}`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle successful connection
    if (connected === 'true' || connected === '1') {
      console.log('✅ Facebook OAuth successful:', { profileId, username });
      const successRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=success&profileId=${profileId}&username=${encodeURIComponent(username || '')}`;
      return NextResponse.redirect(successRedirectUrl);
    }

    // Handle case where connection status is unclear
    console.log('⚠️ Unclear connection status:', { connected, profileId, username });
    const warningRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=warning&message=${encodeURIComponent('Connection status unclear')}`;
    return NextResponse.redirect(warningRedirectUrl);

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
      ? `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`
      : `${appUrl}/dashboard?oauth_error=facebook&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
