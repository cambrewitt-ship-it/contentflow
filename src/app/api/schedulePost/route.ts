// src/app/api/schedulePost/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.error('Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE are set.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false });

export async function POST(req: Request) {
  try {

    const body = await req.json();
    const { client_id, project_id, post_id, scheduled_time, account_ids, image_url } = body ?? {
    if (!client_id || !project_id || !post_id || !scheduled_time || !account_ids) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate account_ids is an array
    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'account_ids must be a non-empty array' }, { status: 400 });
    }

    // Test if table exists

    const { data: testData, error: testError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .limit(1);

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert([{
        client_id,
        project_id,
        post_id,
        scheduled_time,
        account_ids, // Store as JSONB array
        status: 'scheduled',
        image_url: image_url || null // Include image_url field
      }])
      .select('*')
      .single();

    if (error) {
      logger.error('Supabase insert error', error);
      return NextResponse.json({ success: false, error: error.message || 'DB insert failed' 
    }

    return NextResponse.json({ success: true, id: data.id, record: data }, { status: 200 });
  } catch (err: unknown) {
    logger.error('Unexpected error in schedulePost route', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage 
  }
}
