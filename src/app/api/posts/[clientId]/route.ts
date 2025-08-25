import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientId = params.clientId;
    console.log('Fetching posts for client:', clientId);
    
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Posts fetched:', data?.length || 0);
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
