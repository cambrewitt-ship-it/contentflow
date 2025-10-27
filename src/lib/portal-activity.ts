import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Action types for portal activity logging
export type PortalActionType = 
  | 'portal_access'
  | 'content_upload'
  | 'approval_view'
  | 'calendar_view'
  | 'token_validation_failed'
  | 'portal_access_denied'
  | 'portal_access_granted';

interface LogPortalActivityParams {
  clientId: string | null;
  action: PortalActionType;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Logs portal activity to the portal_activity table
 * Handles errors gracefully to prevent breaking the main application flow
 */
export async function logPortalActivity({
  clientId,
  action,
  metadata = {},
  ipAddress = null,
  userAgent = null
}: LogPortalActivityParams): Promise<void> {
  try {
    // Only proceed if we have the required environment variables
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.warn('⚠️ Portal activity logging skipped: Missing Supabase environment variables');
      return;
    }

    // Create Supabase client with service role for logging
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Prepare the activity record
    const activityRecord = {
      client_id: clientId,
      activity_type: action,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        ...(ipAddress && { ip_address: ipAddress }),
        ...(userAgent && { user_agent: userAgent })
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    };

    // Insert the activity record
    const { error } = await supabase
      .from('portal_activity')
      .insert(activityRecord);

    if (error) {
      logger.error('❌ Failed to log portal activity:', {
        error: error.message,
        code: error.code,
        action,
        clientId
      });
    }
  } catch (error) {
    // Log the error but don't throw it to prevent breaking the main flow
    logger.error('💥 Error in logPortalActivity:', {
      error: error instanceof Error ? error.message : String(error),
      action,
      clientId
    });
  }
}

/**
 * Helper function to extract IP address from request headers
 * Handles various proxy configurations
 */
export function extractClientIP(request: Request): string | null {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    // Check Cloudflare first (most reliable)
    if (cfConnectingIP) {
      return cfConnectingIP.split(',')[0].trim();
    }
    
    // Check x-real-ip
    if (realIP) {
      return realIP.split(',')[0].trim();
    }
    
    // Check x-forwarded-for (may contain multiple IPs)
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return null;
  } catch (error) {
    logger.warn('⚠️ Failed to extract client IP:', error);
    return null;
  }
}

/**
 * Helper function to extract user agent from request headers
 */
export function extractUserAgent(request: Request): string | null {
  try {
    return request.headers.get('user-agent');
  } catch (error) {
    logger.warn('⚠️ Failed to extract user agent:', error);
    return null;
  }
}

/**
 * Convenience function for logging portal access
 */
export async function logPortalAccess(
  clientId: string | null,
  request: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = extractClientIP(request);
  const userAgent = extractUserAgent(request);
  
  await logPortalActivity({
    clientId,
    action: 'portal_access',
    metadata,
    ipAddress,
    userAgent
  });
}

/**
 * Convenience function for logging content uploads
 */
export async function logContentUpload(
  clientId: string,
  request: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = extractClientIP(request);
  const userAgent = extractUserAgent(request);
  
  await logPortalActivity({
    clientId,
    action: 'content_upload',
    metadata,
    ipAddress,
    userAgent
  });
}

/**
 * Convenience function for logging approval views
 */
export async function logApprovalView(
  clientId: string,
  request: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = extractClientIP(request);
  const userAgent = extractUserAgent(request);
  
  await logPortalActivity({
    clientId,
    action: 'approval_view',
    metadata,
    ipAddress,
    userAgent
  });
}

/**
 * Convenience function for logging calendar views
 */
export async function logCalendarView(
  clientId: string,
  request: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ipAddress = extractClientIP(request);
  const userAgent = extractUserAgent(request);
  
  await logPortalActivity({
    clientId,
    action: 'calendar_view',
    metadata,
    ipAddress,
    userAgent
  });
}
