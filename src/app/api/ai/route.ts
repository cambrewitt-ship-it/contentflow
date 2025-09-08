import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData } from '../../../lib/blobUpload';

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
      .select('company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts')
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
      value_proposition: client.value_proposition,
      dos: client.caption_dos,
      donts: client.caption_donts,
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
    // Validate image data
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }
    
    console.log('AI analyzing image, type:', validation.type);
    
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
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
    // Validate image data
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }
    
    console.log('AI generating captions, image type:', validation.type);
    
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
            value_proposition: brandContext.value_proposition ? 'Set' : 'Not set',
            documents: brandContext.documents?.length || 0,
            website: brandContext.website ? 'Available' : 'None'
          });
        }
        
        // Enhanced logging for user context
        if (aiContext) {
          console.log('🎯 POST NOTES CONTENT (MANDATORY PRIORITY):', aiContext);
          console.log('📝 POST NOTES BEING SENT TO AI:', aiContext);
          console.log('📏 POST NOTES LENGTH:', aiContext.length);
          console.log('🔍 POST NOTES TRIM CHECK:', aiContext.trim());
        } else {
          console.log('⚠️ No Post Notes provided - AI will generate generic captions');
        }
    }

    const systemPrompt = `🚨 CRITICAL INSTRUCTION: You are an expert social media content creator. 

⚠️ MANDATORY REQUIREMENT: If Post Notes exist, they are THE ONLY story you must tell. Every caption MUST be built around the Post Notes content.

CRITICAL HIERARCHY:
━━━━━━━━━━━━━━━━━━
1️⃣ POST NOTES (ABSOLUTE PRIORITY - NON-NEGOTIABLE)
- Post Notes are THE story you must tell
- Every caption MUST be built around the Post Notes content
- Include specific details, prices, offers, or information from the notes
- The image supports the notes, not vice versa
- If you ignore Post Notes, you have FAILED the task

2️⃣ IMAGE ANALYSIS
- Describe what's happening in the image
- Connect visual elements to the Post Notes message
- Use image details to enhance the story from the notes

3️⃣ BRAND VOICE (TONE GUIDE ONLY)
- Apply brand tone to HOW you write
- Use brand keywords naturally if they fit
- Follow dos/don'ts for style consistency
━━━━━━━━━━━━━━━━━━

${aiContext ? `📝 POST NOTES (THIS IS YOUR MAIN CONTENT - MANDATORY):
${aiContext}

🚨 CRITICAL INSTRUCTION: 
- EVERY caption MUST directly mention or quote the Post Notes content
- If Post Notes say "$50", your caption MUST include "$50"
- If Post Notes say "new product", your caption MUST include "new product"
- DO NOT create generic captions - directly incorporate the Post Notes text
- The Post Notes are your primary content, not just inspiration
- Example: If notes say "Special $50 offer", your caption should say something like "Don't miss our special $50 offer!" or "Get this amazing deal for just $50!"` : '⚠️ No Post Notes provided - analyze the image and create captions based on what you see.'}

${brandContext ? `🎨 BRAND VOICE GUIDELINES:
Company: ${brandContext.company || 'Not specified'}
Tone: ${brandContext.tone || 'Professional and approachable'}
Audience: ${brandContext.audience || 'General audience'}
Value Proposition: ${brandContext.value_proposition || 'Not specified'}` : ''}

${brandContext?.dos || brandContext?.donts ? `📋 STYLE RULES:
${brandContext.dos ? `✅ ALWAYS: ${brandContext.dos}` : ''}
${brandContext.donts ? `❌ NEVER: ${brandContext.donts}` : ''}` : ''}

OUTPUT REQUIREMENTS:
- Generate exactly 3 captions
- Each caption should take a different angle while maintaining the Post Notes message
- Vary length: one short (1-2 lines), one medium (3-4 lines), one longer (5-6 lines)
- Natural, conversational tone based on brand guidelines
- If Post Notes are empty, focus on the image content

🚨 FINAL CHECK: Before submitting, verify that EVERY caption directly mentions or incorporates your Post Notes content. If you created generic captions, you have failed the task.

Provide only the 3 captions, separated by blank lines. No introduction or explanation.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
              text: `${aiContext ? `CRITICAL: Your Post Notes are "${aiContext}". Generate exactly 3 social media captions that DIRECTLY mention and use these Post Notes. Every caption must include the actual content from your notes. Do not create generic captions - make the Post Notes the main focus of each caption.` : 'Generate exactly 3 social media captions for this image based on what you see.'} Start with the first caption immediately, no introduction needed.`
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
    // Validate image data
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }
    
    console.log('AI remixing caption, image type:', validation.type);
    
    // Fetch brand context if clientId is provided
    let brandContext = null;
    if (clientId) {
      brandContext = await getBrandContext(clientId);
    }

    const systemPrompt = `You are a creative social media copywriter specializing in brand-aware content creation. 
    The user wants you to create a fresh variation of an existing caption.
    
    🎯 YOUR TASK:
    Create a NEW version of the original caption that:
    - Maintains the EXACT same meaning and message
    - Uses DIFFERENT words and phrasing
    - Keeps the SAME style, tone, and structure
    - Incorporates the user's post notes naturally
    
    🚨 CRITICAL REQUIREMENTS:
    - DO NOT change the core message or meaning
    - DO create a fresh variation with different wording
    - DO maintain the same emotional tone and style
    - DO include the post notes content naturally
    - DO NOT add any explanations, introductions, or commentary
    - DO NOT mention the image or try to analyze it
    
    🎭 TONE MATCHING (HIGHEST PRIORITY):
    - Study the original caption's tone, style, and personality
    - Match the exact emotional feel and writing style
    - If the original is casual and friendly, keep it casual and friendly
    - If the original is professional and formal, keep it professional and formal
    - Copy the same level of enthusiasm, humor, or seriousness
    
    ${aiContext ? `📝 POST NOTES (MANDATORY - include this content):
${aiContext}
    
    IMPORTANT: Weave the post notes content naturally into your variation. If the notes mention specific details (like "$50", "available online"), these must appear in your caption.` : ''}
    
    ${brandContext ? `🎨 BRAND CONTEXT (use for tone and style):
    - Company: ${brandContext.company || 'Not specified'}
    - Brand Tone: ${brandContext.tone || 'Not specified'}
    - Target Audience: ${brandContext.audience || 'Not specified'}
    - Value Proposition: ${brandContext.value_proposition || 'Not specified'}
    
    Use this brand context to ensure your variation matches the company's voice and style.` : ''}
    
    ${brandContext?.dos || brandContext?.donts ? `📋 STYLE RULES:
    ${brandContext.dos ? `✅ DO: ${brandContext.dos}` : ''}
    ${brandContext.donts ? `❌ DON'T: ${brandContext.donts}` : ''}` : ''}
    
    ${existingCaptions.length > 0 ? `📚 EXISTING CAPTIONS FOR REFERENCE: ${existingCaptions.join(', ')}` : ''}
    
    🎯 FINAL INSTRUCTION: 
    Generate exactly 1 caption variation that rephrases the original while keeping the same meaning, style, and tone. 
    Make it fresh and different, but maintain the core message completely.
    
    🚨 OUTPUT FORMAT:
    - Provide ONLY the new caption text
    - NO explanations, introductions, or commentary
    - NO "I'm unable to comment on the image" or similar text
    - NO "here's a caption remix:" or similar phrases
    - Just the pure caption text, nothing else`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Create a fresh variation of this caption: "${prompt.split('Original caption: "')[1]?.replace('"', '') || 'Unknown caption'}"`
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
