import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latePostId = searchParams.get('latePostId');
    
    if (!latePostId) {
      return NextResponse.json({ error: 'No post ID provided' }, { status: 400 });
    }
    
    console.log('Deleting LATE post:', latePostId);
    
    // Delete from LATE API
    const response = await fetch(`https://getlate.dev/api/v1/posts/${latePostId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LATE delete error:', error);
      throw new Error('Failed to delete from LATE');
    }
    
    console.log('Successfully deleted from LATE');
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
