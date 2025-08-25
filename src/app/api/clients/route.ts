import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Fetching all clients...');

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Query all clients from the clients table
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, description, company_description, website_url, brand_tone, target_audience, industry, brand_keywords, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ Clients fetched successfully:', clients?.length || 0, 'clients found');

    return NextResponse.json({ 
      success: true,
      clients: clients || []
    });

  } catch (error: unknown) {
    console.error('💥 Error in get all clients route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
