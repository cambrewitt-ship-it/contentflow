import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

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

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Create a temporary scrape record with a temporary client_id
    const tempClientId = 'temp-' + Date.now(); // Generate a temporary client ID
    const { data: scrapeRecord, error: createError } = await supabase
      .from('website_scrapes')
      .insert([
        {
          client_id: tempClientId,
          url: url,
          scrape_status: 'pending'
        }
      ])
      .select()
      .single();

    if (createError) {
      logger.error('❌ Failed to create scrape record:', createError);
      return NextResponse.json({ 
        error: 'Failed to create scrape record', 
        details: createError.message 
      
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
      
      // Extract basic information using regex (same as working version)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      
      const pageTitle = titleMatch ? titleMatch[1].trim() : '';
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';
      
      // Extract text content (remove HTML tags) - same as working version
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
        logger.error('❌ Failed to update scrape record:', updateError);
        throw updateError;
      }

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

    } catch (scrapeError) {
      logger.error('❌ Website scraping failed:', scrapeError);
      
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
      
    }

  } catch (error: unknown) {
    logger.error('💥 Error in temporary website scraping:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    
  }
}