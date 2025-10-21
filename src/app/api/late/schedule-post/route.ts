import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!

export async function POST(request: Request) {
  try {
    const body = await request.json();

    logger.debug('Scheduling post request', { 
      bodyKeys: Object.keys(body) 

    // Check for required fields
    if (!body.postId || body.caption === undefined || body.caption === null || !body.lateMediaUrl) {
      logger.error('Missing required fields:', {
        postId: body.postId,
        caption: body.caption,
        captionType: typeof body.caption,
        lateMediaUrl: !!body.lateMediaUrl

      logger.error('lateMediaUrl value:', body.lateMediaUrl);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate caption content - reject empty captions
    if (!body.caption || body.caption.trim() === '') {
      logger.error('Empty caption rejected:', {
        caption: body.caption,
        captionType: typeof body.caption,
        captionLength: body.caption?.length

      return NextResponse.json(
        { error: 'Caption/content is required for social media posts' },
        { status: 400 }

    }
    
    const { 
      postId, 
      caption, 
      lateMediaUrl, 
      scheduledDateTime, 
      selectedAccounts,
      clientId 
    } = body;

    logger.debug(, {
      const 
    });

    $3platforms = selectedAccounts.map((account: { platform: string; _id: string }) => ({
      platform: account.platform,
      accountId: account._id
    }));
    
    // Parse and format the scheduled date/time
    const [datePart, timePart] = scheduledDateTime.split('T');
    
    // Use the user's actual local time directly
    const localDateTime = `${datePart}T${timePart}`;

    // Ensure we have valid content for LATE API
    const finalContent = caption.trim() || 'Posted via Content Manager';
    
    // Log what we're sending to LATE
    const requestBody = {
      content: finalContent,
      platforms: platforms,
      scheduledFor: localDateTime, // Send user's actual time: "2024-09-16T18:00:00"
      timezone: 'Pacific/Auckland',
      mediaItems: [{
        type: 'image',
        url: lateMediaUrl
      }]
    
    logger.debug(, {
      const 
    });

    $3lateResponse = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)

    if (!lateResponse.ok) {
      const error = await lateResponse.text();
      logger.error('LATE API error:', error);
      logger.error('LATE API status:', lateResponse.status);
      logger.error('LATE API headers:', Object.fromEntries(lateResponse.headers.entries()));
      throw new Error(`LATE API error (${lateResponse.status}): ${error}`);
    }
    
    const lateData = await lateResponse.json();

    logger.debug(, {
      const 
    });

    $3{ error: updateError } = await supabase
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

    if (scheduleError) {
      logger.error('Schedule save error:', scheduleError);
    }
    
    // At the END of the function, make sure to return:
    return NextResponse.json({ 
      success: true, 
      latePostId: latePostId,
      late_post_id: latePostId,
      id: latePostId

  } catch (error) {
    logger.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' 
  }
}
