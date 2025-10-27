import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ No authorization header found');
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to view client data'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the authenticated user using the token
    const { data, error: authError } = await supabase.auth.getUser(token);
    const user = data?.user;

    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to view client data'
      }, { status: 401 });
    }

    // Clean up clientId if it has additional data appended (common issue with OAuth flows)
    let cleanClientId = clientId;
    if (clientId && clientId.includes('-ct_')) {
      cleanClientId = clientId.split('-ct_')[0];
    }

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', cleanClientId)
      .eq('user_id', user.id) // Only get clients owned by the authenticated user
      .single();

    if (error) {
      logger.error('❌ Supabase query error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          error: 'Client not found'
        }, { status: 404 });
      }
      return NextResponse.json({
        error: 'Database query failed',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client: client
    });

  } catch (error: unknown) {
    logger.error('💥 Error in get client data route:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;
    const body = await request.json();

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ No authorization header found');
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to update client data'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the authenticated user using the token
    const { data, error: authError } = await supabase.auth.getUser(token);
    const user = data?.user;

    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to update client data'
      }, { status: 401 });
    }

    // Clean up clientId if it has additional data appended
    let cleanClientId = clientId;
    if (clientId && clientId.includes('-ct_')) {
      cleanClientId = clientId.split('-ct_')[0];
    }

    // Verify the client belongs to the authenticated user
    const { data: existingClient, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', cleanClientId)
      .eq('user_id', user.id)
      .single();

    if (clientError || !existingClient) {
      logger.error('❌ Client not found or access denied:', clientError);
      return NextResponse.json({
        error: 'Client not found or access denied',
        details: 'You can only update your own clients'
      }, { status: 404 });
    }

    // Prepare update data (only include fields that are provided)
    const updateData: {
      website?: string;
      description?: string;
      updated_at?: string;
    } = {};

    if (body.website !== undefined) updateData.website = body.website;
    if (body.description !== undefined) updateData.description = body.description;

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: updatedClient, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', cleanClientId)
      .select('*')
      .single();

    if (error) {
      logger.error('❌ Supabase update error:', error);
      return NextResponse.json({
        error: 'Failed to update client',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client: updatedClient
    });

  } catch (error: unknown) {
    logger.error('💥 Error in update client data route:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
