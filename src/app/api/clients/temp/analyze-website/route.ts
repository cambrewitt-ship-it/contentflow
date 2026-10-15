import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { analyzeWebsite, formatScrapeForAnalysis } from '@/lib/websiteAnalysis';

export const maxDuration = 120;

// Website analysis for the new-client form, before the client exists. The
// drafted tone of voice comes back in the analysis and is saved with the client.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { scrapeData } = await request.json();

    if (!scrapeData) {
      return NextResponse.json({ error: 'Scraped data is required' }, { status: 400 });
    }

    // Validate required fields in scraped data
    if (!scrapeData.url || !scrapeData.scraped_content) {
      return NextResponse.json({ error: 'Invalid scraped data: missing url or content' }, { status: 400 });
    }

    const analysisResult = await analyzeWebsite(formatScrapeForAnalysis(scrapeData));

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      source: {
        url: scrapeData.url,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    logger.error('💥 Error in temporary AI analysis:', error);
    return NextResponse.json({
      error: 'AI analysis failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
