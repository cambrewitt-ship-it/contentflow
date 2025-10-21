import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Helper function to check if projects table exists
async function checkProjectsTableExists(supabase: SupabaseClient) {

  try {
    // Try to query the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('projects')
      .select('*')
      .limit(0); // Just get schema, no data
    
    if (tableError) {

      if (tableError.code === '42P01') {
        logger.debug('Projects table does not exist', { errorCode: tableError.code });
        return { exists: false, error: tableError };
      }
      
      return { exists: false, error: tableError };
    }

    return { exists: true, error: null };
    
  } catch (error) {
    logger.error('Unexpected error checking table existence:', error);
    return { exists: false, error };
  }
}

// Helper function to get table schema information
async function getTableSchema(supabase: SupabaseClient, tableName: string) {
  logger.debug('Getting table schema', { tableName });
  
  try {
    // Try to get a sample row to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (sampleError) {

      return { schema: null, error: sampleError };
    }
    
    if (sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0]);

      return { schema: columns, error: null };
    } else {

      return { schema: [], error: null };
    }
    
  } catch (error) {
    logger.error(`Error getting ${tableName} table schema:`, error);
    return { schema: null, error };
  }
}

export async function POST(req: NextRequest) {

  logger.debug('POST /api/projects request received');
  
  try {
    const body = await req.json();
    const { client_id, name, description } = body;

    if (!client_id || !name) {

      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: client_id and name are required' 
      }, { status: 400 });
    }

    // Check environment variables
    logger.debug('Environment variables check', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.error('=== ENVIRONMENT ERROR ===');
      logger.error('Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Test table access first

    // Use helper function to check table existence
    const tableCheck = await checkProjectsTableExists(supabase);

    if (!tableCheck.exists) {
      logger.error('=== TABLE ACCESS FAILED ===');
      logger.error('Projects table access failed:', {
        exists: tableCheck.exists,
        error: tableCheck.error
      });
      
      // Check if table doesn't exist
      if (tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error) {
        const error = tableCheck.error as { code: string; message: string };
        if (error.code === '42P01') {
          logger.error('Table does not exist error detected');
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

    // Get table schema information
    const schemaInfo = await getTableSchema(supabase, 'projects');

    // Create new project
    const insertData = {
      client_id,
      name,
      description: description || '',
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data: project, error } = await supabase
      .from('projects')
      .insert([insertData])
      .select('*')
      .single();

    if (error) {
      logger.error('=== INSERT QUERY FAILED ===');
      logger.error('Error creating project:', {
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

    return NextResponse.json({ 
      success: true, 
      project 
    });

  } catch (error: unknown) {
    logger.error('=== PROJECTS API POST ERROR ===');
    logger.error('Error type:', typeof error);
    logger.error('Error constructor:', error?.constructor?.name);
    logger.error('Error message:', error instanceof Error ? error.message : String(error));
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    logger.error('Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {

  logger.debug('GET /api/projects request received');
  
  // Simple fallback response to test if route is working
  if (req.url.includes('test=true')) {

    return NextResponse.json({ 
      success: true, 
      message: 'Projects API route is working (test mode)',
      timestamp: new Date().toISOString()
    });
  }
  
  // Add immediate response for debugging

  // Very simple health check - always return something
  if (req.url.includes('health=true')) {

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

    logger.debug('Request parameters', { 
      hasClientId: !!clientId,
      paramsCount: Array.from(searchParams.entries()).length
    });

    if (!clientId) {

      return NextResponse.json({ 
        success: false, 
        error: 'clientId query parameter is required' 
      }, { status: 400 });
    }

    // Check environment variables
    logger.debug('Environment variables check', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.error('=== ENVIRONMENT ERROR ===');
      logger.error('Missing Supabase environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Test table access first

    // Use helper function to check table existence
    const tableCheck = await checkProjectsTableExists(supabase);

    if (!tableCheck.exists) {
      logger.error('=== TABLE ACCESS FAILED ===');
      logger.error('Projects table access failed:', {
        exists: tableCheck.exists,
        error: tableCheck.error
      });
      
      // Check if table doesn't exist
      if (tableCheck.error && typeof tableCheck.error === 'object' && 'code' in tableCheck.error) {
        const error = tableCheck.error as { code: string; message: string };
        if (error.code === '42P01') {
          logger.error('Table does not exist error detected');
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

    // Get table schema information
    const schemaInfo = await getTableSchema(supabase, 'projects');

    // Test if client exists first

    const { data: clientTest, error: clientTestError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (clientTestError) {
      logger.error('=== CLIENT LOOKUP FAILED ===');
      logger.error('Client lookup failed:', {
        code: clientTestError.code,
        message: clientTestError.message,
        details: clientTestError.details,
        hint: clientTestError.hint
      });
      
      if (clientTestError.code === 'PGRST116') {
        logger.error('Client not found error detected');
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

    // Fetch projects for the client

    const query = supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20); // Limit to 20 most recent projects

    const { data: projects, error } = await query;

    if (error) {
      logger.error('=== QUERY EXECUTION FAILED ===');
      logger.error('Error fetching projects:', {
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

    logger.debug('Projects fetched successfully', {
      count: projects?.length || 0
    });

    return NextResponse.json({ 
      success: true, 
      projects: projects || [] 
    });

  } catch (error: unknown) {
    logger.error('=== PROJECTS API GET ERROR ===');
    logger.error('Error type:', typeof error);
    logger.error('Error constructor:', error?.constructor?.name);
    logger.error('Error message:', error instanceof Error ? error.message : String(error));
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    logger.error('Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 });
  }
}
