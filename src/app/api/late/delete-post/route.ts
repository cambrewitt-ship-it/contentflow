import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latePostId = searchParams.get('latePostId');
    
    logger.info('🗑️ DELETE request received for latePostId:', latePostId);
    
    if (!latePostId) {
      logger.error('❌ No latePostId provided');
      return NextResponse.json({ error: 'No post ID provided' }, { status: 400 });
    }

    if (!process.env.LATE_API_KEY) {
      logger.error('❌ LATE_API_KEY not configured');
      return NextResponse.json({ error: 'LATE API key not configured' }, { status: 500 });
    }

    // Delete from LATE API
    logger.info('📡 Calling LATE API to delete post:', latePostId);
    const response = await fetch(`https://getlate.dev/api/v1/posts/${latePostId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info('📡 LATE API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ LATE delete error (status', response.status, '):', errorText);
      return NextResponse.json({ 
        error: 'Failed to delete from LATE',
        status: response.status,
        details: errorText 
      }, { status: response.status });
    }

    const responseData = await response.json().catch(() => ({}));
    logger.info('✅ Successfully deleted post from LATE:', latePostId);
    logger.info('Response data:', responseData);

    return NextResponse.json({ 
      success: true, 
      latePostId,
      message: 'Post deleted successfully from LATE'
    });
    
  } catch (error) {
    logger.error('💥 Error deleting post from LATE:', error);
    return NextResponse.json({ 
      error: 'Failed to delete post',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
