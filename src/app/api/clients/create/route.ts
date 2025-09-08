import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      name, 
      description, 
      company_description, 
      website_url, 
      brand_tone, 
      target_audience, 
      value_proposition, 
      caption_dos, 
      caption_donts 
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ 
        error: 'Client name is required' 
      }, { status: 400 });
    }

    console.log('🏢 Creating new client:', name);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Insert the new client
    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert([
        {
          name: name.trim(),
          description: description?.trim() || null,
          company_description: company_description?.trim() || null,
          website_url: website_url?.trim() || null,
          brand_tone: brand_tone || null,
          target_audience: target_audience?.trim() || null,
          value_proposition: value_proposition?.trim() || null,
          caption_dos: caption_dos?.trim() || null,
          caption_donts: caption_donts?.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to create client:', insertError);
      return NextResponse.json({ 
        error: 'Failed to create client', 
        details: insertError.message 
      }, { status: 500 });
    }

    console.log('✅ Client created successfully:', client.id);

    return NextResponse.json({
      success: true,
      clientId: client.id,
      client: client
    });

  } catch (error: unknown) {
    console.error('💥 Error in clients/create route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}