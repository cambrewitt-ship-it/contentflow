import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { checkSocialMediaPostingPermission } from '@/lib/subscriptionMiddleware';
import { requireClientOwnership } from '@/lib/authHelpers';
import { markOnboardingStep } from '@/lib/onboardingHelpers';
import { toLateMediaItem, LateUploadError } from '@/lib/lateMedia';

// Carousel posts re-host each extra photo on LATE before scheduling
export const maxDuration = 300;

const PAST_DUE_BUFFER_MS = 60 * 1000;
// Platforms that reject posts without a photo or video
const MEDIA_REQUIRED_PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'pinterest']);

// Converts a wall-clock "YYYY-MM-DDTHH:mm[:ss]" in an IANA timezone to a UTC timestamp
function zonedLocalToUtcMs(localDateTime: string, timeZone: string): number {
  const asUtc = Date.parse(`${localDateTime}Z`);
  if (Number.isNaN(asUtc)) return NaN;
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(ms).map((p) => [p.type, Number(p.value)])
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - ms;
  };
  try {
    const guess = asUtc - offsetAt(asUtc);
    return asUtc - offsetAt(guess); // second pass settles DST boundaries
  } catch {
    return NaN; // unknown timezone
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check subscription permissions for social media posting
    const permissionCheck = await checkSocialMediaPostingPermission(request);
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();

    logger.debug('Scheduling post request', { 
      bodyKeys: Object.keys(body) 
    });

    const { 
      postId, 
      caption, 
      lateMediaUrl, 
      scheduledDateTime, 
      selectedAccounts,
      clientId 
    } = body;

    // Check for required fields. lateMediaUrl is optional: text-only posts (e.g. copy + an
    // article link) have no media.
    if (
      !postId ||
      caption === undefined ||
      caption === null
    ) {
      logger.error('Missing required fields:', {
        postId,
        caption,
        captionType: typeof caption,
        lateMediaUrl: !!lateMediaUrl
      });
      logger.error('lateMediaUrl value:', lateMediaUrl);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'clientId is required' },
        { status: 400 }
      );
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Validate caption content - reject empty captions
    if (!caption || caption.trim() === '') {
      logger.error('Empty caption rejected:', {
        caption,
        captionType: typeof caption,
        captionLength: caption?.length
      });
      return NextResponse.json(
        { error: 'Caption/content is required for social media posts' },
        { status: 400 }
      );
    }
    
    logger.debug('Selected accounts', {
      accountCount: Array.isArray(selectedAccounts) ? selectedAccounts.length : 0
    });

    if (!Array.isArray(selectedAccounts) || selectedAccounts.length === 0) {
      logger.error('No selected accounts provided');
      return NextResponse.json(
        { error: 'At least one social account must be selected' },
        { status: 400 }
      );
    }

    const { data: scheduledPost, error: scheduledPostError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id, media_urls')
      .eq('id', postId)
      .single();

    if (scheduledPostError && scheduledPostError.code !== 'PGRST116') {
      logger.error('Error verifying scheduled post ownership:', scheduledPostError);
      return NextResponse.json(
        { error: 'Failed to verify scheduled post ownership' },
        { status: 500 }
      );
    }

    if (!scheduledPost) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    if (scheduledPost.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!lateMediaUrl) {
      const mediaRequired = selectedAccounts.filter((account: { platform: string }) =>
        MEDIA_REQUIRED_PLATFORMS.has(String(account.platform).toLowerCase())
      );
      if (mediaRequired.length > 0) {
        return NextResponse.json(
          {
            error: `${mediaRequired.map((a: { platform: string }) => a.platform).join(', ')} posts need a photo or video. Add one, or post this text-only post to Facebook, LinkedIn or X instead.`,
          },
          { status: 400 }
        );
      }
    }

    const platforms = selectedAccounts.map((account: { platform: string; _id: string }) => ({
      platform: account.platform,
      accountId: account._id
    }));

    // Fetch client's timezone from database
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('timezone')
      .eq('id', clientId)
      .single();

    if (clientError) {
      logger.error('Error fetching client timezone:', clientError);
    }

    // Use client's timezone or default to Pacific/Auckland
    const clientTimezone = clientData?.timezone || 'Pacific/Auckland';

    // Parse and format the scheduled date/time
    const [datePart, timePart] = scheduledDateTime.split('T');
    const localDateTime = `${datePart}T${timePart}`; // Use user's local time directly

    // Ensure we have valid content for LATE API
    const finalContent = caption.trim() || 'Posted via Content Manager';

    // media_urls[0] is the cover, which the client already uploaded as lateMediaUrl
    const extraMediaUrls: string[] = Array.isArray(scheduledPost.media_urls) ? scheduledPost.media_urls.slice(1) : [];
    let extraMediaItems: Array<{ type: 'image' | 'video'; url: string }>;
    try {
      extraMediaItems = await Promise.all(extraMediaUrls.map((url) => toLateMediaItem(url)));
    } catch (mediaError) {
      logger.error('Failed to prepare carousel media for LATE:', mediaError);
      return NextResponse.json(
        {
          error: 'Failed to upload carousel photos',
          details: mediaError instanceof LateUploadError ? mediaError.details : undefined,
        },
        { status: mediaError instanceof LateUploadError ? mediaError.status : 500 }
      );
    }

    // LATE publishes a post whose time has passed inside the request itself, which for an
    // Instagram carousel takes over a minute and can outlive our request. Schedule those a
    // minute out instead so LATE queues them and responds straight away.
    const scheduledUtcMs = zonedLocalToUtcMs(localDateTime, clientTimezone);
    const isPastDue = !Number.isNaN(scheduledUtcMs) && scheduledUtcMs < Date.now() + PAST_DUE_BUFFER_MS;
    const scheduleTiming = isPastDue
      ? { scheduledFor: new Date(Date.now() + PAST_DUE_BUFFER_MS).toISOString(), timezone: 'UTC' }
      : { scheduledFor: localDateTime, timezone: clientTimezone }; // e.g. "2024-09-16T18:00:00"

    // Log what we're sending to LATE
    const requestBody = {
      content: finalContent,
      platforms: platforms,
      ...scheduleTiming,
      ...(lateMediaUrl
        ? {
            mediaItems: [
              {
                type: 'image',
                url: lateMediaUrl
              },
              ...extraMediaItems,
            ],
          }
        : {}),
    };

    logger.debug('LATE request body', {
      ...requestBody,
      platforms: requestBody.platforms
    });

    const lateResponse = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      logger.error('LATE API error:', errorText);
      logger.error('LATE API status:', lateResponse.status);
      logger.error('LATE API headers:', Object.fromEntries(lateResponse.headers.entries()));
      throw new Error(`LATE API error (${lateResponse.status}): ${errorText}`);
    }
    
    const lateData = await lateResponse.json();
    const latePostId = lateData.post?._id || lateData.id || lateData.postId || lateData.latePostId || null;

    logger.debug('LATE response data', {
      latePostId,
      lateData
    });

    // Save late_post_id and platforms to calendar_scheduled_posts. A post can be
    // scheduled to one platform at a time, so add to the platforms it's already
    // scheduled to rather than replacing them.
    const { data: existingPost } = await supabase
      .from('calendar_scheduled_posts')
      .select('platforms_scheduled')
      .eq('id', postId)
      .single();
    const platformsScheduled = Array.from(new Set([
      ...((existingPost?.platforms_scheduled as string[] | null) ?? []),
      ...selectedAccounts.map((a: { platform: string }) => a.platform),
    ].map((p: string) => p.toLowerCase())));

    const { error: updateError } = await supabase
      .from('calendar_scheduled_posts')
      .update({ 
        late_status: 'scheduled',
        late_post_id: latePostId,
        platforms_scheduled: platformsScheduled
      })
      .eq('id', postId);
    
    if (updateError) {
      logger.error('Database update error:', updateError);
    }
    
    // Get the post data from calendar_scheduled_posts to preserve image_url
    const { data: calendarPost, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('image_url')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      logger.error('Error fetching calendar post:', fetchError);
    }
    
    // Also save to scheduled_posts table with LATE post ID
    const { error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        client_id: clientId,
        post_id: postId,
        scheduled_time: localDateTime,
        account_ids: selectedAccounts.map((a: { _id: string }) => a._id),
        status: 'scheduled',
        late_post_id: latePostId,
        image_url: calendarPost?.image_url || null // Preserve image_url from calendar post
      });
    
    if (scheduleError) {
      logger.error('Schedule save error:', scheduleError);
    }
    
    // Mark onboarding: post successfully published to social media (fire-and-forget)
    markOnboardingStep(supabase, user.id, 'checklist_publish_post');

    // At the END of the function, make sure to return:
    return NextResponse.json({
      success: true,
      latePostId: latePostId,
      late_post_id: latePostId,
      id: latePostId,
      platforms_scheduled: platformsScheduled
    });

  } catch (error) {
    logger.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}
