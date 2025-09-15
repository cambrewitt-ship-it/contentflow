import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Function to delete LATE profile
async function deleteLateProfile(lateProfileId: string) {
  try {
    console.log('🗑️ Deleting LATE profile:', lateProfileId);
    
    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) {
      console.error('❌ LATE API key not found in environment variables');
      throw new Error('LATE API key not configured');
    }

    console.log('🔑 LATE API key found, length:', lateApiKey.length);
    console.log('🌐 Making request to: https://getlate.dev/api/v1/profiles/' + lateProfileId);

    const response = await fetch(`https://getlate.dev/api/v1/profiles/${lateProfileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 LATE profile deletion response status:', response.status);
    console.log('📡 LATE profile deletion response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LATE profile deletion error response:', errorText);
      console.error('❌ LATE profile deletion error status:', response.status);
      console.error('❌ LATE profile deletion error statusText:', response.statusText);
      throw new Error(`LATE profile deletion failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.text();
    console.log('✅ LATE profile deleted successfully, response:', responseData);
    console.log('✅ LATE profile deletion completed for profile ID:', lateProfileId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting LATE profile:', error);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    console.log('🔍 Fetching client data for ID:', clientId);
    console.log('🔍 Client ID debug:', {
      clientId,
      length: clientId?.length,
      isValidUUID: clientId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) : false,
      hasCtSuffix: clientId?.includes('-ct_'),
      requestUrl: request.url
    });

    // Clean up clientId if it has additional data appended (common issue with OAuth flows)
    let cleanClientId = clientId;
    if (clientId && clientId.includes('-ct_')) {
      console.log('🔧 Cleaning up malformed clientId in client API:', clientId);
      cleanClientId = clientId.split('-ct_')[0];
      console.log('✅ Cleaned clientId in client API:', cleanClientId);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', cleanClientId)
      .single();

    if (error) {
      console.error('❌ Supabase query error:', error);
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

    console.log('✅ Client data fetched successfully:', client);

    return NextResponse.json({
      success: true,
      client: client
    });

  } catch (error: unknown) {
    console.error('💥 Error in get client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    
    console.log('🔄 Updating client data for ID:', clientId, 'Body:', body);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: updatedClient, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase update error:', error);
      return NextResponse.json({ 
        error: 'Failed to update client', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ Client updated successfully:', updatedClient);

    return NextResponse.json({
      success: true,
      client: updatedClient
    });

  } catch (error: unknown) {
    console.error('💥 Error in update client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    console.log('🗑️ Deleting client with ID:', clientId);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // First, get the client to check if it has a LATE profile
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('late_profile_id, name')
      .eq('id', clientId)
      .single();

    if (fetchError) {
      console.error('❌ Failed to fetch client:', fetchError);
      return NextResponse.json({ 
        error: 'Client not found', 
        details: fetchError.message 
      }, { status: 404 });
    }

    console.log('🔍 Client data fetched:', {
      id: clientId,
      name: client.name,
      late_profile_id: client.late_profile_id,
      hasLateProfile: !!client.late_profile_id
    });

    // Delete LATE profile if it exists
    let lateProfileDeleted = false;
    if (client.late_profile_id) {
      try {
        console.log('🎯 Client has LATE profile, deleting it first:', client.late_profile_id);
        await deleteLateProfile(client.late_profile_id);
        lateProfileDeleted = true;
        console.log('✅ LATE profile deleted successfully');
      } catch (lateError) {
        console.error('⚠️ Failed to delete LATE profile, continuing with client deletion:', lateError);
        // Don't fail the entire operation if LATE deletion fails
        // The client should still be deleted even if LATE profile deletion fails
      }
    } else {
      console.log('ℹ️ Client has no LATE profile, skipping LATE deletion');
    }

    // Delete the client from database
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      return NextResponse.json({ 
        error: 'Failed to delete client', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ Client deleted successfully:', clientId);

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
      lateProfileDeleted: lateProfileDeleted
    });

  } catch (error: unknown) {
    console.error('💥 Error in delete client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
