import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET() {
  try {

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing Supabase environment variables',
        timestamp: new Date().toISOString()
      
    }

    // Create Supabase client with service role for schema checks
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if clients table has required portal columns
    let clientsUpdated = false;
    try {
      const { data: clientsColumns, error: clientsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'clients')
        .in('column_name', ['portal_token', 'portal_enabled', 'portal_settings']);

      if (clientsError) {
        logger.error('❌ Error checking clients columns:', clientsError);
        clientsUpdated = false;
      } else {
        const columnNames = clientsColumns?.map(col => col.column_name) || [];
        clientsUpdated = columnNames.length === 3 && 
          columnNames.includes('portal_token') && 
          columnNames.includes('portal_enabled') && 
          columnNames.includes('portal_settings');

      }
    } catch (error) {
      logger.error('❌ Error checking clients table:', error);
      clientsUpdated = false;
    }

    // Check if content_inbox table exists
    let contentInboxExists = false;
    try {
      const { data: contentInboxTable, error: contentInboxError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'content_inbox')
        .single();

      if (contentInboxError) {
        logger.error('❌ Error checking content_inbox table:', contentInboxError);
        contentInboxExists = false;
      } else {
        contentInboxExists = !!contentInboxTable;

      }
    } catch (error) {
      logger.error('❌ Error checking content_inbox table:', error);
      contentInboxExists = false;
    }

    // Check if portal_activity table exists
    let portalActivityExists = false;
    try {
      const { data: portalActivityTable, error: portalActivityError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'portal_activity')
        .single();

      if (portalActivityError) {
        logger.error('❌ Error checking portal_activity table:', portalActivityError);
        portalActivityExists = false;
      } else {
        portalActivityExists = !!portalActivityTable;

      }
    } catch (error) {
      logger.error('❌ Error checking portal_activity table:', error);
      portalActivityExists = false;
    }

    // Determine overall success
    const allChecksPass = clientsUpdated && contentInboxExists && portalActivityExists;

    const response = {
      success: allChecksPass,
      tables: {
        clientsUpdated,
        contentInboxExists,
        portalActivityExists
      },
      message: allChecksPass 
        ? 'Database ready for portal implementation'
        : 'Database not ready for portal implementation - some required tables or columns are missing',
      timestamp: new Date().toISOString()
    
    return NextResponse.json(response, { 
      status: allChecksPass ? 200 : 400 

  } catch (error) {
    logger.error('💥 Portal verification error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Portal verification failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    
  }
}
