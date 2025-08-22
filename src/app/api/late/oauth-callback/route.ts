// app/api/late/oauth-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    console.log('🔄 OAuth callback received with params:', Object.fromEntries(searchParams.entries()));
    
    // Extract parameters from LATE callback
    const success = searchParams.get('success');
    const platform = searchParams.get('platform');
    const profileId = searchParams.get('profileId');
    const username = searchParams.get('username');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const clientId = searchParams.get('clientId'); // We'll need to pass this in the redirect_url
    
    // Log the callback details
    console.log('📱 OAuth Callback Details:', {
      success,
      platform,
      profileId,
      username,
      error,
      errorDescription,
      clientId
    });
    
    if (error) {
      console.error('❌ OAuth error received:', { error, errorDescription });
      
      // Redirect back to client dashboard with error
      const redirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || 'Authentication failed')}`
        : `${appUrl}/dashboard?oauth_error=${encodeURIComponent(error)}`;
      
      return NextResponse.redirect(redirectUrl);
    }
    
    if (!success || !platform || !profileId) {
      console.error('❌ Missing required OAuth parameters:', { success, platform, profileId });
      
      const redirectUrl = clientId 
        ? `${appUrl}/dashboard/client/${clientId}?oauth_error=missing_parameters&error_description=Incomplete OAuth response`
        : `${appUrl}/dashboard?oauth_error=missing_parameters`;
      
      return NextResponse.redirect(redirectUrl);
    }
    
    // Extract clientId from the redirect_url if not provided directly
    let extractedClientId = clientId;
    if (!extractedClientId) {
      const redirectUrl = searchParams.get('redirect_url');
      if (redirectUrl) {
        const match = redirectUrl.match(/\/dashboard\/client\/([^\/]+)/);
        if (match) {
          extractedClientId = match[1];
          console.log('🔍 Extracted clientId from redirect_url:', extractedClientId);
        }
      }
    }
    
    if (!extractedClientId) {
      console.error('❌ Could not determine clientId for OAuth callback');
      return NextResponse.redirect(`${appUrl}/dashboard?oauth_error=client_not_found`);
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Check if this connection already exists
    console.log('🔍 Checking for existing connection:', { platform, profileId, extractedClientId });
    const { data: existingConnection, error: checkError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('client_id', extractedClientId)
      .eq('platform', platform)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing connection:', checkError);
    }
    
    if (existingConnection) {
      console.log('🔄 Updating existing connection:', existingConnection.id);
      
      // Update existing connection
      const { error: updateError } = await supabase
        .from('social_connections')
        .update({
          username: username || existingConnection.username,
          profile_id: profileId,
          connected_at: new Date().toISOString(),
          status: 'connected',
          last_sync: new Date().toISOString()
        })
        .eq('id', existingConnection.id);
      
      if (updateError) {
        console.error('❌ Error updating existing connection:', updateError);
      } else {
        console.log('✅ Existing connection updated successfully');
      }
    } else {
      console.log('🆕 Creating new social connection');
      
      // Create new social connection record
      const { data: newConnection, error: insertError } = await supabase
        .from('social_connections')
        .insert({
          client_id: extractedClientId,
          platform: platform,
          username: username,
          profile_id: profileId,
          connected_at: new Date().toISOString(),
          status: 'connected',
          created_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Error creating new connection:', insertError);
      } else {
        console.log('✅ New social connection created:', newConnection.id);
      }
    }
    
    // Log successful connection
    console.log('🎉 OAuth connection successful:', {
      platform,
      profileId,
      username,
      clientId: extractedClientId
    });
    
    // Redirect back to client dashboard with success message
    const successRedirectUrl = `${appUrl}/dashboard/client/${extractedClientId}?oauth_success=${encodeURIComponent(platform)}&username=${encodeURIComponent(username || '')}`;
    
    return NextResponse.redirect(successRedirectUrl);
    
  } catch (error: unknown) {
    console.error('💥 Error in OAuth callback route:', error);
    
    // Redirect to dashboard with generic error
    const errorRedirectUrl = `${appUrl}/dashboard?oauth_error=callback_failed&error_description=${encodeURIComponent('OAuth callback processing failed')}`;
    
    return NextResponse.redirect(errorRedirectUrl);
  }
}
