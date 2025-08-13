// src/app/api/schedulePost/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

console.log("supabaseUrl:", supabaseUrl);
console.log("supabaseServiceRoleKey:", supabaseServiceRoleKey ? "***SET***" : "***MISSING***");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE are set.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    console.log("Received body:", req.body);
    const body = await req.json();
    const { client_id, project_id, post_id, scheduled_time, platform } = body ?? {};

    if (!client_id || !project_id || !post_id || !scheduled_time || !platform) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Test if table exists
    console.log("Testing table access...");
    const { data: testData, error: testError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .limit(1);
    console.log("Table test result:", { testData, testError });

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert([{
        client_id,
        project_id,
        post_id,
        scheduled_time,
        platform,
        status: 'scheduled'
      }])
      .select('*')
      .single();

    if (error) {
      console.error('Supabase insert error', error);
      return NextResponse.json({ success: false, error: error.message || 'DB insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, record: data }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in schedulePost route', err);
    return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
