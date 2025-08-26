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
    const { scrapeId } = await request.json();
    
    if (!scrapeId) {
      return NextResponse.json({ error: 'Scrape ID is required' }, { status: 400 });
    }

    console.log('🤖 Starting AI analysis for client:', clientId, 'scrape:', scrapeId);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch the scraped website content
    const { data: scrapeData, error: fetchError } = await supabase
      .from('website_scrapes')
      .select('*')
      .eq('id', scrapeId)
      .eq('client_id', clientId)
      .eq('scrape_status', 'completed')
      .single();

    if (fetchError || !scrapeData) {
      console.error('❌ Failed to fetch scrape data:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch scrape data', 
        details: fetchError?.message || 'Scrape not found' 
      }, { status: 404 });
    }

    console.log('📄 Analyzing website content for:', scrapeData.url);

    // Prepare content for AI analysis
    const contentForAnalysis = `
Website: ${scrapeData.url}
Title: ${scrapeData.page_title || ''}
Meta Description: ${scrapeData.meta_description || ''}
Content: ${scrapeData.scraped_content || ''}
    `.trim();

    // AI Analysis using OpenAI
    const analysisResult = await analyzeWebsiteContent(contentForAnalysis);

    console.log('✅ AI analysis completed successfully');

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      source: {
        url: scrapeData.url,
        scrapeId: scrapeData.id,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    console.error('💥 Error in AI analysis:', error);
    return NextResponse.json({ 
      error: 'AI analysis failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function analyzeWebsiteContent(content: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert business analyst. Analyze the provided website content and extract key business information. Return ONLY a valid JSON object with the following structure:

{
  "business_description": "2-3 sentence description of what the company does",
  "industry_category": "e.g., 'B2B SaaS', 'E-commerce Fashion', 'Healthcare', 'Digital Marketing Agency'",
  "core_products_services": ["Service 1", "Service 2", "Service 3"],
  "target_audience": "Who they serve (e.g., 'SMB owners', 'Gen Z consumers', 'Enterprise clients')",
  "value_proposition": "Their unique selling point or main benefit"
}

Be concise and accurate. If information is unclear, use reasonable inference based on the content.`
          },
          {
            role: 'user',
            content: `Analyze this website content and extract the business information:\n\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content;

    if (!analysisText) {
      throw new Error('No analysis content received from OpenAI');
    }

    // Parse the JSON response
    const analysis = JSON.parse(analysisText);
    
    // Validate the structure
    const requiredFields = ['business_description', 'industry_category', 'core_products_services', 'target_audience', 'value_proposition'];
    for (const field of requiredFields) {
      if (!analysis[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return analysis;

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
