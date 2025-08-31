import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: Request) {
  try {
    const { 
      postId, 
      caption, 
      lateMediaUrl, 
      scheduledDateTime, 
      selectedAccounts,
      clientId 
    } = await request.json();
    
    console.log('Scheduling post:', { postId, selectedAccounts, scheduledDateTime });
    
    // Build platforms array for LATE API
    const platforms = selectedAccounts.map((account: { platform: string; _id: string }) => ({
      platform: account.platform,
      accountId: account._id
    }));
    
    // Parse the scheduled date and time properly
    const scheduledDate = new Date(scheduledDateTime);
    console.log('Original scheduled date:', scheduledDate.toISOString());
    console.log('NZ local string:', scheduledDate.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }));

    // Format for LATE API - use the local date/time without Z
    const year = scheduledDate.getFullYear();
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');

    const lateScheduledFor = `${year}-${month}-${day}T${hours}:${minutes}:00`;
    console.log('Formatted for LATE:', lateScheduledFor);

    // Create post on LATE API
    const lateResponse = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: caption,
        platforms: platforms,
        scheduledFor: lateScheduledFor,  // Use formatted local time
        timezone: 'Pacific/Auckland',     // Explicitly set NZ timezone
        mediaItems: [{
          type: 'image',
          url: lateMediaUrl
        }]
      })
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
        scheduled_time: scheduledFor,
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
