import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    console.log('🔍 Fetching client data for ID:', clientId);

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Query specific client from the clients table
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error('❌ Supabase query error:', error);
      
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({ 
          error: 'Client not found',
          details: `No client found with ID: ${clientId}`
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ Client fetched successfully:', client);

    return NextResponse.json({ 
      success: true,
      client: client
    });

  } catch (error: unknown) {
    console.error('💥 Error in get client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
