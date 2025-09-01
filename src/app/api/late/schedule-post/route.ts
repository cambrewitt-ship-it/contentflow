import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    // Check for required fields
    if (!body.postId || !body.caption || !body.lateMediaUrl) {
      console.error('Missing required fields:', {
        postId: body.postId,
        caption: !!body.caption,
        lateMediaUrl: !!body.lateMediaUrl
      });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const { 
      postId, 
      caption, 
      lateMediaUrl, 
      scheduledDateTime, 
      selectedAccounts,
      clientId 
    } = body;
    
    console.log('Scheduling post:', { postId, selectedAccounts, scheduledDateTime });
    
    // Build platforms array for LATE API
    const platforms = selectedAccounts.map((account: { platform: string; _id: string }) => ({
      platform: account.platform,
      accountId: account._id
    }));
    
    // Parse and format the scheduled date/time
    const [datePart, timePart] = scheduledDateTime.split('T');
    
    // Create a Date object and adjust for LATE's timezone interpretation
    const localDateTime = `${datePart}T${timePart}`;
    
    // LATE is interpreting our local time as UTC, so we need to add 24 hours
    // to compensate for the timezone difference (1 full day)
    const adjustedDate = new Date(localDateTime);
    adjustedDate.setHours(adjustedDate.getHours() + 24);
    const adjustedDateTime = adjustedDate.toISOString().slice(0, 19);
    
    console.log('Input scheduledDateTime:', scheduledDateTime);
    console.log('Local NZ time:', localDateTime);
    console.log('Adjusted for LATE interpretation:', adjustedDateTime);
    console.log('Added 24 hours (1 full day) to compensate for timezone');
    
    const lateScheduledFor = adjustedDateTime;

    // Log what we're sending to LATE
    const requestBody = {
      content: caption,
      platforms: platforms,
      scheduledFor: lateScheduledFor,
      timezone: 'Pacific/Auckland',
      mediaItems: [{
        type: 'image',
        url: lateMediaUrl
      }]
    };

    console.log('Sending to LATE:', JSON.stringify(requestBody, null, 2));

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
      throw new Error('Failed to schedule post');
    }
    
    const lateData = await lateResponse.json();
    console.log('LATE API response data:', lateData);
    
    // Extract the LATE post ID from the nested post object
    const latePostId = lateData.post?._id || lateData.post?.id || lateData._id || lateData.id;
    console.log('Extracted LATE post ID:', latePostId);
    
    // Update the planner_scheduled_posts table with LATE information
    const { error: updateError } = await supabase
      .from('planner_scheduled_posts')
      .update({ 
        late_status: 'scheduled',
        late_post_id: latePostId,
        platforms_scheduled: selectedAccounts.map((a: { platform: string }) => a.platform)
      })
      .eq('id', postId);
    
    if (updateError) {
      console.error('Database update error:', updateError);
    }
    
    // Also save to scheduled_posts table with LATE post ID
    const { error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        client_id: clientId,
        post_id: postId,
        scheduled_time: lateScheduledFor,
        account_ids: selectedAccounts.map((a: { _id: string }) => a._id),
        status: 'scheduled',
        late_post_id: latePostId
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
