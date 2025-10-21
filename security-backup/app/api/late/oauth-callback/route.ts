// app/api/late/oauth-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
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
    
    // Extract parameters from URL
    const success = searchParams.get('success');
    const platform = searchParams.get('platform');
    const profileId = searchParams.get('profileId');
    const username = searchParams.get('username');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    let clientId = searchParams.get('clientId');
    
    // Clean up clientId if it has additional data appended (common issue with some OAuth flows)
    if (clientId && clientId.includes('-ct_')) {

      clientId = clientId.split('-ct_')[0];

    }
    
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

          }
        } catch (err) {

        }
      }
    }

    // Handle OAuth errors
    if (error) {

      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform || 'unknown'}&error_description=${encodeURIComponent(errorDescription || error)}`
        : `${appUrl}/dashboard?oauth_error=${platform || 'unknown'}&error_description=${encodeURIComponent(errorDescription || error)}`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Validate required parameters
    if (!success || !platform || !profileId) {

      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform || 'unknown'}&error_description=Missing required OAuth parameters`
        : `${appUrl}/dashboard?oauth_error=${platform || 'unknown'}&error_description=Missing required OAuth parameters`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Check environment variables
    if (!supabaseUrl || !supabaseServiceRoleKey) {

      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Configuration error: Missing database credentials`
        : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Configuration error: Missing database credentials`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if a connection already exists for this client and platform
    const { data: existingConnection, error: checkError } = await supabase
      .from('social_connections')
      .select('id, platform_user_id, username, connected_at, status')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('❌ Error checking existing connection:', checkError);
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Database query failed`
        : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Database query failed`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    let connectionResult;
    
    if (existingConnection) {
      // Update existing connection

      const { data: updatedConnection, error: updateError } = await supabase
        .from('social_connections')
        .update({
          platform_user_id: profileId,
          username: username || existingConnection.username,
          profile_id: profileId,
          connected_at: new Date().toISOString(),
          status: 'connected',
          last_sync: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (updateError) {
        logger.error('❌ Error updating connection:', updateError);
        const errorRedirectUrl = clientId 
          ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Failed to update connection`
          : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Failed to update connection`;
        
        return NextResponse.redirect(errorRedirectUrl);
      }

      connectionResult = updatedConnection;

    } else {
      // Create new connection

      const { data: newConnection, error: insertError } = await supabase
        .from('social_connections')
        .insert({
          client_id: clientId,
          platform: platform,
          platform_user_id: profileId,
          username: username || 'Unknown',
          profile_id: profileId,
          connected_at: new Date().toISOString(),
          status: 'connected',
          last_sync: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        logger.error('❌ Error creating connection:', insertError);
        const errorRedirectUrl = clientId 
          ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Failed to create connection`
          : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Failed to create connection`;
        
        return NextResponse.redirect(errorRedirectUrl);
      }

      connectionResult = newConnection;

    }

    // Redirect back to client dashboard with success message
    if (clientId) {
      const successRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=${platform}${username ? `&username=${encodeURIComponent(username)}` : ''}`;

      return NextResponse.redirect(successRedirectUrl);
    } else {
      // Fallback to general dashboard if no clientId
      const fallbackRedirectUrl = `${appUrl}/dashboard?oauth_success=${platform}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
      logger.debug('Redirecting to general dashboard (fallback)', { platform });
      return NextResponse.redirect(fallbackRedirectUrl);
    }

  } catch (error: unknown) {
    logger.error('💥 Error in OAuth callback route:', error);
    logger.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Try to extract clientId from the error context for better error handling
    let clientId = '';
    let platform = 'unknown';
    try {
      const { searchParams } = new URL(req.url);
      clientId = searchParams.get('clientId') || '';
      platform = searchParams.get('platform') || 'unknown';
    } catch (e) {

    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Unexpected error during OAuth`
      : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Unexpected error during OAuth`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
