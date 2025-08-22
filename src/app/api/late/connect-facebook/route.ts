import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  console.log('🚀 Connect Facebook API route called');
  
  try {
    // Parse request body
    const body = await req.json();
    console.log('📥 Request body received:', body);
    
    const { clientId } = body;
    console.log('🔍 Extracted clientId:', clientId);

    // Validate required fields
    if (!clientId) {
      console.log('❌ Missing required field:', { clientId });
      return NextResponse.json({ 
        error: 'Missing required field',
        details: 'clientId is required'
      }, { status: 400 });
    }

    // Check environment variables
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceRole: !!supabaseServiceRoleKey,
      hasLateApiKey: !!lateApiKey,
      hasAppUrl: !!appUrl
    });

    if (!lateApiKey) {
      console.log('❌ LATE_API_KEY is missing');
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'LATE_API_KEY environment variable is not set'
      }, { status: 500 });
    }

    // Create Supabase client
    console.log('🔌 Creating Supabase client with URL:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch client data to get late_profile_id
    console.log('🔍 Fetching client data for ID:', clientId);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, late_profile_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('❌ Supabase client query error:', clientError);
      
      if (clientError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Client not found',
          details: `No client found with ID: ${clientId}`
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: clientError.message 
      }, { status: 500 });
    }

    console.log('✅ Client data found:', client);

    if (!client.late_profile_id) {
      console.log('❌ Client missing late_profile_id:', client);
      return NextResponse.json({ 
        error: 'LATE profile not found',
        details: `Client ${client.name} does not have a LATE profile ID`
      }, { status: 404 });
    }

    const profileId = client.late_profile_id;
    console.log('✅ Client found with profileId:', { 
      clientId: client.id, 
      clientName: client.name, 
      profileId: profileId 
    });

    // Build Facebook-specific callback URL
    const callbackUrl = `${appUrl}/api/late/facebook-callback`;
    console.log('🔗 Facebook callback URL built:', callbackUrl);
    
    // Prepare LATE API request - using GET with query parameters
    const lateApiUrl = `https://getlate.dev/api/v1/connect/facebook?profileId=${profileId}&redirect_url=${encodeURIComponent(callbackUrl)}`;
    
    console.log('🌐 About to call LATE API for Facebook:', {
      url: lateApiUrl,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey.substring(0, 10)}...` // Log partial key for security
      },
      queryParams: {
        profileId: profileId,
        redirect_url: callbackUrl
      }
    });
    
    // Call LATE API to get the Facebook auth URL - using GET method
    console.log('🌐 Calling LATE API for Facebook platform');
    const lateResponse = await fetch(lateApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`
      }
    });

    console.log('📡 LATE API response received:', {
      status: lateResponse.status,
      statusText: lateResponse.statusText,
      headers: Object.fromEntries(lateResponse.headers.entries())
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
    console.log('✅ LATE API response data for Facebook:', lateData);

    // Extract the authUrl from LATE response
    const authUrl = lateData.authUrl || lateData.url || lateData.connectUrl;
    console.log('🔍 Extracted Facebook authUrl from response:', {
      authUrl: authUrl,
      availableKeys: Object.keys(lateData),
      authUrlFound: !!authUrl
    });
    
    if (!authUrl) {
      console.error('❌ No authUrl found in LATE response:', {
        response: lateData,
        checkedKeys: ['authUrl', 'url', 'connectUrl']
      });
      return NextResponse.json({ 
        error: 'LATE API response missing authUrl',
        details: 'The LATE API did not return a valid Facebook authentication URL'
      }, { status: 500 });
    }

    console.log('🔗 Successfully extracted Facebook authUrl from LATE:', authUrl);

    const responseData = { 
      success: true,
      connectUrl: authUrl,
      platform: 'facebook',
      clientId: clientId,
      lateProfileId: profileId,
      notes: 'Facebook requires page selection after OAuth. User will be redirected to page selection flow after authentication.'
    };
    
    console.log('📤 Returning Facebook success response:', responseData);
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    console.error('💥 Error in connect-facebook route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      cause: error instanceof Error ? error.cause : 'No cause'
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
