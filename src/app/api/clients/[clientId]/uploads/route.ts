import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Get client uploads (content inbox)
    const { data: uploads, error: uploadsError } = await supabase
      .from('client_uploads')
      .select(`
        id,
        client_id,
        project_id,
        file_name,
        file_type,
        file_size,
        file_url,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (uploadsError) {
      console.error('Error fetching client uploads:', uploadsError);
      return NextResponse.json(
        { error: 'Failed to fetch uploads' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uploads: uploads || []
    });

  } catch (error) {
    console.error('Client uploads error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
