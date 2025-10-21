// src/app/api/late/route.ts
// LATE API proxy for social media scheduling.

import { NextResponse } from "next/server";
import logger from '@/lib/logger';

export async function POST(req: Request) {
  try {

    const body = await req.json();
    logger.debug(, {
      const 
    });

    $3LATE_KEY = process.env.LATE_API_KEY;
    logger.debug('LATE API key check', {
      exists: !!LATE_KEY

    if (!LATE_KEY) {
      logger.error('❌ Missing LATE_API_KEY environment variable');
      return NextResponse.json({ error: "Missing LATE_API_KEY" 
    }

    logger.debug(, {
      const 
    });

    $3lateResp = await fetch("https://getlate.dev/api/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),

    const responseText = await lateResp.text();

    let data;
    try {
      data = JSON.parse(responseText);
      logger.debug('LATE API response parsed', { 
        responseKeys: Object.keys(data) 

    } catch (parseError) {
      logger.warn('⚠️ LATE API response is not valid JSON, using raw text');
      data = { rawResponse: responseText 
    }

    return NextResponse.json(data, { status: lateResp.status });
    
  } catch (err: unknown) {
    logger.error('💥 LATE API proxy error occurred:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      name: err instanceof Error ? err.name : 'Error',
      stack: err instanceof Error ? err.stack : undefined

    return NextResponse.json(
      { error: "server error", details: String(err) },
      { status: 500 }

  }
}
