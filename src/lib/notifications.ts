import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

export type NotificationType =
  | 'autopilot_plan_ready'
  | 'autopilot_published'
  | 'autopilot_failed'
  | 'ad_copy_ready'
  | 'drive_sync_new_creative'
  | 'drive_sync_failed';

export interface CreateNotificationParams {
  userId: string;
  clientId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Creates one in-app notification row. Non-fatal by design — a notification
 * failing to write should never break the autopilot run it's reporting on,
 * so callers should not need to wrap this in their own try/catch.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const { error } = await admin.from('agency_notifications').insert({
      user_id: params.userId,
      client_id: params.clientId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      metadata: params.metadata ?? {},
    });
    if (error) {
      logger.error('Failed to create notification:', error);
    }
  } catch (err) {
    logger.error('Failed to create notification:', err);
  }
}
