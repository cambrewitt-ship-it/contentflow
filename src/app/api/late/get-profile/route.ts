import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 });
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Query the late_profiles table for this client
    const { data: profiles, error } = await supabase
      .from('late_profiles')
      .select('profile_id, platform, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('❌ Supabase query error:', error);
      return NextResponse.json({
        error: 'Database query failed',
        details: error.message
      });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        profileId: null,
        message: 'No LATE profile found for this client'
      });
    }

    const profile = profiles[0];

    return NextResponse.json({
      profileId: profile.profile_id,
      platform: profile.platform,
      created_at: profile.created_at
    });

  } catch (error: unknown) {
    logger.error('💥 Error in get-profile route:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
