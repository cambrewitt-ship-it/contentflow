import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    console.log('🔍 Fetching client data for ID:', clientId);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
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
