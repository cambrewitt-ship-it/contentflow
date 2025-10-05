import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('🔧 STEP 6 - LATE API ROUTE RECEIVED:');
    console.log('  - Request body keys:', Object.keys(body));
    console.log('  - Full request body:', JSON.stringify(body, null, 2));
    
    // Check for required fields
    if (!body.postId || body.caption === undefined || body.caption === null || !body.lateMediaUrl) {
      console.error('Missing required fields:', {
        postId: body.postId,
        caption: body.caption,
        captionType: typeof body.caption,
        lateMediaUrl: !!body.lateMediaUrl
      });
      console.error('lateMediaUrl value:', body.lateMediaUrl);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate caption content - reject empty captions
    if (!body.caption || body.caption.trim() === '') {
      console.error('Empty caption rejected:', {
        caption: body.caption,
        captionType: typeof body.caption,
        captionLength: body.caption?.length
      });
      return NextResponse.json(
        { error: 'Caption/content is required for social media posts' },
        { status: 400 }
      );
    }
    
    const { 
      postId, 
      caption, 
      lateMediaUrl, 
      scheduledDateTime, 
      selectedAccounts,
      clientId 
    } = body;
    
    console.log('🔧 STEP 7 - EXTRACTED VALUES:');
    console.log('  - postId:', postId);
    console.log('  - caption:', caption?.substring(0, 50) + '...');
    console.log('  - lateMediaUrl:', lateMediaUrl);
    console.log('  - scheduledDateTime:', scheduledDateTime);
    console.log('  - selectedAccounts:', selectedAccounts);
    console.log('  - clientId:', clientId);
    
    // Build platforms array for LATE API
    const platforms = selectedAccounts.map((account: { platform: string; _id: string }) => ({
      platform: account.platform,
      accountId: account._id
    }));
    
    // Parse and format the scheduled date/time
    const [datePart, timePart] = scheduledDateTime.split('T');
    
    // Use the user's actual local time directly
    const localDateTime = `${datePart}T${timePart}`;
    
    console.log('🔧 STEP 8 - DATETIME PARSING:');
    console.log('  - Input scheduledDateTime:', scheduledDateTime);
    console.log('  - Split datePart:', datePart);
    console.log('  - Split timePart:', timePart);
    console.log('  - Reconstructed localDateTime:', localDateTime);
    console.log('  - Using Pacific/Auckland timezone as specified');

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
    };

    console.log('🔧 STEP 9 - FINAL LATE API PAYLOAD:');
    console.log('  - Payload keys:', Object.keys(requestBody));
    console.log('  - scheduledFor value:', requestBody.scheduledFor);
    console.log('  - timezone value:', requestBody.timezone);
    console.log('  - About to send to: https://getlate.dev/api/v1/posts');

    // Create post on LATE API
    const lateResponse = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!lateResponse.ok) {
      const error = await lateResponse.text();
      console.error('LATE API error:', error);
      console.error('LATE API status:', lateResponse.status);
      console.error('LATE API headers:', Object.fromEntries(lateResponse.headers.entries()));
      throw new Error(`LATE API error (${lateResponse.status}): ${error}`);
    }
    
    const lateData = await lateResponse.json();
    console.log('🔧 STEP 10 - LATE API RESPONSE:');
    console.log('  - Response status:', lateResponse.status);
    console.log('  - Response keys:', Object.keys(lateData));
    
    // Extract the LATE post ID from the nested post object
    const latePostId = lateData.post?._id || lateData.post?.id || lateData._id || lateData.id;
    console.log('Extracted LATE post ID:', latePostId);
    
    // Update the calendar_scheduled_posts table with LATE information
    const { error: updateError } = await supabase
      .from('calendar_scheduled_posts')
      .update({ 
        late_status: 'scheduled',
        late_post_id: latePostId,
        platforms_scheduled: selectedAccounts.map((a: { platform: string }) => a.platform)
      })
      .eq('id', postId);
    
    if (updateError) {
      console.error('Database update error:', updateError);
    }
    
    // Get the post data from calendar_scheduled_posts to preserve image_url
    const { data: calendarPost, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('image_url')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching calendar post:', fetchError);
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
      console.error('Schedule save error:', scheduleError);
    }
    
    // At the END of the function, make sure to return:
    return NextResponse.json({ 
      success: true, 
      latePostId: latePostId,
      late_post_id: latePostId,
      id: latePostId
    });
  } catch (error) {
    console.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}
