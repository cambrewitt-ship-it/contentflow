import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const LATE_API_KEY = process.env.LATE_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      name, 
      description, 
      company_description, 
      website_url, 
      brand_tone, 
      target_audience, 
      industry, 
      brand_keywords,
      caption_dos,
      caption_donts
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ 
        error: 'Client name is required' 
      }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ 
        error: 'Client name must be at least 2 characters' 
      }, { status: 400 });
    }

    // Validate LATE API key
    if (!LATE_API_KEY) {
      console.error('❌ Missing LATE_API_KEY environment variable');
      return NextResponse.json({ 
        error: 'LATE API configuration missing' 
      }, { status: 500 });
    }

    console.log('🚀 Creating new client with LATE profile:', { name, description });

    // Step 1: Create LATE profile
    console.log('🌐 Step 1: Creating LATE Profile');
    const lateProfileData = {
      name: `${name.trim()} - ContentFlow Client`,
      description: description?.trim() || `Social media management client: ${name.trim()}`
    };

    console.log('📤 LATE API Request Details:');
    console.log('   URL: https://getlate.dev/api/v1/profiles');
    console.log('   Body keys:', Object.keys(lateProfileData));

    console.log('🚀 About to create LATE profile...');
    const lateProfileRes = await fetch('https://getlate.dev/api/v1/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lateProfileData)
    });

    // Log the LATE API response status
    console.log('📡 LATE API Status:', lateProfileRes.status, lateProfileRes.statusText);
    console.log('📡 LATE API Response Details:', {
      status: lateProfileRes.status,
      statusText: lateProfileRes.statusText,
      ok: lateProfileRes.ok,
      headers: Object.fromEntries(lateProfileRes.headers.entries())
    });

    if (!lateProfileRes.ok) {
      console.log('❌ LATE API returned error status, reading error response...');
      
      // Log the raw response body as text first
      const errorText = await lateProfileRes.text();
      console.log('❌ LATE API Raw Error Response Body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.log('❌ LATE API Parsed Error Response (JSON):', errorData);
      } catch (parseError) {
        console.log('❌ LATE API Error Response is not valid JSON, using raw text');
        errorData = { rawError: errorText };
      }

      console.error('❌ LATE profile creation failed - Complete Analysis:', {
        status: lateProfileRes.status,
        statusText: lateProfileRes.statusText,
        rawResponseBody: errorText,
        parsedErrorData: errorData,
        headers: Object.fromEntries(lateProfileRes.headers.entries()),
        requestUrl: 'https://getlate.dev/api/v1/profiles',
        requestBody: lateProfileData
      });

      return NextResponse.json({ 
        error: 'Failed to create LATE profile', 
        details: errorData.error || errorText,
        lateApiStatus: lateProfileRes.status,
        rawResponse: errorText,
        debug: {
          status: lateProfileRes.status,
          statusText: lateProfileRes.statusText,
          parsedError: errorData
        }
      }, { status: 500 });
    }

    // Log the raw response body as text before parsing
    console.log('✅ LATE API returned success status, reading response body...');
    const responseText = await lateProfileRes.text();
    console.log('📄 LATE API Raw Response Body length:', responseText.length);
    
    let lateProfile;
    try {
      lateProfile = JSON.parse(responseText);
      console.log('✅ LATE API Response Parsed Successfully - keys:', Object.keys(lateProfile));
      console.log('🔍 Available fields:', Object.keys(lateProfile || {}));
    } catch (parseError) {
      console.log('❌ JSON Parse Error:', parseError);
      console.error('❌ Failed to parse LATE API response as JSON:', parseError);
      console.error('❌ Raw response that failed to parse:', responseText);
      
      // Return detailed error response instead of throwing
      return NextResponse.json({ 
        error: 'Invalid JSON response from LATE API', 
        details: 'Response could not be parsed as JSON',
        rawResponse: responseText,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        debug: {
          status: lateProfileRes.status,
          statusText: lateProfileRes.statusText,
          rawResponseLength: responseText.length,
          parseErrorType: parseError instanceof Error ? parseError.name : typeof parseError
        }
      }, { status: 500 });
    }

    // Log what we're trying to extract
    console.log('🔍 Attempting to extract profile ID from nested response...');
    console.log('🔍 Response object keys:', Object.keys(lateProfile));
    console.log('🔍 Looking for profile object:', lateProfile.profile);
    console.log('🔍 Profile object keys:', lateProfile.profile ? Object.keys(lateProfile.profile) : 'No profile object');
    console.log('🔍 Looking for profile._id field:', lateProfile.profile?._id);
    console.log('🔍 Response structure keys:', Object.keys(lateProfile));

    // Extract profile ID from the nested response.profile._id structure
    if (!lateProfile.profile) {
      console.error('❌ No profile object found in LATE response');
      console.error('❌ Response object:', lateProfile);
      console.error('❌ Response type:', typeof lateProfile);
      console.error('❌ Response keys:', Object.keys(lateProfile));
      console.error('❌ Raw response text:', responseText);
      
      return NextResponse.json({ 
        error: 'Invalid LATE profile response - missing profile object', 
        details: 'Response missing expected profile object',
        actualResponse: lateProfile,
        actualResponseKeys: Object.keys(lateProfile),
        rawResponse: responseText,
        debug: {
          status: lateProfileRes.status,
          statusText: lateProfileRes.statusText,
          responseType: typeof lateProfile,
          responseKeys: Object.keys(lateProfile)
        }
      }, { status: 500 });
    }

    const profileId = lateProfile.profile._id;
    
    if (!profileId) {
      console.error('❌ No profile ID found in LATE response.profile._id');
      console.error('❌ Profile object:', lateProfile.profile);
      console.error('❌ Profile object keys:', Object.keys(lateProfile.profile));
      console.error('❌ Raw response text:', responseText);
      
      return NextResponse.json({ 
        error: 'Invalid LATE profile response - missing profile ID', 
        details: 'Profile object missing _id field',
        profileObject: lateProfile.profile,
        profileObjectKeys: Object.keys(lateProfile.profile),
        rawResponse: responseText,
        debug: {
          status: lateProfileRes.status,
          statusText: lateProfileRes.statusText,
          profileObjectType: typeof lateProfile.profile
        }
      }, { status: 500 });
    }

    console.log('✅ Profile ID extracted successfully from response.profile._id:', profileId);
    console.log('✅ Profile ID type:', typeof profileId);
    console.log('✅ Profile ID value:', profileId);
    console.log('✅ Profile ID length:', profileId.length);

    console.log('✅ LATE profile created successfully - profileId:', profileId);

    // Step 2: Create client record in Supabase with LATE profileId
    console.log('🗄️ Step 2: Creating Client Record in Supabase');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: client, error: supabaseError } = await supabase
      .from('clients')
      .insert([
        {
          name: name.trim(),
          description: description?.trim() || null,
          company_description: company_description?.trim() || null,
          website_url: website_url?.trim() || null,
          brand_tone: brand_tone?.trim() || null,
          target_audience: target_audience?.trim() || null,
          industry: industry?.trim() || null,
          brand_keywords: brand_keywords?.trim() ? brand_keywords.split(',').map((k: string) => k.trim()) : null,
          caption_dos: caption_dos?.trim() || null,
          caption_donts: caption_donts?.trim() || null,
          late_profile_id: profileId,
          created_at: new Date().toISOString()
        }
      ])
      .select('id, name, description, company_description, website_url, brand_tone, target_audience, industry, brand_keywords, caption_dos, caption_donts, late_profile_id, created_at')
      .single();

    if (supabaseError) {
      console.error('❌ Supabase insert error:', supabaseError);
      
      // If Supabase fails, we should clean up the LATE profile
      try {
        console.log('🧹 Cleaning up LATE profile due to Supabase failure...');
        await fetch(`https://getlate.dev/api/v1/profiles/${profileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${LATE_API_KEY}`
          }
        });
        console.log('✅ LATE profile cleaned up');
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup LATE profile:', cleanupError);
      }

      return NextResponse.json({ 
        error: 'Failed to create client in database', 
        details: supabaseError.message 
      }, { status: 500 });
    }

    console.log('✅ Client created successfully in Supabase:', client);

    // Step 3: Create late_profiles record linking client to LATE profile
    console.log('🔗 Step 3: Creating LATE Profile Link Record');
    const { error: linkError } = await supabase
      .from('late_profiles')
      .insert([
        {
          client_id: client.id,
          profile_id: profileId,
          platform: 'multi', // Default to multi-platform
          created_at: new Date().toISOString()
        }
      ]);

    if (linkError) {
      console.error('❌ Failed to create LATE profile link:', linkError);
      // Don't fail the entire request for this, just log it
      console.warn('⚠️ Client created but LATE profile link failed');
    } else {
      console.log('✅ LATE profile link created successfully');
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      client: {
        id: client.id,
        name: client.name,
        description: client.description,
        company_description: client.company_description,
        website_url: client.website_url,
        brand_tone: client.brand_tone,
        target_audience: client.target_audience,
        industry: client.industry,
        brand_keywords: client.brand_keywords,
        caption_dos: client.caption_dos,
        caption_donts: client.caption_donts,
        late_profile_id: profileId,
        created_at: client.created_at
      },
      lateProfile: {
        id: profileId,
        name: lateProfile.profile.name,
        description: lateProfile.profile.description
      }
    });

  } catch (error: unknown) {
    console.error('💥 Error in create client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
