import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { handleApiError, handleDatabaseError } from '@/lib/apiErrorHandler';
import { requireAuth } from '@/lib/authHelpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

/**
 * POST /api/clients/[clientId]/mark-viewed
 * 
 * Marks all activities for this client as viewed by updating the last_viewed_at timestamp.
 * This clears the unread notification count for this client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId } = await params;

    // Authorize the user and verify client access
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user } = authResult;
    const userId = user.id;

    logger.info('👁️ Marking client activities as viewed:', { userId, clientId });

    // Verify user has access to this client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    if (client.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to client' },
        { status: 403 }
      );
    }

    // Upsert the activity view record (insert or update if exists)
    const now = new Date().toISOString();
    const { data: activityView, error: upsertError } = await supabase
      .from('client_activity_views')
      .upsert(
        {
          user_id: userId,
          client_id: clientId,
          last_viewed_at: now,
          updated_at: now
        },
        {
          onConflict: 'user_id,client_id',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (upsertError) {
      return handleDatabaseError(
        upsertError,
        {
          route: '/api/clients/[clientId]/mark-viewed',
          operation: 'upsert_activity_view',
          userId,
          clientId
        },
        'Failed to mark activities as viewed'
      );
    }

    logger.info('✅ Client activities marked as viewed:', {
      userId,
      clientId,
      timestamp: now
    });

    return NextResponse.json({
      success: true,
      lastViewedAt: now
    });

  } catch (error) {
    return handleApiError(error, {
      route: '/api/clients/[clientId]/mark-viewed',
      operation: 'mark_viewed'
    });
  }
}
