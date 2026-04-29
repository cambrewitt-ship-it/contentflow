import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { checkSocialMediaPostingPermission, trackPostCreation } from '@/lib/subscriptionMiddleware';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { sendAutopilotPublishedEmail } from '@/lib/email';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LATE_API_KEY = process.env.LATE_API_KEY;

async function uploadToLate(mediaUrl: string): Promise<string> {
  // Fetch the image from our CDN
  const imageRes = await fetch(mediaUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch media: ${imageRes.status}`);
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
  const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  formData.append('files', blob, `image.${extension}`);

  const res = await fetch('https://getlate.dev/api/v1/media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LATE_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LATE media upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  // LATE returns the CDN URL in various shapes
  return (
    data.url ||
    data.mediaUrl ||
    data.lateMediaUrl ||
    (Array.isArray(data) && data[0]?.url) ||
    null
  );
}

async function scheduleViaLate(params: {
  caption: string;
  lateMediaUrl: string;
  scheduledFor: string;
  timezone: string;
  platforms: Array<{ platform: string; accountId: string }>;
}): Promise<string | null> {
  const body = {
    content: params.caption.trim() || 'Posted via ContentFlow',
    platforms: params.platforms,
    scheduledFor: params.scheduledFor,
    timezone: params.timezone,
    mediaItems: [{ type: 'image', url: params.lateMediaUrl }],
  };

  const res = await fetch('https://getlate.dev/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LATE schedule failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id || data.postId || data.latePostId || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Subscription check
    const permission = await checkSocialMediaPostingPermission(request);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: permission.error }, { status: 403 });
    }

    const admin = createSupabaseAdmin();

    // Verify plan ownership
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, client_id, status')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    if (plan.user_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    // Get client timezone + late_profile_id
    const { data: client } = await admin
      .from('clients')
      .select('timezone, late_profile_id')
      .eq('id', plan.client_id)
      .single();

    const clientTimezone = client?.timezone || 'Pacific/Auckland';
    const lateProfileId = client?.late_profile_id;

    if (!lateProfileId) {
      return NextResponse.json(
        { success: false, error: 'No social accounts connected. Connect accounts in client settings first.' },
        { status: 400 }
      );
    }

    // Fetch connected LATE accounts
    const accountsRes = await fetch(
      `https://getlate.dev/api/v1/accounts?profileId=${lateProfileId}`,
      { headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] };
    const connectedAccounts: Array<{ _id: string; platform: string }> = accountsData.accounts || [];

    if (connectedAccounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No connected social accounts found.' },
        { status: 400 }
      );
    }

    const platforms = connectedAccounts.map(a => ({ platform: a.platform, accountId: a._id }));

    // Fetch approved posts
    const { data: approvedPosts } = await admin
      .from('calendar_scheduled_posts')
      .select('id, caption, image_url, scheduled_date, scheduled_time, autopilot_status')
      .eq('autopilot_plan_id', planId)
      .eq('autopilot_status', 'approved');

    if (!approvedPosts || approvedPosts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No approved posts found. Approve posts before publishing.' },
        { status: 400 }
      );
    }

    let published = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const post of approvedPosts) {
      try {
        if (!post.image_url) throw new Error('No image URL for post');

        // Upload media to LATE CDN
        const lateMediaUrl = await uploadToLate(post.image_url);
        if (!lateMediaUrl) throw new Error('LATE upload returned no URL');

        // Build scheduledFor string
        const scheduledFor = `${post.scheduled_date}T${post.scheduled_time || '12:00:00'}`;

        // Schedule via LATE
        const latePostId = await scheduleViaLate({
          caption: post.caption || '',
          lateMediaUrl,
          scheduledFor,
          timezone: clientTimezone,
          platforms,
        });

        // Update post record
        await admin
          .from('calendar_scheduled_posts')
          .update({
            late_post_id: latePostId,
            late_status: 'scheduled',
            autopilot_status: 'approved',
            platforms_scheduled: connectedAccounts.map(a => a.platform),
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        await trackPostCreation(user.id);
        published++;
      } catch (postErr) {
        const msg = postErr instanceof Error ? postErr.message : String(postErr);
        logger.error(`Failed to publish autopilot post ${post.id}:`, postErr);
        errors.push(`Post ${post.id}: ${msg}`);

        await admin
          .from('calendar_scheduled_posts')
          .update({ late_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', post.id);

        failed++;
      }
    }

    // Update plan status
    const newStatus = published > 0 ? 'published' : plan.status;
    const { data: updatedPlan } = await admin
      .from('autopilot_plans')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', planId)
      .select('*')
      .single();

    // Send published notification email (non-fatal)
    if (published > 0) {
      try {
        const { data: userProfile } = await admin
          .from('user_profiles')
          .select('full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: clientRow } = await admin
          .from('clients')
          .select('name, autopilot_plans!inner(plan_week_start)')
          .eq('id', plan.client_id)
          .maybeSingle();

        if (userProfile?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://content-manager.io';
          const weekStart = (clientRow as { autopilot_plans?: Array<{ plan_week_start: string }> } | null)
            ?.autopilot_plans?.[0]?.plan_week_start || '';
          const weekStartFormatted = weekStart
            ? new Date(weekStart + 'T00:00:00').toLocaleDateString('en-NZ', {
                day: 'numeric', month: 'long', year: 'numeric',
              })
            : '';

          await sendAutopilotPublishedEmail({
            to: userProfile.email,
            userName: userProfile.full_name || 'there',
            clientName: (clientRow as { name?: string } | null)?.name || plan.client_id,
            publishedCount: published,
            weekStart: weekStartFormatted,
            autopilotLink: `${baseUrl}/dashboard/client/${plan.client_id}/autopilot`,
          });
        }
      } catch (emailErr) {
        logger.error('Failed to send autopilot published email:', emailErr);
      }
    }

    return NextResponse.json({ success: true, published, failed, errors, plan: updatedPlan });
  } catch (error) {
    logger.error('POST /api/autopilot/plans/[planId]/publish error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
