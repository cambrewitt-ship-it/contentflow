import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId parameter' }, { status: 400 });
    }

    const auth = await requireClientOwnership(req, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

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
