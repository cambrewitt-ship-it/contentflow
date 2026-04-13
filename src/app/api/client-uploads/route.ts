import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

// GET /api/client-uploads?client_id=xxx&status=unassigned,pending
// Agency-authenticated route to view uploads for a client.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');
    const statusParam = searchParams.get('status');

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    let query = supabase
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
      .eq('client_id', client_id)
      .order('created_at', { ascending: false });

    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim());
      query = query.in('status', statuses);
    }

    const { data: uploads, error } = await query;

    if (error) {
      logger.error('Error fetching client uploads:', error);
      return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 });
    }

    return NextResponse.json({ uploads: uploads ?? [] });
  } catch (error) {
    logger.error('Client uploads GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
