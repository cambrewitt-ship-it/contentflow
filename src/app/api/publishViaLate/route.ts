// src/app/api/publishViaLate/route.ts
// LATE API integration for social media scheduling.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.error('🚀 /api/publishViaLate - Request received');
    
    const body = await req.json();
    console.error('📥 Incoming request body:', JSON.stringify(body, null, 2));
    
    // Environment variable check
    console.error('ENV CHECK', {
      LATE_API_KEY: !!process.env.LATE_API_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV || null,
      VERCEL_REGION: process.env.VERCEL_REGION || null
    });
    
    const LATE_KEY = process.env.LATE_API_KEY;
    if (!LATE_KEY) {
      console.error('❌ Missing LATE_API_KEY environment variable');
      console.error('RETURNING ERROR: Missing LATE_API_KEY', { status: 500, body: { error: "Missing LATE_API_KEY" } });
      return NextResponse.json({ error: "Missing LATE_API_KEY" }, { status: 500 });
    }

    // Transform request body to match LATE API format
    const lateApiPayload = {
      platforms: body.platforms || [body.platform || 'facebook'], // Handle both formats
      content: body.content || body.message || body.caption || 'No content provided', // Handle multiple field names
      scheduled_time: body.scheduled_time || body.scheduledTime || new Date().toISOString(),
      // Add any additional fields that LATE API might need
      ...(body.image_url && { image_url: body.image_url }),
      ...(body.client_id && { client_id: body.client_id }),
      ...(body.project_id && { project_id: body.project_id })
    };
    
    console.error('🔄 Transformed payload for LATE API:', JSON.stringify(lateApiPayload, null, 2));
    console.error('🌐 Calling LATE API at: https://api.getlate.dev/v1/posts');
    
    // Make request to LATE API
    const lateResp = await fetch("https://api.getlate.dev/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lateApiPayload),
    });

    console.error('📡 LATE API response received:', {
      status: lateResp.status,
      statusText: lateResp.statusText,
      ok: lateResp.ok,
      headers: Object.fromEntries(lateResp.headers.entries())
    });

    const responseText = await lateResp.text();
    console.error('📄 LATE API response body (raw):', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
      console.error('✅ LATE API response parsed as JSON:', data);
    } catch (parseError) {
      console.error('⚠️ LATE API response is not valid JSON, using raw text');
      data = { rawResponse: responseText };
    }

    if (lateResp.ok) {
      console.error('RETURNING SUCCESS:', { status: lateResp.status, body: data });
      return NextResponse.json(data, { status: lateResp.status });
    } else {
      console.error('❌ LATE API returned error status:', lateResp.status);
      console.error('RETURNING LATE API ERROR:', { status: lateResp.status, body: data });
      return NextResponse.json(data, { status: lateResp.status });
    }

  } catch (err: unknown) {
    console.error("💥 publishViaLate error occurred:", {
      message: err instanceof Error ? err.message : 'Unknown error',
      name: err instanceof Error ? err.name : 'Error',
      stack: err instanceof Error ? err.stack : undefined
    });
    
    const errorResponse = { error: "server error", details: String(err) };
    console.error('RETURNING ERROR:', { status: 500, body: errorResponse, error: err });
    
    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  }
}
