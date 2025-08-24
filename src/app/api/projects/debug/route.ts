import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(req: NextRequest) {
  console.log('🔍 Projects debug endpoint called');
  
  try {
    // Check environment variables
    console.log('🔧 Environment check:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey.length + ')' : 'MISSING'
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Configuration error: Missing Supabase environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseServiceRoleKey: !!supabaseServiceRoleKey
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✅ Supabase client created successfully');

    // Test basic connection
    console.log('🔍 Testing basic Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('clients')
      .select('count')
      .limit(1);
    
    console.log('🔌 Connection test result:', { 
      connectionTest: connectionTest ? 'SUCCESS' : 'FAILED', 
      connectionError: connectionError ? { code: connectionError.code, message: connectionError.message } : 'none' 
    });

    if (connectionError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed',
        details: connectionError.message,
        code: connectionError.code
      }, { status: 500 });
    }

    // Check if projects table exists
    console.log('🔍 Checking if projects table exists...');
    const { data: projectsTest, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
    
    console.log('📊 Projects table test:', { 
      exists: !projectsError,
      data: projectsTest ? `Array with ${projectsTest.length} items` : 'null', 
      error: projectsError ? { code: projectsError.code, message: projectsError.message } : 'none' 
    });

    // Check table structure if it exists
    let tableStructure = null;
    if (!projectsError && projectsTest && projectsTest.length > 0) {
      const firstProject = projectsTest[0];
      tableStructure = {
        columns: Object.keys(firstProject),
        sampleData: firstProject
      };
      console.log('📋 Table structure:', tableStructure);
    }

    // Check clients table structure
    console.log('🔍 Checking clients table structure...');
    const { data: clientsTest, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);
    
    console.log('👤 Clients table test:', { 
      exists: !clientsError,
      data: clientsTest ? `Array with ${clientsTest.length} items` : 'null', 
      error: clientsError ? { code: clientsError.code, message: clientsError.message } : 'none' 
    });

    let clientsStructure = null;
    if (!clientsError && clientsTest && clientsTest.length > 0) {
      const firstClient = clientsTest[0];
      clientsStructure = {
        columns: Object.keys(firstClient),
        sampleData: firstClient
      };
      console.log('📋 Clients table structure:', clientsStructure);
    }

    // Check for any existing projects
    let existingProjects = null;
    if (!projectsError) {
      const { data: allProjects, error: allProjectsError } = await supabase
        .from('projects')
        .select('id, name, client_id, status, created_at')
        .limit(10);
      
      if (!allProjectsError) {
        existingProjects = allProjects;
        console.log('📋 Existing projects:', existingProjects);
      }
    }

    // Check for any existing clients
    let existingClients = null;
    if (!clientsError) {
      const { data: allClients, error: allClientsError } = await supabase
        .from('clients')
        .select('id, name, late_profile_id')
        .limit(10);
      
      if (!allClientsError) {
        existingClients = allClients;
        console.log('👤 Existing clients:', existingClients);
      }
    }

    const debugInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceRoleKey: !!supabaseServiceRoleKey
      },
      connection: {
        status: 'SUCCESS',
        clientsTable: {
          exists: !clientsError,
          error: clientsError ? { code: clientsError.code, message: clientsError.message } : null,
          structure: clientsStructure
        },
        projectsTable: {
          exists: !projectsError,
          error: projectsError ? { code: projectsError.code, message: projectsError.message } : null,
          structure: tableStructure
        }
      },
      data: {
        existingClients: existingClients?.length || 0,
        existingProjects: existingProjects?.length || 0,
        sampleClients: existingClients?.slice(0, 3) || [],
        sampleProjects: existingProjects?.slice(0, 3) || []
      }
    };

    console.log('✅ Debug info collected successfully');
    return NextResponse.json(debugInfo);

  } catch (error: unknown) {
    console.error('💥 Unexpected error in projects debug route:', error);
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
