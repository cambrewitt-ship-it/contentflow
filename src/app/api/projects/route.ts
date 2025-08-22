import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_id, name, description } = body;

    if (!client_id || !name) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: client_id and name are required' 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Create new project
    const { data: project, error } = await supabase
      .from('projects')
      .insert([{
        client_id,
        name,
        description: description || '',
        status: 'active',
        created_at: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error creating project:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to create project' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      project 
    });

  } catch (error: unknown) {
    console.error('💥 Error in projects POST route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ 
        success: false, 
        error: 'clientId query parameter is required' 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch projects for the client
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching projects:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to fetch projects' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      projects: projects || [] 
    });

  } catch (error: unknown) {
    console.error('💥 Error in projects GET route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
