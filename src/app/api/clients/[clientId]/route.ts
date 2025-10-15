import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError, handleDatabaseError, ApiErrors } from '@/lib/apiErrorHandler';
import { sanitizeUUID } from '@/lib/validators';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Function to disconnect all social accounts from a LATE profile
async function disconnectAllLateAccounts(lateProfileId: string) {
  try {

    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) {
      logger.error('❌ LATE API key not found in environment variables');
      throw new Error('LATE API key not configured');
    }

    // First, get all accounts for this profile

    const accountsResponse = await fetch(`https://getlate.dev/api/v1/accounts?profileId=${lateProfileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      logger.error('❌ Failed to fetch accounts:', errorText);
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];

    if (accounts.length === 0) {

      return true;
    }

    // Disconnect each account
    const disconnectPromises = accounts.map(async (account: any) => {
      try {
        logger.debug('Disconnecting account', { 
          platform: account.platform,
          accountId: account._id?.substring(0, 8) + '...' 
        });
        
        const disconnectResponse = await fetch(`https://getlate.dev/api/v1/accounts/${account._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${lateApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!disconnectResponse.ok) {
          const errorText = await disconnectResponse.text();
          logger.error(`❌ Failed to disconnect account ${account._id}:`, errorText);
          throw new Error(`Failed to disconnect account: ${disconnectResponse.status} - ${errorText}`);
        }

        return true;
      } catch (error) {
        logger.error(`❌ Error disconnecting account ${account._id}:`, error);
        // Don't throw here - we want to try disconnecting all accounts even if some fail
        return false;
      }
    });

    const results = await Promise.all(disconnectPromises);
    const successCount = results.filter(Boolean).length;

    return successCount > 0; // Return true if at least one account was disconnected
  } catch (error) {
    logger.error('❌ Error disconnecting LATE accounts:', error);
    throw error;
  }
}

// Function to delete LATE profile
async function deleteLateProfile(lateProfileId: string) {
  try {

    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) {
      logger.error('❌ LATE API key not found in environment variables');
      throw new Error('LATE API key not configured');
    }

    // First, disconnect all social accounts

    await disconnectAllLateAccounts(lateProfileId);

    // Now delete the profile

    const response = await fetch(`https://getlate.dev/api/v1/profiles/${lateProfileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    logger.debug('LATE profile deletion response', { 
      status: response.status 
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ LATE profile deletion error response:', errorText);
      logger.error('❌ LATE profile deletion error status:', response.status);
      logger.error('❌ LATE profile deletion error statusText:', response.statusText);
      throw new Error(`LATE profile deletion failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.text();

    return true;
  } catch (error) {
    logger.error('❌ Error deleting LATE profile:', error);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let clientId: string | undefined;
  try {
    const paramsData = await params;
    clientId = paramsData.clientId;

    // Clean up clientId if it has additional data appended (common issue with OAuth flows)
    let cleanClientId = clientId;
    if (clientId && clientId.includes('-ct_')) {
      cleanClientId = clientId.split('-ct_')[0];
    }

    // Validate and sanitize the client ID
    const sanitizedClientId = sanitizeUUID(cleanClientId);
    if (!sanitizedClientId) {
      logger.warn('⚠️ Invalid client ID format', { clientId: cleanClientId });
      return NextResponse.json(
        { error: 'Invalid client ID format' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ No authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to view clients'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to view clients'
      }, { status: 401 });
    }

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', sanitizedClientId)
      .eq('user_id', user.id) // Only get clients owned by the authenticated user
      .single();

    if (error) {
      return handleDatabaseError(error, {
        route: '/api/clients/[clientId]',
        operation: 'fetch_client',
        userId: user.id,
        clientId: sanitizedClientId,
      }, 'Client not found');
    }

    return NextResponse.json({
      success: true,
      client: client
    });

  } catch (error: unknown) {
    return handleApiError(error, {
      route: '/api/clients/[clientId]',
      operation: 'fetch_client',
      additionalData: { clientId }
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let clientId: string | undefined;
  try {
    const paramsData = await params;
    clientId = paramsData.clientId;
    const body = await request.json();

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ No authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to update clients'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to update clients'
      }, { status: 401 });
    }

    // Verify the client belongs to the authenticated user
    const { data: existingClient, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
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
      name?: string;
      company_description?: string;
      website_url?: string;
      brand_tone?: string;
      target_audience?: string;
      industry?: string;
      brand_keywords?: string[];
      caption_dos?: string;
      caption_donts?: string;
      brand_voice_examples?: string;
      value_proposition?: string;
      portal_enabled?: boolean;
      updated_at?: string;
    } = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.company_description !== undefined) updateData.company_description = body.company_description;
    if (body.website_url !== undefined) updateData.website_url = body.website_url;
    if (body.brand_tone !== undefined) updateData.brand_tone = body.brand_tone;
    if (body.target_audience !== undefined) updateData.target_audience = body.target_audience;
    if (body.industry !== undefined) updateData.industry = body.industry;
    if (body.brand_keywords !== undefined) updateData.brand_keywords = body.brand_keywords;
    if (body.caption_dos !== undefined) updateData.caption_dos = body.caption_dos;
    if (body.caption_donts !== undefined) updateData.caption_donts = body.caption_donts;
    if (body.brand_voice_examples !== undefined) updateData.brand_voice_examples = body.brand_voice_examples;
    if (body.value_proposition !== undefined) updateData.value_proposition = body.value_proposition;
    if (body.portal_enabled !== undefined) updateData.portal_enabled = body.portal_enabled;
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: updatedClient, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) {
      return handleDatabaseError(error, {
        route: '/api/clients/[clientId]',
        operation: 'update_client',
        userId: user.id,
        clientId: clientId,
      }, 'Failed to update client');
    }

    return NextResponse.json({
      success: true,
      client: updatedClient
    });

  } catch (error: unknown) {
    return handleApiError(error, {
      route: '/api/clients/[clientId]',
      operation: 'update_client',
      additionalData: { clientId }
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let clientId: string | undefined;
  try {
    const paramsData = await params;
    clientId = paramsData.clientId;

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ No authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to delete clients'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to delete clients'
      }, { status: 401 });
    }

    // First, get the client to check if it has a LATE profile and verify ownership
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('late_profile_id, name, user_id')
      .eq('id', clientId)
      .eq('user_id', user.id) // Only allow deletion of own clients
      .single();

    if (fetchError) {
      return handleDatabaseError(fetchError, {
        route: '/api/clients/[clientId]',
        operation: 'fetch_client_for_deletion',
        userId: user.id,
        clientId: clientId,
      }, 'Client not found');
    }

    // Delete LATE profile if it exists
    let lateProfileDeleted = false;
    if (client.late_profile_id) {
      try {

        await deleteLateProfile(client.late_profile_id);
        lateProfileDeleted = true;

      } catch (lateError) {
        logger.error('⚠️ Failed to delete LATE profile, continuing with client deletion:', lateError);
        // Don't fail the entire operation if LATE deletion fails
        // The client should still be deleted even if LATE profile deletion fails
      }
    } else {

    }

    // Delete the client from database
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      return handleDatabaseError(error, {
        route: '/api/clients/[clientId]',
        operation: 'delete_client',
        userId: user.id,
        clientId: clientId,
      }, 'Failed to delete client');
    }

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
      lateProfileDeleted: lateProfileDeleted
    });

  } catch (error: unknown) {
    return handleApiError(error, {
      route: '/api/clients/[clientId]',
      operation: 'delete_client',
      additionalData: { clientId }
    });
  }
}
