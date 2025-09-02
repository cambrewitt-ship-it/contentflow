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

    // Log what we're sending to LATE
    const requestBody = {
      content: caption,
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
      throw new Error('Failed to schedule post');
    }
    
    const lateData = await lateResponse.json();
    console.log('🔧 STEP 10 - LATE API RESPONSE:');
    console.log('  - Response status:', lateResponse.status);
    console.log('  - Response keys:', Object.keys(lateData));
    
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
    
    // Get the post data from planner_scheduled_posts to preserve image_url
    const { data: plannerPost, error: fetchError } = await supabase
      .from('planner_scheduled_posts')
      .select('image_url')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching planner post:', fetchError);
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
        image_url: plannerPost?.image_url || null // Preserve image_url from planner post
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
