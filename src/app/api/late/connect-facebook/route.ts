import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const lateApiKey = process.env.LATE_API_KEY!;

// Function to create LATE profile for existing client
interface ClientBrandDetails {
  id: string;
  name: string;
  late_profile_id?: string | null;
  company_description?: string | null;
  value_proposition?: string | null;
  target_audience?: string | null;
  brand_tone?: string | null;
  website_url?: string | null;
}

async function createLateProfileForExistingClient(client: ClientBrandDetails) {
  try {
    // Build a comprehensive description using brand information
    let description = `Social media profile for ${client.name}`;
    
    if (client.company_description) {
      description += `\n\nAbout: ${client.company_description}`;
    }
    
    if (client.value_proposition) {
      description += `\n\nValue Proposition: ${client.value_proposition}`;
    }
    
    if (client.target_audience) {
      description += `\n\nTarget Audience: ${client.target_audience}`;
    }
    
    if (client.brand_tone) {
      description += `\n\nBrand Tone: ${client.brand_tone}`;
    }
    
    if (client.website_url) {
      description += `\n\nWebsite: ${client.website_url}`;
    }

    const requestBody = {
      name: client.name,
      description: description,
      color: "#4ade80" // Default green color
    };
    
    logger.debug('Creating LATE profile', { clientName: client.name });

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
    const { clientId } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json({ 
        error: 'Missing required field',
        details: 'clientId is required'
      }, { status: 400 });
    }

    const auth = await requireClientOwnership(req, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    // Check environment variables
    if (!lateApiKey) {
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'LATE_API_KEY environment variable is not set'
      }, { status: 500 });
    }

    // Fetch client data to get late_profile_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, late_profile_id, company_description, value_proposition, target_audience, brand_tone, website_url')
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

    // Build Facebook-specific callback URL - use proper environment detection
    const getAppUrl = (req: NextRequest): string => {
      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
      const host = req.headers.get('host');
      const protocol =
        host && host.includes('localhost')
          ? 'http'
          : req.headers.get('x-forwarded-proto') || 'https';
      
      logger.debug('URL detection', {
        hasEnvUrl: !!envUrl,
        isLocalhost: host?.includes('localhost'),
        isVercel: host?.includes('vercel.app'),
        nodeEnv: process.env.NODE_ENV
      });

      // PRIORITY 1: Check for localhost FIRST (before checking env URL)
      // This prevents production URL from overriding localhost development
      if (host && host.includes('localhost')) {
        const localhostUrl = `${protocol}://${host}`;
        logger.debug('Using localhost URL', { localhostUrl });
        return localhostUrl;
      }
      
      // PRIORITY 2: Check if host is vercel
      if (host && (host.includes('vercel.app') || host.includes('contentflow'))) {
        const vercelUrl = `${protocol}://${host}`;
        logger.debug('Using Vercel host URL', { vercelUrl });
        return vercelUrl;
      }

      // PRIORITY 3: Use environment URL if it exists and it's not ngrok
      if (envUrl && !envUrl.includes('ngrok')) {
        logger.debug('Using environment URL', { envUrl });
        return envUrl;
      }
      
      // Fallback based on environment
      const fallbackUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : 'https://content-manager.io';
      logger.debug('Using fallback URL', { fallbackUrl });
      return fallbackUrl;
    };
    
    const correctAppUrl = getAppUrl(req);
    const callbackUrl = `${correctAppUrl}/api/late/facebook-callback?clientId=${clientId}`;

    logger.debug('Facebook callback URL prepared', {
      callbackUrl: callbackUrl
    });

    const lateApiUrl = `https://getlate.dev/api/v1/connect/facebook?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(callbackUrl)}`;
    
    logger.debug('Calling LATE API for Facebook connection', {
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
        body: errorText,
        url: lateApiUrl,
        headers: Object.fromEntries(lateResponse.headers.entries())
      });

      return NextResponse.json({ 
        error: 'LATE API request failed',
        details: `Status: ${lateResponse.status}, Response: ${errorText}`
      }, { status: 500 });
    }

    const lateData = await lateResponse.json();

    // Extract the authUrl from LATE response
    const authUrl = lateData.authUrl || lateData.url || lateData.connectUrl;
    logger.debug('Extracted Facebook authUrl', {
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
        details: 'The LATE API did not return a valid Facebook authentication URL'
      }, { status: 500 });
    }

    const responseData = { 
      success: true,
      connectUrl: authUrl,
      platform: 'facebook',
      clientId: clientId,
      lateProfileId: profileId,
      notes: 'Facebook requires page selection after OAuth. User will be redirected to page selection flow after authentication.'
    };
    
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    logger.error('💥 Error in connect-facebook route:', error);
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