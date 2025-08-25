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
    const platforms = selectedAccounts.map((account: any) => ({
      platform: account.platform,
      accountId: account._id
    }));
    
    // Format the scheduled time
    const scheduledFor = new Date(scheduledDateTime).toISOString();
    
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
        scheduledFor: scheduledFor,
        timezone: 'UTC',
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
    console.log('LATE post created:', lateData);
    
    // Update post status in our database
    const { error: updateError } = await supabase
      .from('posts')
      .update({ 
        status: 'scheduled',
        late_media_url: lateMediaUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId);
    
    if (updateError) {
      console.error('Database update error:', updateError);
    }
    
    // Save to scheduled_posts table
    const { error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        client_id: clientId,
        post_id: postId,
        scheduled_time: scheduledFor,
        account_ids: selectedAccounts.map((a: any) => a._id),
        status: 'scheduled',
        late_post_id: lateData.id || lateData._id
      });
    
    if (scheduleError) {
      console.error('Schedule save error:', scheduleError);
    }
    
    return NextResponse.json({ 
      success: true, 
      latePostId: lateData.id || lateData._id 
    });
  } catch (error) {
    console.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}
