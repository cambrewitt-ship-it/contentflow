import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://contentflow-v2.vercel.app';

// Function to create LATE profile for existing client
async function createLateProfileForExistingClient(client: { id: string; name: string }) {
  try {
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
    
    logger.debug('Creating LATE profile', { clientName: fullClient.name });

    const response = await fetch('https://getlate.dev/api/v1/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    logger.debug('LATE API response received', { status: response.status });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ LATE API error response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });

      throw new Error(`LATE API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    logger.debug('LATE profile created successfully', {
      hasData: !!data
    });

    const profileId = data._id || data.profile?._id || data.id || data.profileId;

    if (!profileId) {
      logger.error('❌ LATE API response structure:', JSON.stringify(data, null, 2));
      logger.error('❌ Available keys in response:', Object.keys(data));
      throw new Error(`LATE API response missing profile ID field. Available keys: ${Object.keys(data).join(', ')}`);
    }

    return profileId;
  } catch (error) {
    logger.error('❌ Error creating LATE profile for existing client:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { platform, clientId } = body;

    // Validate required fields
    if (!platform || !clientId) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'platform and clientId are required'
      }, { status: 400 });
    }

    // Validate platform
    const validPlatforms = ['instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'threads'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ 
        error: 'Invalid platform',
        details: `Platform must be one of: ${validPlatforms.join(', ')}`
      }, { status: 400 });
    }

    // Check environment variables
    if (!lateApiKey) {
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'LATE_API_KEY environment variable is not set'
      }, { status: 500 });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch client data to get late_profile_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, late_profile_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      logger.error('❌ Supabase client query error:', clientError);
      
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

    if (!client.late_profile_id) {
      try {
        // Create LATE profile for existing client
        const lateProfileId = await createLateProfileForExistingClient(client);

        // Update client with new LATE profile ID
        const { error: updateError } = await supabase
          .from('clients')
          .update({ late_profile_id: lateProfileId })
          .eq('id', clientId);
          
        if (updateError) {
          logger.error('❌ Failed to update client with LATE profile ID:', updateError);
          return NextResponse.json({ 
            error: 'Failed to link LATE profile',
            details: 'Could not update client with new LATE profile ID'
          }, { status: 500 });
        }

        client.late_profile_id = lateProfileId; // Update local client object
        
      } catch (lateError) {
        logger.error('❌ Failed to create LATE profile for existing client:', lateError);
        return NextResponse.json({ 
          error: 'LATE profile creation failed',
          details: `Could not create LATE profile for client ${client.name}: ${lateError instanceof Error ? lateError.message : String(lateError)}`
        }, { status: 500 });
      }
    }

    const profileId = client.late_profile_id;

    // Build the callback URL for OAuth completion - use proper environment detection
    const getAppUrl = (req: NextRequest): string => {
      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
      const host = req.headers.get('host');
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      
      logger.debug('URL detection', {
        hasEnvUrl: !!envUrl,
        isLocalhost: host?.includes('localhost'),
        isVercel: host?.includes('vercel.app'),
        nodeEnv: process.env.NODE_ENV
      });

      // If we have an environment URL and it's not ngrok, use it
      if (envUrl && !envUrl.includes('ngrok')) {
        return envUrl;
      }
      
      // If host is localhost, use localhost with http
      if (host && host.includes('localhost')) {
        const localhostUrl = `http://${host}`;
        return localhostUrl;
      }
      
      // If host is vercel, use https with the host
      if (host && (host.includes('vercel.app') || host.includes('contentflow'))) {
        const vercelUrl = `https://${host}`;
        return vercelUrl;
      }
      
      // Fallback based on environment
      const fallbackUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : 'https://contentflow-v2.vercel.app';
      return fallbackUrl;
    };
    
    const correctAppUrl = getAppUrl(req);
    const callbackUrl = `${correctAppUrl}/api/late/oauth-callback?clientId=${clientId}`;

    logger.debug('OAuth callback URL prepared', {
      callbackUrl: callbackUrl
    });

    const lateApiUrl = `https://getlate.dev/api/v1/connect/${platform}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(callbackUrl)}`;
    
    logger.debug('Calling LATE API for platform connection', {
      platform: platform,
      profileId: profileId
    });

    const lateResponse = await fetch(lateApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`
      }
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      logger.error('❌ LATE API error response:', {
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

    // Extract the authUrl from LATE response
    const authUrl = lateData.authUrl || lateData.url || lateData.connectUrl;
    logger.debug('Extracted authUrl', {
      authUrlFound: !!authUrl,
      keysCount: Object.keys(lateData).length
    });

    if (!authUrl) {
      logger.error('❌ No authUrl found in LATE response:', {
        response: lateData,
        checkedKeys: ['authUrl', 'url', 'connectUrl']
      });

      return NextResponse.json({ 
        error: 'LATE API response missing authUrl',
        details: 'The LATE API did not return a valid authentication URL'
      }, { status: 500 });
    }

    const responseData = { 
      success: true,
      connectUrl: authUrl,
      platform: platform,
      clientId: clientId,
      lateProfileId: profileId
    };
    
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    logger.error('💥 Error in connect-platform route:', error);
    logger.error('💥 Error details:', {
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