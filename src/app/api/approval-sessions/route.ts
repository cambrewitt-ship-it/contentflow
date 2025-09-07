import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ClientApprovalSession, CreateSessionRequest } from '@/types/approval';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create new approval session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { project_id, client_id, expires_in_days = 30 } = body;

    // Generate unique share token
    const share_token = crypto.randomUUID();
    
    // Calculate expiration date
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expires_in_days);

    const { data: session, error } = await supabase
      .from('client_approval_sessions')
      .insert({
        project_id,
        client_id,
        share_token,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating approval session:', error);
      return NextResponse.json(
        { error: 'Failed to create approval session' },
        { status: 500 }
      );
    }

    const share_url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approval/${share_token}`;

    return NextResponse.json({
      session,
      share_url
    });

  } catch (error) {
    console.error('❌ Error in approval sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get approval session by project_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const { data: sessions, error } = await supabase
      .from('client_approval_sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching approval sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions });

  } catch (error) {
    console.error('❌ Error in approval sessions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
