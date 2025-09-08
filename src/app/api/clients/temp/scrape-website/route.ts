import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

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

    console.log('🌐 Starting temporary website scrape for URL:', url);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    try {
      // Perform the actual web scraping
      console.log('🔍 Fetching website content...');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentFlow/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Extract basic information using regex (simple approach)
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

      console.log('✅ Temporary website scrape completed successfully');

      return NextResponse.json({
        success: true,
        data: {
          id: 'temp-' + Date.now(), // Temporary ID
          url: url,
          page_title: pageTitle,
          meta_description: metaDescription,
          scraped_content: textContent,
          scrape_status: 'completed',
          scraped_at: new Date().toISOString()
        }
      });

    } catch (scrapeError) {
      console.error('❌ Website scraping failed:', scrapeError);
      
      return NextResponse.json({ 
        error: 'Website scraping failed', 
        details: scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
      }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('💥 Error in temporary website scraping:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
