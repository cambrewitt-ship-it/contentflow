import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Resolve token — supports both legacy client tokens and party tokens
    const resolved = await resolvePortalToken(token);

    if (!resolved) {
      logger.warn('Portal validation failed: invalid token', {
        tokenPreview: token.substring(0, 8) + '...',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, portal_settings')
      .eq('id', resolved.clientId)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        portal_settings: client.portal_settings ?? {},
      },
      party: resolved.party ?? null,
    });
  } catch (error) {
    logger.error('Portal validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}