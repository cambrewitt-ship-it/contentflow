import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    console.log('🔍 Portal validation request:', { token });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate portal token and get client info
    console.log('🔍 Querying clients table with token:', token);
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🔍 Supabase Anon Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        portal_enabled,
        portal_settings
      `)
      .eq('portal_token', token)
      .single();

    console.log('🔍 Supabase query result:', { client, error });
    console.log('🔍 Error details:', error ? {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    } : 'No error');

    if (error || !client) {
      console.log('❌ Client not found or error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled for this client
    if (!client.portal_enabled) {
      console.log('❌ Portal disabled for client:', client.id);
      return NextResponse.json(
        { success: false, error: 'Portal access is disabled for this client' },
        { status: 401 }
      );
    }

    console.log('✅ Portal validation successful for client:', client.id);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        portal_settings: client.portal_settings
      }
    });

  } catch (error) {
    console.error('Portal validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}