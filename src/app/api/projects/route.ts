import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(req: NextRequest) {
  console.log('🚀 Projects POST route called');
  
  try {
    const body = await req.json();
    const { client_id, name, description } = body;
    
    console.log('📥 Request body received:', { client_id, name, description: description ? 'provided' : 'not provided' });

    if (!client_id || !name) {
      console.log('❌ Missing required fields:', { client_id: !!client_id, name: !!name });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: client_id and name are required' 
      }, { status: 400 });
    }

    // Check environment variables
    console.log('🔧 Environment check:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey.length + ')' : 'MISSING'
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    // Test table access first
    console.log('🔍 Testing projects table access...');
    const { data: testData, error: testError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
    
    console.log('📊 Table test result:', { 
      testData: testData ? `Array with ${testData.length} items` : 'null', 
      testError: testError ? { code: testError.code, message: testError.message } : 'none' 
    });

    if (testError) {
      console.error('❌ Projects table access failed:', {
        code: testError.code,
        message: testError.message,
        details: testError.details,
        hint: testError.hint
      });
      
      // Check if table doesn't exist
      if (testError.code === '42P01') {
        return NextResponse.json({ 
          success: false, 
          error: 'Projects table does not exist. Please run the database setup script.',
          details: testError.message,
          code: testError.code
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Database table access failed',
        details: testError.message,
        code: testError.code
      }, { status: 500 });
    }

    console.log('✅ Projects table access successful, proceeding with insert');

    // Create new project
    const insertData = {
      client_id,
      name,
      description: description || '',
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    console.log('📝 Inserting project data:', insertData);
    
    const { data: project, error } = await supabase
      .from('projects')
      .insert([insertData])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error creating project:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to create project',
        details: error.details,
        code: error.code
      }, { status: 500 });
    }

    console.log('✅ Project created successfully:', project);

    return NextResponse.json({ 
      success: true, 
      project 
    });

  } catch (error: unknown) {
    console.error('💥 Unexpected error in projects POST route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  console.log('🚀 Projects GET route called');
  
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    
    console.log('🔍 Request parameters:', { 
      url: req.url,
      clientId: clientId,
      searchParams: Object.fromEntries(searchParams.entries())
    });

    if (!clientId) {
      console.log('❌ Missing clientId parameter');
      return NextResponse.json({ 
        success: false, 
        error: 'clientId query parameter is required' 
      }, { status: 400 });
    }

    // Check environment variables
    console.log('🔧 Environment check:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey.length + ')' : 'MISSING'
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    // Test table access first
    console.log('🔍 Testing projects table access...');
    const { data: testData, error: testError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
    
    console.log('📊 Table test result:', { 
      testData: testData ? `Array with ${testData.length} items` : 'null', 
      testError: testError ? { code: testError.code, message: testError.message } : 'none' 
    });

    if (testError) {
      console.error('❌ Projects table access failed:', {
        code: testError.code,
        message: testError.message,
        details: testError.details,
        hint: testError.hint
      });
      
      // Check if table doesn't exist
      if (testError.code === '42P01') {
        return NextResponse.json({ 
          success: false, 
          error: 'Projects table does not exist. Please run the database setup script.',
          details: testError.message,
          code: testError.code
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Database table access failed',
        details: testError.message,
        code: testError.code
      }, { status: 500 });
    }

    console.log('✅ Projects table access successful, proceeding with query');

    // Test if client exists first
    console.log('🔍 Testing if client exists...');
    const { data: clientTest, error: clientTestError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();
    
    console.log('👤 Client test result:', { 
      clientTest: clientTest ? { id: clientTest.id, name: clientTest.name } : 'null', 
      clientTestError: clientTestError ? { code: clientTestError.code, message: clientTestError.message } : 'none' 
    });

    if (clientTestError) {
      console.error('❌ Client lookup failed:', {
        code: clientTestError.code,
        message: clientTestError.message,
        details: clientTestError.details,
        hint: clientTestError.hint
      });
      
      if (clientTestError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: 'Client not found',
          details: `No client found with ID: ${clientId}`,
          code: clientTestError.code
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Client lookup failed',
        details: clientTestError.message,
        code: clientTestError.code
      }, { status: 500 });
    }

    console.log('✅ Client found, proceeding with projects query');

    // Fetch projects for the client
    console.log('🔍 Executing projects query for clientId:', clientId);
    const query = supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    console.log('📝 Supabase query:', {
      table: 'projects',
      filters: { client_id: clientId, status: 'active' },
      orderBy: 'created_at DESC'
    });

    const { data: projects, error } = await query;

    console.log('📊 Query result:', { 
      projects: projects ? `Array with ${projects.length} items` : 'null', 
      error: error ? { code: error.code, message: error.message } : 'none' 
    });

    if (error) {
      console.error('❌ Error fetching projects:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to fetch projects',
        details: error.details,
        code: error.code
      }, { status: 500 });
    }

    console.log('✅ Projects fetched successfully:', {
      count: projects?.length || 0,
      projects: projects?.map(p => ({ id: p.id, name: p.name, status: p.status })) || []
    });

    return NextResponse.json({ 
      success: true, 
      projects: projects || [] 
    });

  } catch (error: unknown) {
    console.error('💥 Unexpected error in projects GET route:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type'
    }, { status: 500 });
  }
}
