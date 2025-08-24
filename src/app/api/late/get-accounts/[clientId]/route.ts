import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const lateApiKey = process.env.LATE_API_KEY!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string } } }
) {
  console.log('🚀 Get connected accounts API route called');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🔗 Request URL:', req.url);
  
  try {
    const { clientId } = await params;
    console.log('🔍 Fetching accounts for clientId:', clientId);

    // Validate required fields
    if (!clientId) {
      console.log('❌ Missing clientId parameter');
      return NextResponse.json({ 
        error: 'Missing required parameter',
        details: 'clientId is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check environment variables
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceRole: !!supabaseServiceRoleKey,
      hasLateApiKey: !!lateApiKey,
      lateApiKeyLength: lateApiKey ? lateApiKey.length : 0
    });

    if (!lateApiKey) {
      console.log('❌ LATE_API_KEY is missing');
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'LATE_API_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.log('❌ Supabase environment variables missing');
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'Supabase environment variables are not set',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Create Supabase client
    console.log('🔌 Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    // Fetch client data to get late_profile_id
    console.log('🔍 Fetching client data for ID:', clientId);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, late_profile_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('❌ Supabase client query error:', {
        code: clientError.code,
        message: clientError.message,
        details: clientError.details,
        hint: clientError.hint,
        fullError: clientError
      });
      
      if (clientError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Client not found',
          details: `No client found with ID: ${clientId}`,
          code: clientError.code,
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: clientError.message,
        code: clientError.code,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    if (!client.late_profile_id) {
      console.log('❌ Client missing late_profile_id:', {
        clientId: client.id,
        clientName: client.name,
        lateProfileId: client.late_profile_id
      });
      return NextResponse.json({ 
        error: 'LATE profile not found',
        details: `Client ${client.name} does not have a LATE profile ID`,
        clientId: client.id,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    const profileId = client.late_profile_id;
    console.log('✅ Client found with profileId:', { 
      clientId: client.id, 
      clientName: client.name, 
      profileId: profileId 
    });

    // Call LATE API to get connected accounts
    console.log('🌐 Fetching connected accounts from LATE API for profileId:', profileId);
    const lateApiUrl = `https://getlate.dev/api/v1/accounts?profileId=${profileId}`;
    
    console.log('🌐 Calling LATE API:', {
      url: lateApiUrl,
      method: 'GET',
      profileId: profileId,
      hasAuthHeader: !!lateApiKey,
      authHeaderLength: lateApiKey.length
    });
    
    const lateResponse = await fetch(lateApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`
      }
    });

    console.log('📡 LATE API response received:', {
      status: lateResponse.status,
      statusText: lateResponse.statusText,
      ok: lateResponse.ok,
      headers: Object.fromEntries(lateResponse.headers.entries())
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      console.error('❌ LATE API error response:', {
        status: lateResponse.status,
        statusText: lateResponse.statusText,
        body: errorText,
        url: lateApiUrl,
        profileId: profileId
      });
      
      return NextResponse.json({ 
        error: 'LATE API request failed',
        details: `Status: ${lateResponse.status}, Response: ${errorText}`,
        url: lateApiUrl,
        profileId: profileId,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    const lateData = await lateResponse.json();
    console.log('✅ LATE API accounts response:', {
      hasData: !!lateData,
      dataKeys: Object.keys(lateData),
      accountsCount: lateData.accounts?.length || lateData.data?.length || 0,
      rawResponse: lateData
    });

    // Extract accounts from LATE response
    const accounts = lateData.accounts || lateData.data || [];
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.log('❌ No connected accounts found');
      return NextResponse.json({ 
        success: true,
        accounts: [],
        message: 'No social media accounts are currently connected',
        profileId: profileId,
        timestamp: new Date().toISOString()
      });
    }

    console.log('📋 Found connected accounts:', {
      count: accounts.length,
      platforms: accounts.map((acc: any) => acc.platform || acc.socialPlatform),
      sampleAccount: accounts[0]
    });

    // Transform accounts to a consistent format
    const transformedAccounts = accounts.map((account: any) => ({
      id: account.id || account.accountId || account._id,
      platform: account.platform || account.socialPlatform,
      username: account.username || account.handle || account.name,
      accountId: account.accountId || account.id || account._id,
      profilePicture: account.profilePicture || account.picture?.data?.url,
      isActive: account.isActive !== false, // Default to true unless explicitly false
      connectedAt: account.connectedAt || account.createdAt,
      permissions: account.permissions || [],
      // Platform-specific fields
      ...(account.platform === 'instagram' && {
        followers: account.followers,
        isBusiness: account.isBusiness,
        isVerified: account.isVerified
      }),
      ...(account.platform === 'facebook' && {
        pageName: account.pageName || account.name,
        pageId: account.pageId,
        pageCategory: account.pageCategory,
        pageFollowers: account.pageFollowers
      }),
      ...(account.platform === 'linkedin' && {
        companyName: account.companyName,
        companyId: account.companyId,
        connectionCount: account.connectionCount
      })
    }));

    console.log('🔄 Transformed accounts:', {
      count: transformedAccounts.length,
      platforms: transformedAccounts.map(acc => acc.platform),
      sampleTransformed: transformedAccounts[0]
    });

    const responseData = {
      success: true,
      accounts: transformedAccounts,
      totalAccounts: transformedAccounts.length,
      clientId: clientId,
      lateProfileId: profileId,
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Returning accounts response:', {
      success: responseData.success,
      totalAccounts: responseData.totalAccounts,
      platforms: transformedAccounts.map(acc => acc.platform),
      clientId: responseData.clientId,
      lateProfileId: responseData.lateProfileId
    });
    
    return NextResponse.json(responseData);

  } catch (error: unknown) {
    console.error('💥 Error in get-accounts route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      constructor: error?.constructor?.name,
      type: typeof error
    });
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
