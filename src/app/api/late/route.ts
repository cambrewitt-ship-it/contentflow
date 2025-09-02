// src/app/api/late/route.ts
// LATE API proxy for social media scheduling.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log('🚀 /api/late - LATE API proxy request received');
    
    const body = await req.json();
    console.log('📥 Incoming request body keys:', Object.keys(body));
    
    const LATE_KEY = process.env.LATE_API_KEY;
    console.log('🔑 LATE_API_KEY check:', {
      exists: !!LATE_KEY,
      length: LATE_KEY ? LATE_KEY.length : 0,
      startsWith: LATE_KEY ? LATE_KEY.substring(0, 8) + '...' : 'N/A'
    });
    
    if (!LATE_KEY) {
      console.error('❌ Missing LATE_API_KEY environment variable');
      return NextResponse.json({ error: "Missing LATE_API_KEY" }, { status: 500 });
    }

    console.log('🌐 Calling LATE API at: https://getlate.dev/api/v1/posts');
    console.log('📤 Sending payload keys to LATE API:', Object.keys(body));
    
    const lateResp = await fetch("https://getlate.dev/api/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log('📡 LATE API response received - status:', lateResp.status, 'ok:', lateResp.ok);

    const responseText = await lateResp.text();
    console.log('📄 LATE API response body length:', responseText.length);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ LATE API response parsed as JSON - keys:', Object.keys(data));
    } catch (parseError) {
      console.warn('⚠️ LATE API response is not valid JSON, using raw text');
      data = { rawResponse: responseText };
    }

    console.log('🎯 Returning LATE API response to client with status:', lateResp.status);
    return NextResponse.json(data, { status: lateResp.status });
    
  } catch (err: unknown) {
    console.error('💥 LATE API proxy error occurred:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      name: err instanceof Error ? err.name : 'Error',
      stack: err instanceof Error ? err.stack : undefined
    });
    
    return NextResponse.json(
      { error: "server error", details: String(err) },
      { status: 500 }
    );
  }
}
