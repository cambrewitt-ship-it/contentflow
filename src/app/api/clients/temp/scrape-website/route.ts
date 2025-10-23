import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    try {
      // Perform the actual web scraping
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentManager/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Extract basic information using regex
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      
      const pageTitle = titleMatch ? titleMatch[1].trim() : '';
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';
      
      // Extract text content (remove HTML tags)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .substring(0, 5000); // Limit to first 5000 characters

      // Return scraped data directly without saving to database
      return NextResponse.json({
        success: true,
        scraped: true,
        data: {
          url: url,
          page_title: pageTitle,
          meta_description: metaDescription,
          scraped_content: textContent,
          scraped_at: new Date().toISOString()
        }
      });

    } catch (scrapeError) {
      logger.error('❌ Website scraping failed:', scrapeError);
      
      // Determine appropriate status code based on error type
      let statusCode = 500;
      let errorMessage = 'Website scraping failed';
      
      if (scrapeError instanceof Error) {
        if (scrapeError.message.includes('HTTP 404')) {
          statusCode = 404;
          errorMessage = 'Website not found (404)';
        } else if (scrapeError.message.includes('HTTP 403')) {
          statusCode = 403;
          errorMessage = 'Access denied (403)';
        } else if (scrapeError.message.includes('HTTP 429')) {
          statusCode = 429;
          errorMessage = 'Rate limited (429)';
        } else if (scrapeError.message.includes('timeout') || scrapeError.message.includes('ETIMEDOUT')) {
          statusCode = 408;
          errorMessage = 'Request timeout';
        } else if (scrapeError.message.includes('ENOTFOUND') || scrapeError.message.includes('ECONNREFUSED')) {
          statusCode = 503;
          errorMessage = 'Website is unreachable';
        }
      }

      return NextResponse.json({ 
        success: false,
        error: errorMessage, 
        details: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
        statusCode: statusCode
      }, { status: statusCode });
    }

  } catch (error: unknown) {
    logger.error('💥 Error in temporary website scraping:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error),
      statusCode: 500
    }, { status: 500 });
  }
}