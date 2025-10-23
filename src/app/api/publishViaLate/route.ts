// src/app/api/publishViaLate/route.ts
// LATE API integration for social media scheduling.

import { NextResponse } from "next/server";
import logger from '@/lib/logger';

export async function POST(req: Request) {
  try {
    logger.error('🚀 /api/publishViaLate - Request received');

    const body = await req.json();
    logger.error('📥 Incoming request body:', JSON.stringify(body, null, 2));

    // Environment variable check
    logger.error('ENV CHECK', {
      LATE_API_KEY: !!process.env.LATE_API_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV || null,
      VERCEL_REGION: process.env.VERCEL_REGION || null
    });

    const LATE_KEY = process.env.LATE_API_KEY;
    if (!LATE_KEY) {
      logger.error('❌ Missing LATE_API_KEY environment variable');
      logger.error('RETURNING ERROR: Missing LATE_API_KEY', { status: 500, body: { error: "Missing LATE_API_KEY" } });
      return NextResponse.json({ error: "Missing LATE_API_KEY" }, { status: 500 });
    }

    // Transform request body to match LATE API format
    const lateApiPayload = {
      platforms: body.platforms || [body.platform || 'facebook'], // Handle both formats
      content: body.content || body.message || body.caption || 'No content provided', // Handle multiple field names
      scheduled_time: body.scheduled_time || body.scheduledTime || new Date().toISOString(),
      ...(body.image_url && { image_url: body.image_url }),
      ...(body.client_id && { client_id: body.client_id }),
      ...(body.project_id && { project_id: body.project_id })
    };

    logger.error('🔄 Transformed payload for LATE API:', JSON.stringify(lateApiPayload, null, 2));
    logger.error('🌐 Calling LATE API at: https://api.getlate.dev/v1/posts');

    // Make request to LATE API
    const lateResp = await fetch("https://api.getlate.dev/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lateApiPayload),
    });

    logger.error('📡 LATE API response received:', {
      status: lateResp.status,
      statusText: lateResp.statusText,
      ok: lateResp.ok,
      headers: Object.fromEntries(lateResp.headers.entries())
    });

    const responseText = await lateResp.text();
    logger.error('📄 LATE API response body (raw):', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
      logger.error('✅ LATE API response parsed as JSON:', data);
    } catch (parseError) {
      logger.error('⚠️ LATE API response is not valid JSON, using raw text');
      data = { rawResponse: responseText };
    }

    if (lateResp.ok) {
      logger.error('RETURNING SUCCESS:', { status: lateResp.status, body: data });
      return NextResponse.json(data, { status: lateResp.status });
    } else {
      logger.error('❌ LATE API returned error status:', lateResp.status);
      logger.error('RETURNING LATE API ERROR:', { status: lateResp.status, body: data });
      return NextResponse.json(data, { status: lateResp.status });
    }

  } catch (err: unknown) {
    logger.error("💥 publishViaLate error occurred:", {
      message: err instanceof Error ? err.message : 'Unknown error',
      name: err instanceof Error ? err.name : 'Error',
      stack: err instanceof Error ? err.stack : undefined
    });

    const errorResponse = { error: "server error", details: String(err) };
    logger.error('RETURNING ERROR:', { status: 500, body: errorResponse, error: err });

    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  }
}
