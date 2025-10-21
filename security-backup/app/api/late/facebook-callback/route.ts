import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// Get the correct app URL - prefer environment variable, but fallback to detecting from request
function getAppUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // If environment URL is ngrok, try to detect the real URL from the request
  if (envUrl && envUrl.includes('ngrok')) {

    // Try to get the host from the request
    const host = req.headers.get('host');
    if (host && !host.includes('ngrok')) {
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const detectedUrl = `${protocol}://${host}`;

      return detectedUrl;
    }
  }
  
  // If no environment URL or it's production URL, try to detect localhost from request
  const host = req.headers.get('host');
  if (host && host.includes('localhost')) {
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const detectedUrl = `${protocol}://${host}`;

    return detectedUrl;
  }
  
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
    logger.debug('Facebook callback params', { 
      paramsCount: Array.from(searchParams.entries()).length 
    });
    
    // Extract parameters from Facebook OAuth callback
    const connected = searchParams.get('connected');
    const profileId = searchParams.get('profileId');
    const username = searchParams.get('username');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    let clientId = searchParams.get('clientId');
    
    // Clean up clientId if it has additional data appended (common issue with some OAuth flows)
    if (clientId && clientId.includes('-ct_')) {

      clientId = clientId.split('-ct_')[0];

    }
    
    // Additional debugging for client ID extraction
    logger.debug('Client ID validation', {
      hasClientId: !!clientId,
      clientIdLength: clientId?.length,
      isValidUUID: clientId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) : false
    });

    // Additional debugging for OAuth errors
    if (error || errorDescription) {

    }

    // Validate clientId is present
    if (!clientId) {

      const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=facebook&error_description=Missing client ID`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle OAuth errors from Facebook
    if (error) {

      const errorRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || error)}`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Handle successful connection
    if (connected === 'true' || connected === '1') {

      const successRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=success&profileId=${profileId}&username=${encodeURIComponent(username || '')}`;
      return NextResponse.redirect(successRedirectUrl);
    }

    // Handle case where connection status is unclear

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

    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?connected=facebook&status=error&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`
      : `${appUrl}/dashboard?oauth_error=facebook&error_description=${encodeURIComponent('Unexpected error during Facebook OAuth')}`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
