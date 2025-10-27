import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

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

    // Validate portal token and get client info
    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        portal_enabled,
        portal_settings
      `)
      .eq('portal_token', token)
      .single();

    if (error || !client) {
      logger.error('Portal validation failed:', {
        error: error
          ? {
              message: error.message,
              code: error.code,
            }
          : 'Client not found',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Portal is always enabled - removed portal_enabled check
    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        portal_settings: client.portal_settings,
      },
    });
  } catch (error) {
    logger.error('Portal validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}