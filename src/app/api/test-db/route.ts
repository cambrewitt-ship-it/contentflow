import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET() {
  try {
    console.log('🧪 Test DB endpoint called');
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceRole: !!supabaseServiceRoleKey
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase environment variables',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created');

    // Test basic connection
    console.log('🔍 Testing database connection...');
    
    // Check if clients table exists and has data
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, late_profile_id')
      .limit(5);

    if (clientsError) {
      console.error('❌ Clients query error:', clientsError);
      return NextResponse.json({ 
        error: 'Database query failed',
        details: clientsError.message,
        code: clientsError.code,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    console.log('✅ Clients query successful');
    console.log('📋 Found clients:', clients);

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      clients: clients,
      totalClients: clients?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Test DB error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
