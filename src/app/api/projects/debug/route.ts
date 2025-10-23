import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(req: NextRequest) {
  try {
    // Check environment variables
    logger.debug('Environment check', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Configuration error: Missing Supabase environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseServiceRoleKey: !!supabaseServiceRoleKey
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Test basic connection

    const { data: connectionTest, error: connectionError } = await supabase
      .from('clients')
      .select('count')
      .limit(1);

    if (connectionError) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: connectionError.message,
        code: connectionError.code
      });
    }

    // Check if projects table exists

    const { data: projectsTest, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);

    // Check table structure if it exists
    let tableStructure = null;
    if (!projectsError && projectsTest && projectsTest.length > 0) {
      const firstProject = projectsTest[0];
      tableStructure = {
        columns: Object.keys(firstProject),
        sampleData: firstProject
      };
    }

    // Check clients table structure

    const { data: clientsTest, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    let clientsStructure = null;
    if (!clientsError && clientsTest && clientsTest.length > 0) {
      const firstClient = clientsTest[0];
      clientsStructure = {
        columns: Object.keys(firstClient),
        sampleData: firstClient
      };
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

    return NextResponse.json(debugInfo);

  } catch (error: unknown) {
    logger.error('💥 Unexpected error in projects debug route:', error);
    logger.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      type: error instanceof Error ? error.name : 'Unknown error type'
    });
  }
}
