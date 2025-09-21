import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://contentflow-v2.vercel.app';

// Function to create LATE profile for existing client
async function createLateProfileForExistingClient(client: { id: string; name: string }) {
  try {
    console.log('🚀 Creating LATE profile for existing client:', client.name);
    
    // Fetch full client data to get brand information
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: fullClient, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client.id)
      .single();
      
    if (clientError || !fullClient) {
      throw new Error(`Failed to fetch client data: ${clientError?.message || 'Client not found'}`);
    }
    
    console.log('📋 Using brand information from client:', {
      name: fullClient.name,
      company_description: fullClient.company_description,
      brand_tone: fullClient.brand_tone,
      target_audience: fullClient.target_audience,
      value_proposition: fullClient.value_proposition,
      website_url: fullClient.website_url
    });
    
    // Build a comprehensive description using brand information
    let description = `Social media profile for ${fullClient.name}`;
    
    if (fullClient.company_description) {
      description += `\n\nAbout: ${fullClient.company_description}`;
    }
    
    if (fullClient.value_proposition) {
      description += `\n\nValue Proposition: ${fullClient.value_proposition}`;
    }
    
    if (fullClient.target_audience) {
      description += `\n\nTarget Audience: ${fullClient.target_audience}`;
    }
    
    if (fullClient.brand_tone) {
      description += `\n\nBrand Tone: ${fullClient.brand_tone}`;
    }
    
    if (fullClient.website_url) {
      description += `\n\nWebsite: ${fullClient.website_url}`;
    }

    const requestBody = {
      name: fullClient.name,
      description: description,
      color: "#4ade80" // Default green color
    };

    console.log('📤 LATE API request body:', requestBody);
    console.log('🌐 LATE API URL: https://getlate.dev/api/v1/profiles');
    console.log('🔑 LATE API Key available:', !!lateApiKey);
    console.log('🔑 LATE API Key length:', lateApiKey?.length || 0);
    console.log('🔑 LATE API Key preview:', lateApiKey?.substring(0, 10) + '...');

    const response = await fetch('https://getlate.dev/api/v1/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 LATE API response status:', response.status);
    console.log('📡 LATE API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LATE API error response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });
      throw new Error(`LATE API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ LATE profile created successfully:', data);
    console.log('🔍 LATE API response structure analysis:', {
      hasId: !!data._id,
      hasProfile: !!data.profile,
      hasProfileId: !!data.profile?._id,
      allKeys: Object.keys(data),
      dataType: typeof data,
      isArray: Array.isArray(data)
    });
    
    // Handle the nested response structure - try multiple possible locations
    const profileId = data._id || data.profile?._id || data.id || data.profileId;
    console.log('✅ LATE profile ID extracted:', profileId);
    console.log('🔍 Profile ID extraction attempt:', {
      dataId: data._id,
      dataProfileId: data.profile?._id,
      dataIdField: data.id,
      dataProfileIdField: data.profileId,
      finalProfileId: profileId
    });

    if (!profileId) {
      console.error('❌ LATE API response structure:', JSON.stringify(data, null, 2));
      console.error('❌ Available keys in response:', Object.keys(data));
      throw new Error(`LATE API response missing profile ID field. Available keys: ${Object.keys(data).join(', ')}`);
    }

    return profileId;
  } catch (error) {
    console.error('❌ Error creating LATE profile for existing client:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  console.log('🚀 Connect platform API route called');
  
  try {
    // Parse request body
    const body = await req.json();
    console.log('📥 Request body received:', body);
    
    const { platform, clientId } = body;
    console.log('🔍 Extracted parameters:', { platform, clientId });
    
    // Validate required fields
    if (!platform || !clientId) {
      console.log('❌ Missing required fields:', { platform, clientId });
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'platform and clientId are required'
      }, { status: 400 });
    }

    // Validate platform
    const validPlatforms = ['instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'threads'];
    if (!validPlatforms.includes(platform)) {
      console.log('❌ Invalid platform:', platform);
      return NextResponse.json({ 
        error: 'Invalid platform',
        details: `Platform must be one of: ${validPlatforms.join(', ')}`
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
      console.log('❌ Client missing late_profile_id, attempting to create one:', client);
      
      try {
        // Create LATE profile for existing client
        const lateProfileId = await createLateProfileForExistingClient(client);
        console.log('✅ Created LATE profile for existing client:', lateProfileId);
        
        // Update client with new LATE profile ID
        const { error: updateError } = await supabase
          .from('clients')
          .update({ late_profile_id: lateProfileId })
          .eq('id', clientId);
          
        if (updateError) {
          console.error('❌ Failed to update client with LATE profile ID:', updateError);
          return NextResponse.json({ 
            error: 'Failed to link LATE profile',
            details: 'Could not update client with new LATE profile ID'
          }, { status: 500 });
        }
        
        console.log('✅ Client updated with LATE profile ID:', lateProfileId);
        client.late_profile_id = lateProfileId; // Update local client object
        
      } catch (lateError) {
        console.error('❌ Failed to create LATE profile for existing client:', lateError);
        return NextResponse.json({ 
          error: 'LATE profile creation failed',
          details: `Could not create LATE profile for client ${client.name}: ${lateError instanceof Error ? lateError.message : String(lateError)}`
        }, { status: 500 });
      }
    }

    const profileId = client.late_profile_id;
    console.log('✅ Client found with profileId:', { 
      clientId: client.id, 
      clientName: client.name, 
      profileId: profileId 
    });

    // Build the callback URL for OAuth completion - use proper environment detection
    const getAppUrl = (req: NextRequest): string => {
      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
      const host = req.headers.get('host');
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      
      console.log('🔍 URL Detection Debug:', {
        envUrl,
        host,
        protocol,
        nodeEnv: process.env.NODE_ENV,
        isLocalhost: host?.includes('localhost'),
        isVercel: host?.includes('vercel.app'),
        hasEnvUrl: !!envUrl
      });
      
      // If we have an environment URL and it's not ngrok, use it
      if (envUrl && !envUrl.includes('ngrok')) {
        console.log('✅ Using environment URL:', envUrl);
        return envUrl;
      }
      
      // If host is localhost, use localhost with http
      if (host && host.includes('localhost')) {
        const localhostUrl = `http://${host}`;
        console.log('✅ Using detected localhost URL:', localhostUrl);
        return localhostUrl;
      }
      
      // If host is vercel, use https with the host
      if (host && (host.includes('vercel.app') || host.includes('contentflow'))) {
        const vercelUrl = `https://${host}`;
        console.log('✅ Using detected Vercel URL:', vercelUrl);
        return vercelUrl;
      }
      
      // Fallback based on environment
      const fallbackUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : 'https://contentflow-v2.vercel.app';
      
      console.log('⚠️ Using fallback URL:', fallbackUrl);
      return fallbackUrl;
    };
    
    const correctAppUrl = getAppUrl(req);
    const callbackUrl = `${correctAppUrl}/api/late/oauth-callback?clientId=${clientId}`;
    
    console.log('🔗 Callback URL built:', callbackUrl);
    console.log('🔍 Environment check - NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔍 Request headers:', {
      host: req.headers.get('host'),
      protocol: req.headers.get('x-forwarded-proto'),
      userAgent: req.headers.get('user-agent')?.substring(0, 50) + '...'
    });
    
    // Prepare LATE API request - using GET with query parameters
    const lateApiUrl = `https://getlate.dev/api/v1/connect/${platform}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(callbackUrl)}`;
    
    console.log('🌐 About to call LATE API:', {
      url: lateApiUrl,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey.substring(0, 10)}...` // Log partial key for security
      },
      queryParams: {
        profileId: profileId,
        redirect_url: callbackUrl
      },
      encodedProfileId: encodeURIComponent(profileId),
      encodedCallbackUrl: encodeURIComponent(callbackUrl),
      decodedCallbackUrl: decodeURIComponent(encodeURIComponent(callbackUrl)),
      profileIdLength: profileId?.length,
      callbackUrlLength: callbackUrl.length,
      finalUrlLength: lateApiUrl.length
    });
    
    // Call LATE API to get the auth URL - using GET method
    console.log('🌐 Calling LATE API for platform:', platform);
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
    console.log('✅ LATE API response data:', lateData);

    // Extract the authUrl from LATE response
    const authUrl = lateData.authUrl || lateData.url || lateData.connectUrl;
    console.log('🔍 Extracted authUrl from response:', {
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
        details: 'The LATE API did not return a valid authentication URL'
      }, { status: 500 });
    }

    console.log('🔗 Successfully extracted authUrl from LATE:', authUrl);

    const responseData = { 
      success: true,
      connectUrl: authUrl,
      platform: platform,
      clientId: clientId,
      lateProfileId: profileId
    };
    
    console.log('📤 Returning success response:', responseData);
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    console.error('💥 Error in connect-platform route:', error);
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
