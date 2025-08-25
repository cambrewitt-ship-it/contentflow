import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fetch brand context for a client
async function getBrandContext(clientId: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get client brand information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('company_description, website_url, brand_tone, target_audience, industry, brand_keywords')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client) {
      console.warn('Could not fetch client brand info:', clientError);
      return null;
    }

    // Get brand documents
    const { data: documents, error: docsError } = await supabase
      .from('brand_documents')
      .select('extracted_text, original_filename')
      .eq('client_id', clientId)
      .eq('processing_status', 'completed')
      .not('extracted_text', 'is', null);
    
    if (docsError) {
      console.warn('Could not fetch brand documents:', docsError);
    }

    // Get website scrapes
    const { data: scrapes, error: scrapeError } = await supabase
      .from('website_scrapes')
      .select('scraped_content, page_title, meta_description')
      .eq('client_id', clientId)
      .eq('scrape_status', 'completed')
      .not('scraped_content', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(1);
    
    if (scrapeError) {
      console.warn('Could not fetch website scrapes:', scrapeError);
    }

    // Build comprehensive brand context
    const brandContext = {
      company: client.company_description,
      tone: client.brand_tone,
      audience: client.target_audience,
      industry: client.industry,
      keywords: client.brand_keywords || [],
      documents: documents || [],
      website: scrapes?.[0] || null
    };

    return brandContext;
  } catch (error) {
    console.error('Error fetching brand context:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, imageData, prompt, existingCaptions, aiContext, clientId } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'analyze_image':
        return await analyzeImage(imageData, prompt);
      
      case 'generate_captions':
        return await generateCaptions(imageData, existingCaptions, aiContext, clientId);
      
      case 'remix_caption':
        return await remixCaption(imageData, prompt, existingCaptions, aiContext, clientId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function analyzeImage(imageData: string, prompt?: string) {
  try {
    const systemPrompt = `You are an expert content creator and social media strategist. 
    Analyze the provided image and provide insights that would be valuable for creating engaging social media content.
    
    Focus on:
    - Visual elements and composition
    - Mood and atmosphere
    - Potential messaging angles
    - Target audience appeal
    - Content opportunities
    
    ${prompt ? `Additional context: ${prompt}` : ''}
    
    Provide your analysis in a clear, structured format.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image for social media content creation:'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      analysis: response.choices[0]?.message?.content || 'No analysis generated'
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}

async function generateCaptions(imageData: string, existingCaptions: string[] = [], aiContext?: string, clientId?: string) {
  try {
    // Fetch brand context if clientId is provided
    let brandContext = null;
    if (clientId) {
      console.log('🎯 Fetching brand context for client:', clientId);
      brandContext = await getBrandContext(clientId);
      console.log('✅ Brand context fetched:', brandContext ? 'Available' : 'None');
      if (brandContext) {
        console.log('📊 Brand context details:', {
          company: brandContext.company ? 'Set' : 'Not set',
          tone: brandContext.tone || 'Not set',
          audience: brandContext.audience || 'Not set',
          industry: brandContext.industry || 'Not set',
          keywords: brandContext.keywords?.length || 0,
          documents: brandContext.documents?.length || 0,
          website: brandContext.website ? 'Available' : 'None'
        });
      }
    }

    const systemPrompt = `You are a creative social media copywriter specializing in brand-aware content creation. 
    Generate exactly 3 engaging, diverse captions for the provided image.
    
    CRITICAL REQUIREMENTS:
    - User notes and image analysis take HIGHEST PRIORITY - incorporate these first and foremost
    - Brand information serves as GUIDING CONTEXT to inform tone, style, and messaging
    - Each caption should be different in tone and approach
    - Include relevant hashtags (3-5 per caption)
    - Keep captions engaging and shareable
    - Consider the visual elements and mood of the image
    - Make them suitable for platforms like Instagram, Facebook, or LinkedIn
    
    ${aiContext ? `USER PRIORITY CONTEXT (incorporate this first): ${aiContext}` : ''}
    
    ${brandContext ? `BRAND GUIDING CONTEXT (use to inform style and tone):
    - Company: ${brandContext.company || 'Not specified'}
    - Brand Tone: ${brandContext.tone || 'Not specified'}
    - Target Audience: ${brandContext.audience || 'Not specified'}
    - Industry: ${brandContext.industry || 'Not specified'}
    - Brand Keywords: ${brandContext.keywords?.join(', ') || 'None specified'}
    ${brandContext.documents?.length > 0 ? `- Brand Documents: ${brandContext.documents.map(d => `${d.original_filename}: ${d.extracted_text?.substring(0, 200)}...`).join('\n    ')}` : ''}
    ${brandContext.website ? `- Website Content: ${brandContext.website.page_title || ''} - ${brandContext.website.meta_description || ''} - ${brandContext.website.scraped_content?.substring(0, 300)}...` : ''}
    
    Use this brand context to ensure your captions align with the company's voice, target the right audience, and incorporate relevant industry terminology and brand keywords naturally.` : ''}
    
    ${existingCaptions.length > 0 ? `Avoid duplicating these existing captions: ${existingCaptions.join(', ')}` : ''}
    
    IMPORTANT: Start directly with the first caption. Do not include any introductory text like "Here are three captions:" or similar. Just provide the 3 captions directly, each separated by a blank line.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Generate exactly 3 social media captions for this image. Start with the first caption immediately, no introduction needed.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse the response into individual captions
    let captions = content
      .split(/\n\n|\n-|\n\d+\./)
      .filter(caption => {
        const trimmed = caption.trim();
        // Filter out introductory text and ensure minimum length
        return trimmed.length > 20 && 
               !trimmed.toLowerCase().includes('here are') &&
               !trimmed.toLowerCase().includes('captions for') &&
               !trimmed.toLowerCase().includes('engaging captions') &&
               !trimmed.toLowerCase().includes('three captions') &&
               !trimmed.toLowerCase().includes('social media') &&
               !trimmed.toLowerCase().includes('for your image');
      })
      .map(caption => caption.trim())
      .slice(0, 3);
    
    // Ensure we have exactly 3 captions
    if (captions.length < 3) {
      console.warn(`Only generated ${captions.length} captions, expected 3`);
      // If we don't have 3 captions, try to split the content more aggressively
      if (captions.length < 3) {
        const fallbackCaptions = content
          .split(/\n/)
          .filter(line => line.trim().length > 15)
          .map(line => line.trim())
          .filter(line => !line.toLowerCase().includes('here are') && 
                         !line.toLowerCase().includes('captions for') &&
                         !line.toLowerCase().includes('engaging captions') &&
                         !line.toLowerCase().includes('three captions') &&
                         !line.toLowerCase().includes('social media') &&
                         !line.toLowerCase().includes('for your image'))
          .slice(0, 3);
        
        if (fallbackCaptions.length >= 3) {
          captions = fallbackCaptions;
        }
      }
    }

    return NextResponse.json({
      success: true,
      captions: captions
    });
  } catch (error) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    );
  }
}

async function remixCaption(imageData: string, prompt: string, existingCaptions: string[] = [], aiContext?: string, clientId?: string) {
  try {
    // Fetch brand context if clientId is provided
    let brandContext = null;
    if (clientId) {
      brandContext = await getBrandContext(clientId);
    }

    const systemPrompt = `You are a creative social media copywriter specializing in brand-aware content creation. 
    The user wants to remix/improve a caption based on their feedback.
    
    User feedback: ${prompt}
    
    CRITICAL REQUIREMENTS:
    - User feedback takes HIGHEST PRIORITY - address this directly and completely
    - Brand information serves as GUIDING CONTEXT to inform tone, style, and messaging
    - Maintain the core message while improving based on feedback
    
    ${aiContext ? `USER PRIORITY CONTEXT: ${aiContext}` : ''}
    
    ${brandContext ? `BRAND GUIDING CONTEXT (use to inform style and tone):
    - Company: ${brandContext.company || 'Not specified'}
    - Brand Tone: ${brandContext.tone || 'Not specified'}
    - Target Audience: ${brandContext.audience || 'Not specified'}
    - Industry: ${brandContext.industry || 'Not specified'}
    - Brand Keywords: ${brandContext.keywords?.join(', ') || 'None specified'}
    
    Use this brand context to ensure your improved caption aligns with the company's voice, targets the right audience, and incorporates relevant industry terminology and brand keywords naturally.` : ''}
    
    ${existingCaptions.length > 0 ? `Existing captions for reference: ${existingCaptions.join(', ')}` : ''}
    
    Generate 1 improved caption that addresses the user's feedback while maintaining the core message and adding relevant hashtags.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please remix this caption based on my feedback:'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      caption: response.choices[0]?.message?.content || 'No caption generated'
    });
  } catch (error) {
    console.error('Caption remix error:', error);
    return NextResponse.json(
      { error: 'Failed to remix caption' },
      { status: 500 }
    );
  }
}
