import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { sendApprovalRequestEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const NotifySchema = z.object({
  post_id: z.string().uuid(),
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
  event: z.enum(['step_completed', 'changes_requested', 'comment_added']),
  target_party_id: z.string().uuid(),
  client_name: z.string(),
  step_label: z.string().optional().nullable(),
});

// POST /api/notifications/send
// Internal route (called by approve-step and agency-step routes) to dispatch notifications.
// Only supports email for now. notification_config is read from portal_parties.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = NotifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { post_id, post_type, event, target_party_id, client_name, step_label } = parsed.data;

    // Fetch target party notification config
    const { data: party } = await supabase
      .from('portal_parties')
      .select('id, name, portal_token, notification_channel, notification_config')
      .eq('id', target_party_id)
      .maybeSingle();

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    if (!party.notification_channel) {
      // No notification configured for this party — silently succeed
      return NextResponse.json({ success: true, skipped: true, reason: 'no_channel_configured' });
    }

    // Fetch post details
    const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: post } = await supabase
      .from(postTable)
      .select('caption, image_url, scheduled_date')
      .eq('id', post_id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Route to the correct channel
    if (party.notification_channel === 'email') {
      const config = party.notification_config as Record<string, unknown>;
      const email = config?.email as string | undefined;

      if (!email) {
        logger.warn('Party has email channel but no email in config', { partyId: party.id });
        return NextResponse.json({ success: false, reason: 'no_email_in_config' });
      }

      const result = await sendApprovalRequestEmail({
        to: email,
        partyName: party.name,
        clientName: client_name,
        postCaption: post.caption,
        postImageUrl: post.image_url ?? null,
        portalToken: party.portal_token,
        scheduledDate: post.scheduled_date ?? null,
        stepLabel: step_label ?? null,
      });

      if (!result.success) {
        logger.error('Failed to send approval email', { error: result.error });
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, channel: 'email' });
    }

    // Future channels (slack, teams) — schema supports them but not yet implemented
    logger.info('Notification channel not yet implemented', {
      channel: party.notification_channel,
      partyId: party.id,
    });

    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `channel_${party.notification_channel}_not_implemented`,
    });
  } catch (error) {
    logger.error('Notifications send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
