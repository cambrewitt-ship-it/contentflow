import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { checkSocialMediaPostingPermission } from '@/lib/subscriptionMiddleware';
import { requireClientOwnership } from '@/lib/authHelpers';

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

    // Check for required fields
    if (
      !postId ||
      caption === undefined ||
      caption === null ||
      !lateMediaUrl
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
    const { supabase } = auth;

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
      .select('id, client_id')
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

    // Log what we're sending to LATE
    const requestBody = {
      content: finalContent,
      platforms: platforms,
      scheduledFor: localDateTime, // e.g. "2024-09-16T18:00:00"
      timezone: clientTimezone,
      mediaItems: [{
        type: 'image',
        url: lateMediaUrl
      }]
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
    const latePostId = lateData.id || lateData.postId || lateData.latePostId || null;

    logger.debug('LATE response data', {
      latePostId,
      lateData
    });

    // Save late_post_id and platforms to calendar_scheduled_posts
    const { error: updateError } = await supabase
      .from('calendar_scheduled_posts')
      .update({ 
        late_status: 'scheduled',
        late_post_id: latePostId,
        platforms_scheduled: selectedAccounts.map((a: { platform: string }) => a.platform)
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
    
    // At the END of the function, make sure to return:
    return NextResponse.json({ 
      success: true, 
      latePostId: latePostId,
      late_post_id: latePostId,
      id: latePostId
    });

  } catch (error) {
    logger.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}
