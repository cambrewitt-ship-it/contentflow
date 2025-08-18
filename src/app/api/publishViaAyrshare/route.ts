// src/app/api/publishViaAyrshare/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishToAyrshare } from 'lib/ayrshare';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: Request) {
  console.log('🚀 /api/publishViaAyrshare - Request received');
  
  try {
    // 1. Check if AYRSHARE_API_KEY exists
    const apiKey = process.env.AYRSHARE_API_KEY;
    console.log('🔑 AYRSHARE_API_KEY check:', {
      exists: !!apiKey,
      length: apiKey ? apiKey.length : 0,
      startsWith: apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'
    });

    if (!apiKey) {
      console.error('❌ AYRSHARE_API_KEY is missing from environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Ayrshare not configured (AYRSHARE_API_KEY missing)',
        debug: {
          envVars: Object.keys(process.env).filter(key => key.includes('AYR')),
          nodeEnv: process.env.NODE_ENV
        }
      }, { status: 500 });
    }

    // 2. Parse and validate request body
    const body = await req.json();
    console.log('📥 Request body received:', {
      scheduled_post_id: body?.scheduled_post_id,
      caption: body?.caption,
      image_url: body?.image_url,
      scheduled_time: body?.scheduled_time,
      platforms: body?.platforms,
      client_id: body?.client_id,
      project_id: body?.project_id
    });

    const { scheduled_post_id, caption, image_url, scheduled_time, platforms, client_id, project_id } = body ?? {};

    if (!scheduled_post_id || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      console.error('❌ Missing required fields:', { scheduled_post_id, platforms });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields (scheduled_post_id, platforms)',
        received: { scheduled_post_id, platforms }
      }, { status: 400 });
    }

    // 3. Prepare payload for Ayrshare
    const aylPayload = {
      caption,
      imageUrl: image_url,
      schedule_time: scheduled_time,
      platforms
    };
    console.log('📤 Prepared Ayrshare payload:', aylPayload);

    // 4. Call Ayrshare API directly with debugging
    console.log('🌐 Calling Ayrshare API directly...');
    
    console.log('API Key exists:', !!process.env.AYRSHARE_API_KEY);
    console.log('API Key first 10 chars:', process.env.AYRSHARE_API_KEY?.substring(0, 10));

    const postData = {
      post: aylPayload.caption || 'Test post',
      platforms: aylPayload.platforms,
      mediaUrls: aylPayload.imageUrl ? [aylPayload.imageUrl] : [],
      scheduleDate: aylPayload.schedule_time
    };

    console.log('Post data being sent:', postData);

    const ayrshareResponse = await fetch('https://app.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
      },
      body: JSON.stringify(postData),
    });

    console.log('Ayrshare response status:', ayrshareResponse.status);
    const responseText = await ayrshareResponse.text();
    console.log('Ayrshare response body:', responseText);

    if (!ayrshareResponse.ok) {
      console.error('❌ Ayrshare API error:', ayrshareResponse.status, responseText);
      return NextResponse.json({ 
        error: `Ayrshare API error: ${ayrshareResponse.status} - ${responseText}`,
        debug: {
          postData,
          apiKeyExists: !!process.env.AYRSHARE_API_KEY,
          apiKeyLength: process.env.AYRSHARE_API_KEY?.length
        }
      }, { status: ayrshareResponse.status });
    }

    // Parse the response if it's JSON
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('✅ Ayrshare API call successful, parsed result:', result);
    } catch (parseError) {
      console.log('⚠️ Response is not JSON, using raw text:', responseText);
      result = { rawResponse: responseText };
    }

    // 5. Update Supabase (if available)
    try {
      console.log('💾 Updating Supabase with Ayrshare result...');
      await supabase
        .from('scheduled_posts')
        .update({ status: 'pending', ayrshare_response: result })
        .eq('id', scheduled_post_id);
      console.log('✅ Supabase update successful');
    } catch (e) {
      console.error('❌ Failed updating scheduled_posts with Ayrshare result:', e);
      // Don't fail the request if Supabase update fails
    }

    // 6. Return success response
    const successResponse = { success: true, result };
    console.log('🎉 Returning success response:', successResponse);
    return NextResponse.json(successResponse, { status: 200 });

  } catch (err: any) {
    console.error('💥 publishViaAyrshare error occurred:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      response: err?.response,
      status: err?.status,
      statusText: err?.statusText
    });

    // Enhanced error response with debugging info
    const errorResponse = {
      success: false,
      error: err?.message || 'Unknown error',
      errorType: err?.name || 'Error',
      details: {
        response: err?.response ?? null,
        status: err?.status,
        statusText: err?.statusText,
        timestamp: new Date().toISOString()
      }
    };

    console.log('❌ Returning error response:', errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
