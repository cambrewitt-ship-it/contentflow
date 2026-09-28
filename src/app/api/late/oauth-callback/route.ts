// app/api/late/oauth-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getRequestAppUrl } from '@/lib/requestAppUrl';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { markOnboardingStep } from '@/lib/onboardingHelpers';

export async function GET(req: NextRequest) {
  // Get the correct app URL
  const appUrl = getRequestAppUrl(req);
  
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
    const source = searchParams.get('source');
    
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

    // Validate client ownership before performing database operations
    if (!clientId) {
      const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=${platform || 'unknown'}&error_description=Missing client identifier`;
      return NextResponse.redirect(errorRedirectUrl);
    }

    // This route is hit by a browser redirect from LATE, so there is no Bearer header —
    // authenticate from the session cookie instead. The account is already connected in
    // LATE either way, so a missing session must not turn into an error or a logout.
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (client) {
        // Upsert the connection in a single round trip (insert or update on conflict)
        const now = new Date().toISOString();
        const { error: upsertError } = await supabase
          .from('social_connections')
          .upsert({
            client_id: clientId,
            platform: platform,
            platform_user_id: profileId,
            username: username || 'Unknown',
            profile_id: profileId,
            connected_at: now,
            status: 'connected',
            last_sync: now
          }, { onConflict: 'client_id,platform' });

        if (upsertError) {
          logger.error('❌ Error upserting connection:', upsertError);
        }

        // Mark onboarding: first social account connected
        await markOnboardingStep(supabase, user.id, 'checklist_connect_social');
      }
    } else {
      logger.warn('OAuth callback without a session cookie; skipping connection record', { platform });
    }

    // Redirect back to client dashboard (or onboarding step) with success message
    if (clientId) {
      const basePath = source === 'onboarding'
        ? `${appUrl}/dashboard/client/${clientId}/connect-platforms`
        : `${appUrl}/dashboard/client/${clientId}`;
      const successRedirectUrl = `${basePath}?connected=${platform}&status=success${username ? `&username=${encodeURIComponent(username)}` : ''}`;

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
      // Do nothing (fallback to default values)
    }
    
    const errorRedirectUrl = clientId 
      ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${platform}&error_description=Unexpected error during OAuth`
      : `${appUrl}/dashboard?oauth_error=${platform}&error_description=Unexpected error during OAuth`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
