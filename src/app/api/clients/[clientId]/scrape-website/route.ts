import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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

    console.log('🌐 Starting website scrape for client:', clientId, 'URL:', url);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if we already have a recent scrape for this URL
    const { data: existingScrape } = await supabase
      .from('website_scrapes')
      .select('*')
      .eq('client_id', clientId)
      .eq('url', url)
      .eq('scrape_status', 'completed')
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    // If we have a recent scrape (within 24 hours), return cached data
    if (existingScrape) {
      const hoursSinceScrape = (Date.now() - new Date(existingScrape.scraped_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceScrape < 24) {
        console.log('✅ Returning cached website scrape data (less than 24 hours old)');
        return NextResponse.json({
          success: true,
          scraped: false, // Not a new scrape
          data: existingScrape
        });
      }
    }

    // Create a new scrape record
    const { data: scrapeRecord, error: createError } = await supabase
      .from('website_scrapes')
      .insert([
        {
          client_id: clientId,
          url: url,
          scrape_status: 'pending'
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create scrape record:', createError);
      return NextResponse.json({ 
        error: 'Failed to create scrape record', 
        details: createError.message 
      }, { status: 500 });
    }

    try {
      // Perform the actual web scraping
      console.log('🔍 Fetching website content...');
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

      // Update the scrape record with results
      const { error: updateError } = await supabase
        .from('website_scrapes')
        .update({
          scraped_content: textContent,
          meta_description: metaDescription,
          page_title: pageTitle,
          scrape_status: 'completed',
          scraped_at: new Date().toISOString()
        })
        .eq('id', scrapeRecord.id);

      if (updateError) {
        console.error('❌ Failed to update scrape record:', updateError);
        throw updateError;
      }

      console.log('✅ Website scrape completed successfully');

      return NextResponse.json({
        success: true,
        scraped: true,
        data: {
          id: scrapeRecord.id,
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
      
      // Update scrape record with error
      await supabase
        .from('website_scrapes')
        .update({
          scrape_status: 'failed',
          scrape_error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
        })
        .eq('id', scrapeRecord.id);

      return NextResponse.json({ 
        error: 'Website scraping failed', 
        details: scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
      }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('💥 Error in website scraping:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    console.log('📄 Fetching website scrapes for client:', clientId);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: scrapes, error } = await supabase
      .from('website_scrapes')
      .select('*')
      .eq('client_id', clientId)
      .order('scraped_at', { ascending: false });

    if (error) {
      console.error('❌ Database query failed:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch scrapes', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ Website scrapes fetched successfully:', scrapes?.length || 0);

    return NextResponse.json({
      success: true,
      scrapes: scrapes || []
    });

  } catch (error: unknown) {
    console.error('💥 Error in fetch website scrapes:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
