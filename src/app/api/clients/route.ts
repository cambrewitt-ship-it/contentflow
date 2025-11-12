import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { decrementUsage } from '@/lib/subscriptionHelpers';
import { requireAuth, requireClientOwnership } from '@/lib/authHelpers';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Query clients for the authenticated user only
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, description, company_description, website_url, brand_tone, target_audience, industry, brand_keywords, caption_dos, caption_donts, logo_url, created_at, updated_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      logger.error('❌ Supabase query error:', error);
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      clients: clients || []
    });

  } catch (error: unknown) {
    logger.error('💥 Error in get all clients route:', error);
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

    const auth = await requireClientOwnership(req, clientId);
    if (auth.error) return auth.error;
    const { supabase, user, client } = auth;

    if (!client) {
      logger.error('❌ Client not found or access denied');
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
      logger.error('❌ Error deleting projects:', projectsError);
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
      logger.error('❌ Error deleting brand documents:', brandDocsError);
      // Continue with client deletion even if brand docs fail
    }

    // Delete website scrapes
    const { error: scrapesError } = await supabase
      .from('website_scrapes')
      .delete()
      .eq('client_id', clientId);

    if (scrapesError) {
      logger.error('❌ Error deleting website scrapes:', scrapesError);
      // Continue with client deletion even if scrapes fail
    }

    // Finally, delete the client
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (deleteError) {
      logger.error('❌ Error deleting client:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete client', 
        details: deleteError.message 
      }, { status: 500 });
    }

    // Decrement the client usage counter in subscription
    try {
      await decrementUsage(user.id, 'clients', 1);
      logger.info('✅ Successfully decremented client usage for user:', user.id);
    } catch (usageError) {
      logger.error('⚠️ Failed to decrement client usage, but client was deleted:', usageError);
      // Don't fail the entire operation if usage decrement fails
      // The client was successfully deleted, which is the main goal
    }

    return NextResponse.json({ 
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error: unknown) {
    logger.error('💥 Error in delete client route:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
