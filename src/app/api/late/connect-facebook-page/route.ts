import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  console.log('🚀 Connect Facebook page API route called');
  
  try {
    // Parse request body
    const body = await req.json();
    console.log('📥 Request body received:', body);
    
    const { clientId, profileId, pageId, pageName, code, state } = body;
    console.log('🔍 Extracted parameters:', { clientId, profileId, pageId, pageName, hasCode: !!code, hasState: !!state });

    // Validate required fields
    if (!clientId || !profileId || !pageId || !pageName) {
      console.log('❌ Missing required fields:', { clientId, profileId, pageId, pageName });
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'clientId, profileId, pageId, and pageName are required'
      }, { status: 400 });
    }

    // Check environment variables
    if (!lateApiKey) {
      console.log('❌ LATE_API_KEY is missing');
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'LATE_API_KEY environment variable is not set'
      }, { status: 500 });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return NextResponse.json({ 
        error: 'Client not found',
        details: `No client found with ID: ${clientId}`
      }, { status: 404 });
    }

    console.log('✅ Client verified:', client);

    // Call LATE API to finalize the Facebook page connection
    console.log('🌐 Finalizing Facebook page connection with LATE API');
    const lateApiUrl = `https://getlate.dev/api/v1/facebook/connect-page`;
    
    const lateApiBody = {
      profileId: profileId,
      pageId: pageId,
      pageName: pageName,
      code: code,
      state: state,
      clientId: clientId
    };
    
    console.log('🌐 Calling LATE API to connect page:', {
      url: lateApiUrl,
      method: 'POST',
      body: lateApiBody
    });
    
    const lateResponse = await fetch(lateApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lateApiKey}`
      },
      body: JSON.stringify(lateApiBody)
    });

    console.log('📡 LATE API response received:', {
      status: lateResponse.status,
      statusText: lateResponse.statusText
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      console.error('❌ LATE API error response:', {
        status: lateResponse.status,
        statusText: lateResponse.statusText,
        body: errorText
      });
      
      return NextResponse.json({ 
        error: 'LATE API request failed',
        details: `Status: ${lateResponse.status}, Response: ${errorText}`
      }, { status: 500 });
    }

    const lateData = await lateResponse.json();
    console.log('✅ LATE API page connection successful:', lateData);

    // Extract connection details from LATE response
    const connectionData = {
      platform: 'facebook',
      platform_user_id: pageId,
      username: pageName,
      profile_id: profileId,
      access_token: lateData.access_token || null,
      page_access_token: lateData.page_access_token || null,
      expires_at: lateData.expires_at || null,
      permissions: lateData.permissions || [],
      page_category: lateData.page_category || null,
      page_verification_status: lateData.page_verification_status || null
    };

    console.log('🔗 Connection data to save:', connectionData);

    // Check if a connection already exists for this client and platform
    const { data: existingConnection, error: checkError } = await supabase
      .from('social_connections')
      .select('id, platform_user_id, username, connected_at, status')
      .eq('client_id', clientId)
      .eq('platform', 'facebook')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing connection:', checkError);
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: checkError.message 
      }, { status: 500 });
    }

    let connectionResult;
    
    if (existingConnection) {
      // Update existing connection
      console.log('🔄 Updating existing Facebook connection:', existingConnection);
      
      const { data: updatedConnection, error: updateError } = await supabase
        .from('social_connections')
        .update({
          platform_user_id: connectionData.platform_user_id,
          username: connectionData.username,
          profile_id: connectionData.profile_id,
          access_token: connectionData.access_token,
          page_access_token: connectionData.page_access_token,
          expires_at: connectionData.expires_at,
          permissions: connectionData.permissions,
          page_category: connectionData.page_category,
          page_verification_status: connectionData.page_verification_status,
          connected_at: new Date().toISOString(),
          status: 'connected',
          last_sync: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating connection:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update connection', 
          details: updateError.message 
        }, { status: 500 });
      }

      connectionResult = updatedConnection;
      console.log('✅ Facebook connection updated successfully');
      
    } else {
      // Create new connection
      console.log('🆕 Creating new Facebook connection');
      
      const { data: newConnection, error: insertError } = await supabase
        .from('social_connections')
        .insert({
          client_id: clientId,
          platform: 'facebook',
          platform_user_id: connectionData.platform_user_id,
          username: connectionData.username,
          profile_id: connectionData.profile_id,
          access_token: connectionData.access_token,
          page_access_token: connectionData.page_access_token,
          expires_at: connectionData.expires_at,
          permissions: connectionData.permissions,
          page_category: connectionData.page_category,
          page_verification_status: connectionData.page_verification_status,
          connected_at: new Date().toISOString(),
          status: 'connected',
          last_sync: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating connection:', insertError);
        return NextResponse.json({ 
          error: 'Failed to create connection', 
          details: insertError.message 
        }, { status: 500 });
      }

      connectionResult = newConnection;
      console.log('✅ Facebook connection created successfully');
    }

    const responseData = {
      success: true,
      message: 'Facebook page connected successfully',
      connection: {
        id: connectionResult.id,
        platform: 'facebook',
        pageId: pageId,
        pageName: pageName,
        connectedAt: connectionResult.connected_at,
        status: connectionResult.status
      }
    };
    
    console.log('📤 Returning success response:', responseData);
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    console.error('💥 Error in connect-facebook-page route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Request body must be valid JSON'
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
