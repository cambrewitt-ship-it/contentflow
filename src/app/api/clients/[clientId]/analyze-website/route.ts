import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { analyzeWebsite, formatScrapeForAnalysis, websiteTovSource } from '@/lib/websiteAnalysis';

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { scrapeId } = await request.json();

    if (!scrapeId) {
      return NextResponse.json({ error: 'Scrape ID is required' }, { status: 400 });
    }

    // Fetch the scraped website content
    const { data: scrapeData, error: fetchError } = await supabase
      .from('website_scrapes')
      .select('*')
      .eq('id', scrapeId)
      .eq('client_id', clientId)
      .eq('scrape_status', 'completed')
      .single();

    if (fetchError || !scrapeData) {
      logger.error('❌ Failed to fetch scrape data:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch scrape data',
        details: fetchError?.message || 'Scrape not found'
      }, { status: 404 });
    }

    const analysis = await analyzeWebsite(formatScrapeForAnalysis(scrapeData));

    // Save the drafted tone of voice guide, but never over one the agency
    // uploaded or wrote themselves.
    let tovSaved = false;
    if (analysis.brand_tov) {
      const now = new Date().toISOString();
      const { data: updated, error: tovError } = await supabase
        .from('clients')
        .update({
          brand_tov: analysis.brand_tov,
          brand_tov_source_filename: websiteTovSource(scrapeData.url),
          brand_tov_updated_at: now,
          updated_at: now,
        })
        .eq('id', clientId)
        .or('brand_tov.is.null,brand_tov.eq.')
        .select('id');
      if (tovError) {
        logger.error('Failed to save website tone of voice:', { error: tovError.message });
      } else {
        tovSaved = (updated?.length ?? 0) > 0;
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      tovSaved,
      source: {
        url: scrapeData.url,
        scrapeId: scrapeData.id,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('💥 Error in AI analysis:', error);
    return NextResponse.json({
      error: 'AI analysis failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
