import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Fetching clients for authenticated user...');

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header found');
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
      console.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to view clients'
      }, { status: 401 });
    }

    console.log('✅ Authenticated user:', user.id);

    // Query clients for the authenticated user only
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, description, company_description, website_url, brand_tone, target_audience, industry, brand_keywords, caption_dos, caption_donts, created_at, updated_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ User clients fetched successfully:', clients?.length || 0, 'clients found');

    return NextResponse.json({ 
      success: true,
      clients: clients || []
    });

  } catch (error: unknown) {
    console.error('💥 Error in get all clients route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    
    if (!clientId) {
      return NextResponse.json({ 
        error: 'Client ID is required' 
      }, { status: 400 });
    }

    console.log('🗑️ Deleting client:', clientId);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header found');
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
      console.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to delete clients'
      }, { status: 401 });
    }

    // Verify the client belongs to the authenticated user
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found or access denied:', clientError);
      return NextResponse.json({ 
        error: 'Client not found or access denied', 
        details: 'You can only delete your own clients'
      }, { status: 404 });
    }

    // First, delete all related data (projects, posts, etc.)
    // Delete projects first (this will cascade to posts due to foreign key constraints)
    const { error: projectsError } = await supabase
      .from('projects')
      .delete()
      .eq('client_id', clientId);

    if (projectsError) {
      console.error('❌ Error deleting projects:', projectsError);
      return NextResponse.json({ 
        error: 'Failed to delete related projects', 
        details: projectsError.message 
      }, { status: 500 });
    }

    // Delete brand documents
    const { error: brandDocsError } = await supabase
      .from('brand_documents')
      .delete()
      .eq('client_id', clientId);

    if (brandDocsError) {
      console.error('❌ Error deleting brand documents:', brandDocsError);
      // Continue with client deletion even if brand docs fail
    }

    // Delete website scrapes
    const { error: scrapesError } = await supabase
      .from('website_scrapes')
      .delete()
      .eq('client_id', clientId);

    if (scrapesError) {
      console.error('❌ Error deleting website scrapes:', scrapesError);
      // Continue with client deletion even if scrapes fail
    }

    // Finally, delete the client
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (deleteError) {
      console.error('❌ Error deleting client:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete client', 
        details: deleteError.message 
      }, { status: 500 });
    }

    console.log('✅ Client and all related data deleted successfully');

    return NextResponse.json({ 
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error: unknown) {
    console.error('💥 Error in delete client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
