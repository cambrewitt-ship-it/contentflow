import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Helper function to check if projects table exists
async function checkProjectsTableExists(supabase: SupabaseClient) {
  console.log('=== CHECKING PROJECTS TABLE EXISTENCE ===');
  
  try {
    // Try to query the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('projects')
      .select('*')
      .limit(0); // Just get schema, no data
    
    if (tableError) {
      console.log('Table existence check failed:', {
        code: tableError.code,
        message: tableError.message,
        details: tableError.details
      });
      
      if (tableError.code === '42P01') {
        console.log('❌ Projects table does not exist (error code: 42P01)');
        return { exists: false, error: tableError };
      }
      
      return { exists: false, error: tableError };
    }
    
    console.log('✅ Projects table exists and is accessible');
    return { exists: true, error: null };
    
  } catch (error) {
    console.error('Unexpected error checking table existence:', error);
    return { exists: false, error };
  }
}

// Helper function to get table schema information
async function getTableSchema(supabase: SupabaseClient, tableName: string) {
  console.log(`=== GETTING ${tableName.toUpperCase()} TABLE SCHEMA ===`);
  
  try {
    // Try to get a sample row to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log(`${tableName} table schema check failed:`, {
        code: sampleError.code,
        message: sampleError.message
      });
      return { schema: null, error: sampleError };
    }
    
    if (sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0]);
      console.log(`${tableName} table columns:`, columns);
      return { schema: columns, error: null };
    } else {
      console.log(`${tableName} table exists but has no data`);
      return { schema: [], error: null };
    }
    
  } catch (error) {
    console.error(`Error getting ${tableName} table schema:`, error);
    return { schema: null, error };
  }
}

export async function POST(req: NextRequest) {
  console.log('🚨 PROJECTS API POST ROUTE HIT! 🚨');
  console.log('=== PROJECTS API POST CALLED ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    const body = await req.json();
    const { client_id, name, description } = body;
    
    console.log('=== REQUEST BODY PARSED ===');
    console.log('Request body received:', { client_id, name, description: description ? 'provided' : 'not provided' });

    if (!client_id || !name) {
      console.log('=== VALIDATION FAILED ===');
      console.log('Missing required fields:', { client_id: !!client_id, name: !!name });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: client_id and name are required' 
      }, { status: 400 });
    }

    console.log('=== ENVIRONMENT CHECK ===');
    // Check environment variables
    console.log('Environment variables status:', {
      supabaseUrl: supabaseUrl ? 'SET (length: ' + supabaseUrl.length + ')' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey.length + ')' : 'MISSING'
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('=== ENVIRONMENT ERROR ===');
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    console.log('=== CREATING SUPABASE CLIENT ===');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    console.log('=== TESTING PROJECTS TABLE ACCESS ===');
    // Test table access first
    console.log('About to test projects table access...');
    
    // Use helper function to check table existence
    const tableCheck = await checkProjectsTableExists(supabase);
    console.log('=== TABLE EXISTENCE CHECK RESULTS ===');
    console.log('Table existence check result:', tableCheck);
    
    if (!tableCheck.exists) {
      console.error('=== TABLE ACCESS FAILED ===');
      console.error('Projects table access failed:', {
        exists: tableCheck.exists,
        error: tableCheck.error
      });
      
      // Check if table doesn't exist
      if (tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error) {
        const error = tableCheck.error as { code: string; message: string };
        if (error.code === '42P01') {
          console.error('Table does not exist error detected');
          return NextResponse.json({ 
            success: false, 
            error: 'Projects table does not exist. Please run the database setup script.',
            details: error.message,
            code: error.code,
            solution: 'Run the SQL commands in database-setup.sql to create the projects table'
          }, { status: 500 });
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Database table access failed',
        details: tableCheck.error && typeof tableCheck.error === 'object' && 'message' in tableCheck.error 
          ? (tableCheck.error as { message: string }).message 
          : 'Unknown table access error',
        code: tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error 
          ? (tableCheck.error as { code: string }).code 
          : 'UNKNOWN'
      }, { status: 500 });
    }

    console.log('✅ Projects table access successful, proceeding with insert');

    // Get table schema information
    const schemaInfo = await getTableSchema(supabase, 'projects');
    console.log('=== PROJECTS TABLE SCHEMA ===');
    console.log('Schema information:', schemaInfo);

    console.log('=== PREPARING INSERT DATA ===');
    // Create new project
    const insertData = {
      client_id,
      name,
      description: description || '',
      status: 'active',
      color: body.color || '#3B82F6', // Add color field support
      created_at: new Date().toISOString()
    };
    
    console.log('Insert data prepared:', insertData);
    
    console.log('=== EXECUTING DATABASE INSERT ===');
    console.log('About to execute Supabase insert query...');
    const { data: project, error } = await supabase
      .from('projects')
      .insert([insertData])
      .select('*')
      .single();

    console.log('=== INSERT QUERY RESULTS ===');
    console.log('Database response - success:', !error, 'project ID:', project?.id);

    if (error) {
      console.error('=== INSERT QUERY FAILED ===');
      console.error('Error creating project:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2)
      });
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to create project',
        details: error.details,
        code: error.code
      }, { status: 500 });
    }

    console.log('=== SUCCESS ===');
    console.log('Project created successfully:', project);

    return NextResponse.json({ 
      success: true, 
      project 
    });

  } catch (error: unknown) {
    console.error('=== PROJECTS API POST ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  console.log('🚨 PROJECTS API GET ROUTE HIT! 🚨');
  console.log('=== PROJECTS API GET CALLED ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Simple fallback response to test if route is working
  if (req.url.includes('test=true')) {
    console.log('=== TEST MODE - RETURNING SIMPLE RESPONSE ===');
    return NextResponse.json({ 
      success: true, 
      message: 'Projects API route is working (test mode)',
      timestamp: new Date().toISOString()
    });
  }
  
  // Add immediate response for debugging
  console.log('=== SENDING IMMEDIATE RESPONSE FOR DEBUGGING ===');
  
  // Very simple health check - always return something
  if (req.url.includes('health=true')) {
    console.log('=== HEALTH CHECK - RETURNING BASIC RESPONSE ===');
    return NextResponse.json({ 
      status: 'healthy',
      route: 'projects',
      timestamp: new Date().toISOString(),
      message: 'Projects API route is responding'
    });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    
    console.log('=== REQUEST PARAMETERS ===');
    console.log('Request parameters:', { 
      url: req.url,
      clientId: clientId,
      searchParams: Object.fromEntries(searchParams.entries())
    });

    if (!clientId) {
      console.log('=== VALIDATION FAILED ===');
      console.log('Missing clientId parameter');
      return NextResponse.json({ 
        success: false, 
        error: 'clientId query parameter is required' 
      }, { status: 400 });
    }

    console.log('=== ENVIRONMENT CHECK ===');
    // Check environment variables
    console.log('Environment variables status:', {
      supabaseUrl: supabaseUrl ? 'SET (length: ' + supabaseUrl.length + ')' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey.length + ')' : 'MISSING'
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('=== ENVIRONMENT ERROR ===');
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    console.log('=== CREATING SUPABASE CLIENT ===');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    console.log('=== TESTING PROJECTS TABLE ACCESS ===');
    // Test table access first
    console.log('About to test projects table access...');
    
    // Use helper function to check table existence
    const tableCheck = await checkProjectsTableExists(supabase);
    console.log('=== TABLE EXISTENCE CHECK RESULTS ===');
    console.log('Table existence check result:', tableCheck);
    
    if (!tableCheck.exists) {
      console.error('=== TABLE ACCESS FAILED ===');
      console.error('Projects table access failed:', {
        exists: tableCheck.exists,
        error: tableCheck.error
      });
      
      // Check if table doesn't exist
      if (tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error) {
        const error = tableCheck.error as { code: string; message: string };
        if (error.code === '42P01') {
          console.error('Table does not exist error detected');
          return NextResponse.json({ 
            success: false, 
            error: 'Projects table does not exist. Please run the database setup script.',
            details: error.message,
            code: error.code,
            solution: 'Run the SQL commands in database-setup.sql to create the projects table'
          }, { status: 500 });
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Database table access failed',
        details: tableCheck.error && typeof tableCheck.error === 'object' && 'message' in tableCheck.error 
          ? (tableCheck.error as { message: string }).message 
          : 'Unknown table access error',
        code: tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error 
          ? (tableCheck.error as { code: string }).code 
          : 'UNKNOWN'
      }, { status: 500 });
    }

    console.log('✅ Projects table access successful, proceeding with query');

    // Get table schema information
    const schemaInfo = await getTableSchema(supabase, 'projects');
    console.log('=== PROJECTS TABLE SCHEMA ===');
    console.log('Schema information:', schemaInfo);

    console.log('=== TESTING CLIENT EXISTENCE ===');
    // Test if client exists first
    console.log('About to test if client exists...');
    const { data: clientTest, error: clientTestError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();
    
    console.log('=== CLIENT TEST RESULTS ===');
    console.log('Client test result:', { 
      clientTest: clientTest ? { id: clientTest.id, name: clientTest.name } : 'null', 
      clientTestError: clientTestError ? { code: clientTestError.code, message: clientTestError.message } : 'none' 
    });

    if (clientTestError) {
      console.error('=== CLIENT LOOKUP FAILED ===');
      console.error('Client lookup failed:', {
        code: clientTestError.code,
        message: clientTestError.message,
        details: clientTestError.details,
        hint: clientTestError.hint
      });
      
      if (clientTestError.code === 'PGRST116') {
        console.error('Client not found error detected');
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

    console.log('=== EXECUTING PROJECTS QUERY ===');
    // Fetch projects for the client
    console.log('About to execute projects query for clientId:', clientId);
    const query = supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20); // Limit to 20 most recent projects
    
    console.log('Supabase query object:', {
      table: 'projects',
      filters: { client_id: clientId, status: 'active' },
      orderBy: 'created_at DESC',
      queryString: JSON.stringify(query, null, 2)
    });

    console.log('About to await the query...');
    const { data: projects, error } = await query;

    console.log('=== QUERY EXECUTION RESULTS ===');
    console.log('Database response - success:', !error, 'projects count:', projects?.length || 0);

    if (error) {
      console.error('=== QUERY EXECUTION FAILED ===');
      console.error('Error fetching projects:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2)
      });
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to fetch projects',
        details: error.details,
        code: error.code
      }, { status: 500 });
    }

    console.log('=== SUCCESS ===');
    console.log('Projects fetched successfully:', {
      count: projects?.length || 0,
      projects: projects?.map(p => ({ id: p.id, name: p.name, status: p.status })) || []
    });

    return NextResponse.json({ 
      success: true, 
      projects: projects || [] 
    });

  } catch (error: unknown) {
    console.error('=== PROJECTS API GET ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 });
  }
}
