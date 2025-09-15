// app/api/late/oauth-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
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
      console.log('🔧 Cleaning up malformed clientId:', clientId);
      clientId = clientId.split('-ct_')[0];
      console.log('✅ Cleaned clientId:', clientId);
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
            console.log('🔍 Extracted clientId from redirect_url:', clientId);
          }
        } catch (err) {
          console.log('Could not parse redirect_url for clientId extraction');
        }
      }
    }
    
    console.log('📥 OAuth callback parameters:', {
      success,
      platform,
      profileId,
      username,
      error,
      errorDescription,
      clientId
    });

    // Handle OAuth errors
    if (error) {
      console.log('❌ OAuth error received:', { error, errorDescription });
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform || 'unknown'}&error_description=${encodeURIComponent(errorDescription || error)}`
        : `${appUrl}/dashboard?oauth_error=${platform || 'unknown'}&error_description=${encodeURIComponent(errorDescription || error)}`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Validate required parameters
    if (!success || !platform || !profileId) {
      console.log('❌ Missing required OAuth parameters');
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform || 'unknown'}&error_description=Missing required OAuth parameters`
        : `${appUrl}/dashboard?oauth_error=${platform || 'unknown'}&error_description=Missing required OAuth parameters`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    // Check environment variables
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.log('❌ Missing Supabase environment variables');
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Configuration error: Missing database credentials`
        : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Configuration error: Missing database credentials`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    console.log('✅ OAuth parameters validated, proceeding to update database');

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
      console.error('❌ Error checking existing connection:', checkError);
      const errorRedirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Database query failed`
        : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Database query failed`;
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    let connectionResult;
    
    if (existingConnection) {
      // Update existing connection
      console.log('🔄 Updating existing connection:', existingConnection);
      
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
        console.error('❌ Error updating connection:', updateError);
        const errorRedirectUrl = clientId 
          ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Failed to update connection`
          : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Failed to update connection`;
        
        return NextResponse.redirect(errorRedirectUrl);
      }

      connectionResult = updatedConnection;
      console.log('✅ Connection updated successfully');
      
    } else {
      // Create new connection
      console.log('🆕 Creating new connection');
      
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
        console.error('❌ Error creating connection:', insertError);
        const errorRedirectUrl = clientId 
          ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Failed to create connection`
          : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Failed to create connection`;
        
        return NextResponse.redirect(errorRedirectUrl);
      }

      connectionResult = newConnection;
      console.log('✅ Connection created successfully');
    }

    console.log('✅ Connection result:', connectionResult);

    // Redirect back to client dashboard with success message
    if (clientId) {
      const successRedirectUrl = `${appUrl}/dashboard/client/${clientId}?connected=${platform}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
      console.log('🔗 Redirecting to client dashboard:', successRedirectUrl);
      return NextResponse.redirect(successRedirectUrl);
    } else {
      // Fallback to general dashboard if no clientId
      const fallbackRedirectUrl = `${appUrl}/dashboard?oauth_success=${platform}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
      console.log('🔗 Redirecting to general dashboard (fallback):', fallbackRedirectUrl);
      return NextResponse.redirect(fallbackRedirectUrl);
    }

  } catch (error: unknown) {
    console.error('💥 Error in OAuth callback route:', error);
    console.error('💥 Error details:', {
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
      console.log('Could not extract clientId from URL for error redirect');
    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Unexpected error during OAuth`
      : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Unexpected error during OAuth`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
