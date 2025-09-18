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
      .select('company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples')
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
      voice_examples: client.brand_voice_examples,
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
    const { action, imageData, prompt, existingCaptions, aiContext, clientId, copyType } = await request.json();

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
        return await generateCaptions(imageData, existingCaptions, aiContext, clientId, copyType);
      
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

async function generateCaptions(imageData: string, existingCaptions: string[] = [], aiContext?: string, clientId?: string, copyType?: string) {
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

    // Build brand context section
    let brandContextSection = '';
    if (brandContext) {
      brandContextSection = `
🎨 BRAND CONTEXT (ESSENTIAL FOR ALL CAPTIONS):
${brandContext.company ? `💼 COMPANY: ${brandContext.company}` : ''}
${brandContext.tone ? `🎭 BRAND TONE: ${brandContext.tone}` : ''}
${brandContext.audience ? `👥 TARGET AUDIENCE: ${brandContext.audience}` : ''}
${brandContext.value_proposition ? `🎯 VALUE PROPOSITION: ${brandContext.value_proposition}` : ''}

${brandContext.voice_examples ? `🎤 BRAND VOICE EXAMPLES (STRONG GUIDELINES - MATCH THIS STYLE):
${brandContext.voice_examples}

🚨 CRITICAL: Study these examples carefully and write captions that match this exact style, tone, and voice. These examples show how the brand actually sounds - replicate this voice precisely.` : ''}

${brandContext.dos || brandContext.donts ? `📋 AI CAPTION RULES (MANDATORY):
${brandContext.dos ? `✅ ALWAYS INCLUDE: ${brandContext.dos}` : ''}
${brandContext.donts ? `❌ NEVER INCLUDE: ${brandContext.donts}` : ''}` : ''}

${brandContext.documents && brandContext.documents.length > 0 ? `📄 BRAND DOCUMENTS: ${brandContext.documents.length} document(s) available for reference` : ''}
${brandContext.website ? `🌐 WEBSITE CONTEXT: Available for reference` : ''}`;
    }

    const systemPrompt = `🚨 CRITICAL INSTRUCTION: You are an expert social media content creator. 

${aiContext ? `⚠️ MANDATORY REQUIREMENT: Post Notes are THE ONLY story you must tell. Every caption MUST be built around the Post Notes content.

CRITICAL HIERARCHY:
━━━━━━━━━━━━━━━━━━
1️⃣ POST NOTES (ABSOLUTE PRIORITY - NON-NEGOTIABLE)
- Post Notes are THE story you must tell
- Every caption MUST be built around the Post Notes content
- Include specific details, prices, offers, or information from the notes
- The image supports the notes, not vice versa
- If you ignore Post Notes, you have FAILED the task

2️⃣ BRAND VOICE & RULES (APPLY TO HOW YOU WRITE)
- Use the brand tone and style guidelines
- Follow the AI Caption Rules (dos/don'ts) religiously
- Target the specific audience mentioned
- Apply brand personality to the Post Notes content

3️⃣ IMAGE ANALYSIS
- Describe what's happening in the image
- Connect visual elements to the Post Notes message
- Use image details to enhance the story from the notes
━━━━━━━━━━━━━━━━━━` : `🎯 BRAND-FOCUSED CAPTION CREATION: Create captions that align with the brand's voice, values, and target audience.

CRITICAL HIERARCHY:
━━━━━━━━━━━━━━━━━━
1️⃣ BRAND CONTEXT (PRIMARY FOCUS)
- Use the company's value proposition and brand tone
- Target the specific audience mentioned
- Incorporate brand personality and messaging
- Reference company description when relevant

2️⃣ AI CAPTION RULES (MANDATORY)
- Follow the dos/don'ts religiously
- Apply brand guidelines for style consistency
- Use brand tone consistently

3️⃣ IMAGE ANALYSIS
- Describe what's happening in the image
- Connect visual elements to brand messaging
- Use image details to support brand story
━━━━━━━━━━━━━━━━━━`}

${aiContext ? `📝 POST NOTES (THIS IS YOUR MAIN CONTENT - MANDATORY):
${aiContext}

🚨 CRITICAL INSTRUCTION: 
- EVERY caption MUST directly mention or quote the Post Notes content
- If Post Notes say "$50", your caption MUST include "$50"
- If Post Notes say "new product", your caption MUST include "new product"
- DO NOT create generic captions - directly incorporate the Post Notes text
- The Post Notes are your primary content, not just inspiration
- Example: If notes say "Special $50 offer", your caption should say something like "Don't miss our special $50 offer!" or "Get this amazing deal for just $50!"` : ''}

${brandContextSection}

${copyType === 'email-marketing' ? `📧 EMAIL MARKETING COPY REQUIREMENTS:
- Generate ONE single email paragraph (NOT multiple captions or social media posts)
- Format: 2-4 sentences + CTA on a new line
- NO hashtags, NO social media formatting
- Write as a professional email paragraph
- TONE & STYLE:
  - Write at 6th-8th grade reading level
  - Active voice > passive voice
  - "You" focused (2:1 ratio of "you" to "we/I")
  - One idea per sentence
  - Conversational but professional
- STRUCTURE:
  - 2-4 sentences describing the offer/product/service
  - Call-to-action on a separate line
  - NO bullet points, NO multiple paragraphs
  - NO social media elements` : `📱 SOCIAL MEDIA COPY REQUIREMENTS:
- Generate social media post captions
- Create engaging, platform-appropriate content
- Include relevant hashtags when appropriate
- Focus on social engagement and brand awareness
- Use social media best practices (visual storytelling, community building)`}

OUTPUT REQUIREMENTS:
- Generate exactly ${copyType === 'email-marketing' ? '1 single email paragraph' : '3 captions'}
- ${copyType === 'email-marketing' ? 'Format as: [2-4 sentences describing the offer/product/service]\\n\\n[Call-to-action on new line]' : 'Each caption should take a different angle while ' + (aiContext ? 'maintaining the Post Notes message' : 'showcasing different aspects of the brand')}
- ${copyType === 'email-marketing' ? 'Make it engaging, conversion-focused, and professional' : 'Vary length: one short (1-2 lines), one medium (3-4 lines), one longer (5-6 lines)'}
- Natural, conversational tone based on brand guidelines
- ${aiContext ? 'Always incorporate Post Notes content' : 'Always incorporate brand context and speak to the target audience'}
- ${copyType === 'email-marketing' ? 'DO NOT generate multiple captions, hashtags, or social media formatting - create ONE single email paragraph' : 'Format as social media post captions'}

${aiContext ? '🚨 FINAL CHECK: Before submitting, verify that EVERY ${copyType === "email-marketing" ? "email" : "caption"} directly mentions or incorporates your Post Notes content AND follows the brand guidelines. If you created generic content, you have failed the task.' : '🚨 FINAL CHECK: Before submitting, verify that EVERY ${copyType === "email-marketing" ? "email" : "caption"} reflects the brand tone, speaks to the target audience, and incorporates brand context. Generic content is not acceptable.'}

${copyType === 'email-marketing' ? 'Provide ONLY 1 single email paragraph in this exact format: [2-4 sentences about the offer/product] followed by a blank line, then [Call-to-action]. Use actual line breaks, not \\n characters. Do NOT provide multiple options, captions, hashtags, or social media formatting.' : 'Provide only 3 captions, separated by blank lines. No introduction or explanation.'}`;

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
              text: copyType === 'email-marketing' 
                ? (aiContext 
                    ? 'Generate ONE single email paragraph (2-4 sentences + CTA) based on your Post Notes: "' + aiContext + '". Write as a professional email with actual line breaks between the main text and CTA. NO hashtags or social media formatting.'
                    : 'Generate ONE single email paragraph (2-4 sentences + CTA) for this image. Write as a professional email with actual line breaks between the main text and CTA. NO hashtags or social media formatting.')
                : (aiContext 
                    ? 'CRITICAL: Your Post Notes are "' + aiContext + '". Generate exactly 3 social media captions that DIRECTLY mention and use these Post Notes. Every caption must include the actual content from your notes. Do not create generic captions - make the Post Notes the main focus of each caption. Start with the first caption immediately, no introduction needed.'
                    : 'Generate exactly 3 social media captions for this image based on what you see. Start with the first caption immediately, no introduction needed.')
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
    
    // Parse the response based on copy type
    let captions;
    
    if (copyType === 'email-marketing') {
      // For email marketing, treat the entire response as one piece of content
      let processedContent = content.trim();
      
      // Fix common formatting issues
      // Replace literal \n\n with actual line breaks
      processedContent = processedContent.replace(/\\n\\n/g, '\n\n');
      processedContent = processedContent.replace(/\\n/g, '\n');
      
      // Ensure proper CTA formatting - if there's text after a period and before the end,
      // make sure it's on a new line
      processedContent = processedContent.replace(/\.\s*([A-Z][^.!?]*[.!?]?)$/gm, '.\n\n$1');
      
      // Clean up any double line breaks
      processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
      
      captions = processedContent.length > 20 ? [processedContent] : [];
    } else {
      // For social media, parse into individual captions
      captions = content
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
      
      // Ensure we have exactly 3 captions for social media
      if (captions.length < 3) {
        console.warn('Only generated ' + captions.length + ' captions, expected 3');
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

    // Build system prompt with proper string concatenation
    let systemPrompt = 'You are a creative social media copywriter specializing in brand-aware content creation. ';
    systemPrompt += 'The user wants you to create a fresh variation of an existing caption.\n\n';
    systemPrompt += '🎯 YOUR TASK:\n';
    systemPrompt += 'Create a NEW version of the original caption that:\n';
    systemPrompt += '- Maintains the EXACT same meaning and message\n';
    systemPrompt += '- Uses DIFFERENT words and phrasing\n';
    systemPrompt += '- Keeps the SAME style, tone, and structure\n';
    systemPrompt += '- Incorporates the user\'s post notes naturally\n\n';
    systemPrompt += '🚨 CRITICAL REQUIREMENTS:\n';
    systemPrompt += '- DO NOT change the core message or meaning\n';
    systemPrompt += '- DO create a fresh variation with different wording\n';
    systemPrompt += '- DO maintain the same emotional tone and style\n';
    systemPrompt += '- DO include the post notes content naturally\n';
    systemPrompt += '- DO NOT add any explanations, introductions, or commentary\n';
    systemPrompt += '- DO NOT mention the image or try to analyze it\n\n';
    systemPrompt += '🎭 TONE MATCHING (HIGHEST PRIORITY):\n';
    systemPrompt += '- Study the original caption\'s tone, style, and personality\n';
    systemPrompt += '- Match the exact emotional feel and writing style\n';
    systemPrompt += '- If the original is casual and friendly, keep it casual and friendly\n';
    systemPrompt += '- If the original is professional and formal, keep it professional and formal\n';
    systemPrompt += '- Copy the same level of enthusiasm, humor, or seriousness\n\n';
    
    if (aiContext) {
      systemPrompt += '📝 POST NOTES (MANDATORY - include this content):\n';
      systemPrompt += aiContext + '\n\n';
      systemPrompt += 'IMPORTANT: Weave the post notes content naturally into your variation. If the notes mention specific details (like "$50", "available online"), these must appear in your caption.\n\n';
    }
    
    if (brandContext) {
      systemPrompt += '🎨 BRAND CONTEXT (use for tone and style):\n';
      systemPrompt += '- Company: ' + (brandContext.company || 'Not specified') + '\n';
      systemPrompt += '- Brand Tone: ' + (brandContext.tone || 'Not specified') + '\n';
      systemPrompt += '- Target Audience: ' + (brandContext.audience || 'Not specified') + '\n';
      systemPrompt += '- Value Proposition: ' + (brandContext.value_proposition || 'Not specified') + '\n\n';
      
      if (brandContext.voice_examples) {
        systemPrompt += '🎤 BRAND VOICE EXAMPLES (MATCH THIS STYLE):\n';
        systemPrompt += brandContext.voice_examples + '\n\n';
        systemPrompt += '🚨 CRITICAL: Study these examples and ensure your variation matches this exact style and voice.\n\n';
      }
      
      systemPrompt += 'Use this brand context to ensure your variation matches the company\'s voice and style.\n\n';
    }
    
    if (brandContext?.dos || brandContext?.donts) {
      systemPrompt += '📋 STYLE RULES:\n';
      if (brandContext.dos) {
        systemPrompt += '✅ DO: ' + brandContext.dos + '\n';
      }
      if (brandContext.donts) {
        systemPrompt += '❌ DON\'T: ' + brandContext.donts + '\n';
      }
      systemPrompt += '\n';
    }
    
    if (existingCaptions.length > 0) {
      systemPrompt += '📚 EXISTING CAPTIONS FOR REFERENCE: ' + existingCaptions.join(', ') + '\n\n';
    }
    
    systemPrompt += '🎯 FINAL INSTRUCTION: \n';
    systemPrompt += 'Generate exactly 1 caption variation that rephrases the original while keeping the same meaning, style, and tone. \n';
    systemPrompt += 'Make it fresh and different, but maintain the core message completely.\n\n';
    systemPrompt += '🚨 OUTPUT FORMAT:\n';
    systemPrompt += '- Provide ONLY the new caption text\n';
    systemPrompt += '- NO explanations, introductions, or commentary\n';
    systemPrompt += '- NO "I\'m unable to comment on the image" or similar text\n';
    systemPrompt += '- NO "here\'s a caption remix:" or similar phrases\n';
    systemPrompt += '- Just the pure caption text, nothing else';

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: 'Create a fresh variation of this caption: "' + (prompt.split('Original caption: "')[1]?.replace('"', '') || 'Unknown caption') + '"'
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
