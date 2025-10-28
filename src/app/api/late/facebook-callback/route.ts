import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// Get the correct app URL - prefer environment variable, but fallback to detecting from request
function getAppUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get('host');
  
  // PRIORITY 1: Check for localhost FIRST (before checking env URL)
  // This prevents production URL from overriding localhost development
  if (host && host.includes('localhost')) {
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const detectedUrl = `${protocol}://${host}`;
    return detectedUrl;
  }
  
  // PRIORITY 2: Check if host is vercel
  if (host && (host.includes('vercel.app') || host.includes('contentflow'))) {
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const detectedUrl = `${protocol}://${host}`;
    return detectedUrl;
  }

  // PRIORITY 3: Check environment URL (for ngrok or other special cases)
  if (envUrl && envUrl.includes('ngrok')) {
    // Try to detect the real URL from the request
    if (host && !host.includes('ngrok')) {
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const detectedUrl = `${protocol}://${host}`;
      return detectedUrl;
    }
  }
  
  // PRIORITY 4: Use environment URL if it exists and it's not ngrok
  if (envUrl && !envUrl.includes('ngrok')) {
    return envUrl;
  }
  
  // Fallback
  return envUrl || 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  logger.debug('Facebook callback request received');
  // Get the correct app URL
  const appUrl = getAppUrl(req);

  try {
    // Handle malformed URLs with multiple ? characters
    let cleanUrl = req.url;
    if (cleanUrl.includes('??') || cleanUrl.split('?').length > 2) {
      // Split on first ? and take everything after it, then replace subsequent ? with &
      const [baseUrl, queryString] = cleanUrl.split('?', 2);
      if (queryString) {
        const cleanedQueryString = queryString.replace(/\?/g, '&');
        cleanUrl = `${baseUrl}?${cleanedQueryString}`;
      }
    }
    
    const { searchParams } = new URL(cleanUrl);

    // Log all incoming parameters for debugging
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    logger.debug('Facebook callback - all incoming parameters', allParams);

    // Extract parameters
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    let clientId = searchParams.get('clientId');
    const connected = searchParams.get('connected');
    const profileId = searchParams.get('profileId');
    const username = searchParams.get('username');

    // Clean up clientId if it has additional data appended (common issue with some OAuth flows)
    if (clientId && clientId.includes('-ct_')) {
      clientId = clientId.split('-ct_')[0];
    }

    // Additional debugging for client ID extraction and OAuth callback parameters
    logger.debug('Facebook OAuth callback parameters', {
      hasClientId: !!clientId,
      clientId,
      error,
      errorDescription,
      connected,
      profileId,
      username,
      hasError: !!error,
      isValidUUID: clientId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) : false
    });

    // Validate clientId is present
    if (!clientId) {
      const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=facebook&error_description=Missing client ID`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle OAuth errors from Facebook
    if (error) {
      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || error)}`;
      logger.debug('Facebook OAuth error - redirecting with error', { error, errorDescription });
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle successful connection - check for various success indicators
    // LATE API sends connected=facebook OR connected=true OR connected=1
    const isSuccess = connected === 'true' || connected === '1' || connected === 'facebook' || profileId;
    
    if (isSuccess) {
      const successRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=success&profileId=${profileId || ''}&username=${encodeURIComponent(username || '')}`;
      logger.debug('Facebook OAuth success - redirecting with success', { profileId, username });
      return NextResponse.redirect(successRedirectUrl);
    }

    // Handle case where connection status is unclear
    logger.warn('Facebook OAuth status unclear - redirecting with warning', { 
      connected, 
      profileId, 
      hasError: !!error 
    });
    const warningRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=warning&message=${encodeURIComponent('Connection status unclear')}`;
    return NextResponse.redirect(warningRedirectUrl);

  } catch (error: unknown) {
    logger.error('💥 Error in Facebook callback route:', error);
    logger.error('💥 Error details:', {
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
      // silent
    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`
      : `${appUrl}/dashboard?oauth_error=facebook&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
