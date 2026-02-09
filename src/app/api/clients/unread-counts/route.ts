import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { handleApiError, handleDatabaseError } from '@/lib/apiErrorHandler';
import { requireAuth } from '@/lib/authHelpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

/**
 * GET /api/clients/unread-counts
 * 
 * Returns unread notification counts for all of the user's clients.
 * A notification is "unread" if it was created after the user's last view of that client's activity hub.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorize the user
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user } = authResult;
    const userId = user.id;

    logger.info('📊 Fetching unread counts for user:', { userId });

    // Get all clients for this user
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId);

    if (clientsError) {
      return handleDatabaseError(
        clientsError,
        {
          route: '/api/clients/unread-counts',
          operation: 'fetch_clients',
          userId
        },
        'Failed to fetch clients'
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        unreadCounts: {}
      });
    }

    const clientIds = clients.map(c => c.id);

    // Get last viewed timestamps for all clients
    const { data: activityViews, error: viewsError } = await supabase
      .from('client_activity_views')
      .select('client_id, last_viewed_at')
      .eq('user_id', userId)
      .in('client_id', clientIds);

    if (viewsError) {
      logger.error('Error fetching activity views:', viewsError);
      // Continue without views - all activities will be counted as unread
    }

    // Build a map of client_id -> last_viewed_at
    const lastViewedMap: Record<string, string | null> = {};
    clientIds.forEach(id => {
      lastViewedMap[id] = null; // Default: never viewed
    });

    if (activityViews) {
      activityViews.forEach(view => {
        lastViewedMap[view.client_id] = view.last_viewed_at;
      });
    }

    // For each client, count unread notifications
    const unreadCounts: Record<string, number> = {};

    for (const clientId of clientIds) {
      const lastViewed = lastViewedMap[clientId];
      let unreadCount = 0;

      // Count unread activities from different sources
      // 1. Client uploads
      const uploadsFilter = supabase
        .from('client_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      
      if (lastViewed) {
        uploadsFilter.gt('created_at', lastViewed);
      }
      
      const { count: uploadsCount, error: uploadsError } = await uploadsFilter;
      
      if (uploadsError) {
        logger.error(`Error counting uploads for client ${clientId}:`, uploadsError);
      } else {
        unreadCount += uploadsCount || 0;
      }

      // 2. Post approvals (approved posts that haven't been viewed)
      const approvalsFilter = supabase
        .from('calendar_scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('approval_status', 'approved');
      
      if (lastViewed) {
        approvalsFilter.gt('updated_at', lastViewed);
      }
      
      const { count: approvalsCount, error: approvalsError } = await approvalsFilter;
      
      if (approvalsError) {
        logger.error(`Error counting approvals for client ${clientId}:`, approvalsError);
      } else {
        unreadCount += approvalsCount || 0;
      }

      // 3. Portal activity (portal access, uploads via portal, etc.)
      const portalFilter = supabase
        .from('portal_activity')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('activity_type', ['portal_access', 'content_upload', 'approval_view']);
      
      if (lastViewed) {
        portalFilter.gt('created_at', lastViewed);
      }
      
      const { count: portalCount, error: portalError } = await portalFilter;
      
      if (portalError) {
        logger.error(`Error counting portal activity for client ${clientId}:`, portalError);
      } else {
        unreadCount += portalCount || 0;
      }

      unreadCounts[clientId] = unreadCount;
    }

    logger.info('✅ Unread counts calculated:', unreadCounts);

    return NextResponse.json({
      success: true,
      unreadCounts
    });

  } catch (error) {
    return handleApiError(error, {
      route: '/api/clients/unread-counts',
      operation: 'get_unread_counts'
    });
  }
}
