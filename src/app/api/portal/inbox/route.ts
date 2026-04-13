import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

// GET /api/portal/inbox?token=xxx
// Returns uploads with status 'unassigned' or 'pending' for a client.
// Used by both legacy portal token and party tokens.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { clientId } = resolved;

    const { data: uploads, error } = await supabase
      .from('client_uploads')
      .select(`
        id,
        file_name,
        file_type,
        file_size,
        file_url,
        status,
        notes,
        target_date,
        created_at,
        updated_at,
        uploaded_by_party:uploaded_by_party_id (
          id,
          name,
          role,
          color
        )
      `)
      .eq('client_id', clientId)
      .in('status', ['pending', 'unassigned'])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching inbox uploads:', error);
      return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }

    return NextResponse.json({ uploads: uploads ?? [] });
  } catch (error) {
    logger.error('Portal inbox GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
