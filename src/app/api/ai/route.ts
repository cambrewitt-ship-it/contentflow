import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData, isValidMediaData } from '../../../lib/blobUpload';
import { getUpcomingHolidays } from '../../../lib/data/holidays';
import { handleApiError } from '../../../lib/apiErrorHandler';
import { validateApiRequest } from '../../../lib/validationMiddleware';
import { aiRequestSchema } from '../../../lib/validators';
import { withAICreditCheck, trackAICreditUsage } from '../../../lib/subscriptionMiddleware';
import logger from '@/lib/logger';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max execution time (needed for AI processing)
export const runtime = 'nodejs'; // Use Node.js runtime for better performance

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Fetch brand context for a client
async function getBrandContext(clientId: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get client brand information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples, region')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      logger.error('Could not fetch client brand info:', { error: clientError?.message });
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
      logger.error('Could not fetch brand documents:', { error: docsError.message });
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
      logger.error('Could not fetch website scrapes:', { error: scrapeError.message });
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
      region: client.region,
      documents: documents || [],
      website: scrapes && Array.isArray(scrapes) && scrapes.length > 0 ? scrapes[0] : null,
    };

    return brandContext;
  } catch (error) {
    logger.error('Error fetching brand context:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check content length before processing
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const sizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);

      if (parseInt(contentLength) > 10 * 1024 * 1024) {
        logger.error(`Request too large: ${sizeMB}MB (max 10MB)`);
        return NextResponse.json(
          {
            error: 'Payload Too Large',
            message: `Request body is ${sizeMB}MB, maximum allowed is 10MB. Please use a smaller image.`,
          },
          { status: 413 }
        );
      }
    }

    // SUBSCRIPTION: Check AI credit limits
    const subscriptionCheck = await withAICreditCheck(request, 1);
    
    // Check if subscription check failed
    if (!subscriptionCheck.allowed) {
      logger.error('Subscription check failed:', subscriptionCheck.error);
      return NextResponse.json({ 
        error: subscriptionCheck.error || 'AI credit limit reached',
        details: subscriptionCheck.error
      }, { status: 403 });
    }
    
    // Validate that userId exists
    if (!subscriptionCheck.userId) {
      logger.error('User ID not found in subscription check');
      return NextResponse.json({ 
        error: 'User identification failed',
        details: 'Could not identify user for AI request'
      }, { status: 401 });
    }
    
    const userId = subscriptionCheck.userId;

    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(request, {
      body: aiRequestSchema,
      maxBodySize: 10 * 1024 * 1024,
    });

    if (!validation.success) {
      logger.error('AI request validation failed');
      return validation.response;
    }

    const body = validation.data.body!;

    // Debug: log received payload (omit large fields)
    try {
      const { imageData: _img, ...debugBody } = body as Record<string, unknown>;
      logger.info('📥 /api/ai received body:', {
        ...debugBody,
        hasImageData: !!(body as Record<string, unknown>).imageData,
      });
    } catch (_) {}

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let result: NextResponse;
    switch (body.action) {
      case 'analyze_image':
        result = await analyzeImage(openai, body.imageData as string, body.prompt as string | undefined);
        break;

      case 'generate_captions':
        // Accept aiContext from either aiContext or postNotes, allowing empty string for videos
        result = await generateCaptions(
          openai,
          body.imageData as string,
          body.aiContext ?? (body as Record<string, unknown>).postNotes as string | undefined,
          body.clientId as string | undefined,
          body.copyType as 'social-media' | 'email-marketing' | undefined,
          body.copyTone as 'promotional' | 'educational' | 'personal' | 'testimonial' | 'engagement' | undefined,
          body.postNotesStyle as 'quote-directly' | 'paraphrase' | 'use-as-inspiration' | undefined,
          body.imageFocus as 'main-focus' | 'supporting' | 'background' | 'none' | undefined
        );
        break;

      case 'remix_caption':
        result = await remixCaption(
          openai,
          body.imageData as string,
          body.prompt as string,
          body.existingCaptions as string[] | undefined,
          body.aiContext as string | undefined,
          body.clientId as string | undefined
        );
        break;

      case 'generate_content_ideas':
        result = await generateContentIdeas(openai, body.clientId as string, userId);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    // Track AI credit usage if request was successful
    if (result?.status === 200) {
      const bodyData = body as Record<string, unknown>;
      await trackAICreditUsage(
        userId,
        1,
        body.action as string,
        bodyData.clientId as string | undefined,
        {
          copyType: bodyData.copyType as string | undefined,
          copyTone: bodyData.copyTone as string | undefined,
          postNotesStyle: bodyData.postNotesStyle as string | undefined,
          imageFocus: bodyData.imageFocus as string | undefined,
        }
      );
    }

    return result;
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'ai_request',
      additionalData: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

async function analyzeImage(openai: OpenAI, imageData: string, prompt?: string) {
  try {
    // Validate image data
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }

    const systemPrompt = `You are an expert content creator and social media strategist. 
    Analyze the provided image and provide insights that would be valuable for creating engaging social media content.

    Focus on:
    - Visual elements and composition
    - Mood and atmosphere
    - Potential messaging angles
    - Target audience appeal
    - Content opportunities

    ${prompt ? `Additional context: ${prompt}` : ""}

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
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'analyze_image',
      additionalData: { hasPrompt: !!prompt }
    });
  }
}

async function generateCaptions(
  openai: OpenAI,
  imageData: string,
  aiContext?: string,
  clientId?: string,
  copyType?: string,
  copyTone?: string,
  postNotesStyle?: string,
  imageFocus?: string
) {
  // These helper functions are referenced, but may not be defined.
  // Provide stubs to prevent ReferenceError if they're missing.
  // In production, replace with real implementations.
  function getCopyToneInstructions(_copyTone: string) {
    return ""; // Stub: implement for real behavior
  }
  function getContentHierarchy(_aiContext: string | undefined, _postNotesStyle: string, _imageFocus: string) {
    return ""; // Stub: implement for real behavior
  }
  function getPostNotesInstructions(_postNotesStyle: string) {
    return ""; // Stub: implement for real behavior
  }
  function getImageInstructions(_imageFocus: string) {
    return ""; // Stub: implement for real behavior
  }

  try {
    // Check if this is a video placeholder (sent from frontend for videos)
    const isVideoPlaceholder = imageData === 'VIDEO_PLACEHOLDER' || imageData === '';
    const isVideo = isVideoPlaceholder;

    // For backwards compatibility - only validate if not a video placeholder
    let validation: { isValid: boolean; type: 'base64' | 'blob' | 'invalid' } = { isValid: true, type: 'base64' };
    if (!isVideoPlaceholder) {
      // Validate media data (supports both images and videos)
      const mediaValidation = isValidMediaData(imageData);
      if (!mediaValidation.isValid) {
        throw new Error('Invalid media data - must be blob URL or base64');
      }

      // For backwards compatibility with image validation
      validation = isValidImageData(imageData);
    }

    // Videos require post notes reference to guide copy, but allow empty string
    if (isVideo && (aiContext === undefined || aiContext === null)) {
      throw new Error('Post Notes are required for video content. AI cannot analyze videos visually.');
    }

    // Fetch brand context if clientId is provided
    let brandContext = null;
    if (clientId) {
      brandContext = await getBrandContext(clientId);
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

${brandContext.voice_examples ? `🎤 BRAND VOICE EXAMPLES (ABSOLUTE PRIORITY - NON-NEGOTIABLE):
${brandContext.voice_examples}

🚨 CRITICAL INSTRUCTION FOR BRAND VOICE:
- These examples show the EXACT tone, style, and personality your brand uses
- You MUST replicate this voice precisely in every caption
- Study the language patterns, expressions, and writing style
- Match the same level of formality/informality
- Use similar sentence structures and vocabulary
- If brand voice examples are provided, you MUST use them - generic content is unacceptable
- These examples take PRIORITY over all other brand guidelines` : ''}

${brandContext.dos || brandContext.donts ? `📋 AI CAPTION RULES (MANDATORY):
${brandContext.dos ? `✅ ALWAYS INCLUDE: ${brandContext.dos}` : ''}
${brandContext.donts ? `❌ NEVER INCLUDE: ${brandContext.donts}` : ''}` : ''}

🚫 HASHTAG POLICY (DEFAULT: NO HASHTAGS):
- DO NOT include hashtags in any captions unless explicitly mentioned in the Brand Information Do's section above
- Default behavior is NO hashtags for all content types (Email & Social Media)
- Only include hashtags if the brand explicitly requests them in their Do's

${brandContext.documents && brandContext.documents.length > 0 ? `📄 BRAND DOCUMENTS: ${brandContext.documents.length} document(s) available for reference` : ''}
${brandContext.website ? `🌐 WEBSITE CONTEXT: Available for reference` : ''}`;
    }

    const finalInstruction = copyType === "email-marketing" ? "" : "Provide only 3 captions, separated by blank lines. No introduction or explanation.";

    // Fix: the following referenced functions need to exist in scope for runtime
    const systemPrompt = copyType === "email-marketing" ?
      `# Professional Email Copy Generator

## Your Role
You are a professional email copywriter creating promotional email content.

## Brand Context
- **Company:** ${brandContext?.company || 'Not specified'} - ${brandContext?.value_proposition || 'Not specified'}
- **Tone:** ${brandContext?.tone || 'Professional'}
- **Audience:** ${brandContext?.audience || 'Not specified'}
- **Value Proposition:** ${brandContext?.value_proposition || 'Not specified'}

## Content Inputs
**Post Notes (Highest Priority):** ${aiContext || 'Not provided'}
**Visual Content:** ${imageData ? 'Image provided for analysis' : 'No image provided'}

## Task
Transform the user's message intent into professional email copy that:
1. Communicates the core message in refined, professional language
2. References relevant visual elements from the image naturally
3. Creates value and urgency appropriate for the business
4. Maintains the brand's voice and tone

## Output Format
Write exactly ONE email paragraph structured as:

[2-3 professional sentences conveying the message and value]

[Clear call-to-action]

## CRITICAL PRIORITY — POST NOTES
✓ The Post Notes are the HIGHEST-PRIORITY input and override all other guidance
✓ You MUST directly reference and explicitly mention the Post Notes content using the same key phrases
✓ Do NOT water down, generalize, or omit critical wording from the Post Notes
✓ When Post Notes are empty or not provided, proceed without fabricating content and rely on brand context

## Requirements
✓ Professional business language (translate casual language to professional tone)
✓ Email-appropriate formatting (no hashtags, no social media slang UNLESS explicitly instructed in Brand Information Do's)
✓ Specific details when provided (prices, dates, features)
✓ Action-oriented CTA appropriate to the business type
✓ Concise - maximum 4 sentences total
✗ No multiple options or variations
✗ No "\\n" literal text - use actual line breaks
✗ No casual social media language ("DM", "link in bio", emojis) unless specified in Brand Information Do's

Generate the email copy now.`
      :
      `# Social Media Content Creation System

## Content Strategy
**Copy Tone:** ${copyTone || 'General'}
**Post Notes Style:** ${postNotesStyle || 'Paraphrase'}
**Image Focus:** ${imageFocus || 'Supporting'}

## CRITICAL PRIORITY — POST NOTES
- The Post Notes are the TOP priority and override brand context and image analysis
- Every caption MUST directly reference and explicitly mention the Post Notes using the same key phrases
- Do NOT generalize away or omit critical wording from the Post Notes
- If Post Notes are empty or not provided, do NOT fabricate details; rely on brand context and image cues

## Copy Tone Instructions
${getCopyToneInstructions(copyTone || 'promotional')}

## Content Hierarchy & Approach
${getContentHierarchy(aiContext, postNotesStyle || 'paraphrase', imageFocus || 'supporting')}

${aiContext ? `## Post Notes Content
${aiContext}

**Processing Instructions:** ${getPostNotesInstructions(postNotesStyle || 'paraphrase')}` : ''}

${brandContextSection}

## Image Analysis Guidelines
${getImageInstructions(imageFocus || 'supporting')}

## Output Requirements
- Generate exactly 3 distinct captions
- Vary approaches: one short (1-2 lines), one medium (3-4 lines), one longer (5-6 lines)
- Each caption should offer a different angle while maintaining content consistency
- Use natural, conversational tone aligned with brand guidelines
- **DO NOT include hashtags UNLESS explicitly instructed to do so in the Brand Information Do's section**
- Format as ready-to-post social media captions

## Quality Standards
- Every caption must align with the selected copy tone
- Content must reflect the specified post notes handling approach  
- Image elements should be integrated according to focus level
- Brand voice and rules must be consistently applied
- Captions should be platform-appropriate and engaging

${finalInstruction}`;

    // Prepare the user message content
    const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
      {
        type: 'text',
        text: copyType === 'email-marketing'
          ? (aiContext
              ? 'Generate ONE single email paragraph (2-3 concise sentences + CTA) based on your Post Notes: "' + aiContext + '". Write as a professional email with actual line breaks between the main text and CTA. CRITICAL: Match the brand voice examples exactly - use the same tone, style, and personality. NO hashtags or social media formatting.'
              : 'Generate ONE single email paragraph (2-3 concise sentences + CTA) for this image. Write as a professional email with actual line breaks between the main text and CTA. CRITICAL: Match the brand voice examples exactly - use the same tone, style, and personality. NO hashtags or social media formatting.')
          : (aiContext
              ? 'CRITICAL: Your Post Notes are "' + aiContext + '". Generate exactly 3 social media captions that DIRECTLY mention and use these Post Notes. Every caption must include the actual content from your notes. Do not create generic captions - make the Post Notes the main focus of each caption. Start with the first caption immediately, no introduction needed.'
              : 'Generate exactly 3 social media captions for this image based on what you see. Start with the first caption immediately, no introduction needed.')
      }
    ];

    // Add image to content ONLY if it's actually an image (not a video or video placeholder)
    if (validation.isValid && imageData && !isVideo && !isVideoPlaceholder) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageData,
          detail: 'high'
        }
      });
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          // Casting due to OpenAI SDK type expectations for multimodal content structure
          content: userContent as any
        }
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse the response based on copy type
    let captions: string[] = [];

    if (copyType === 'email-marketing') {
      let processedContent = content.trim();
      processedContent = processedContent.replace(/\\n\\n/g, '\n\n');
      processedContent = processedContent.replace(/\\n/g, '\n');
      processedContent = processedContent.replace(/\.\s*([A-Z][^.!?]*[.!?]?)$/gm, '.\n\n$1');
      processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
      captions = processedContent.length > 20 ? [processedContent] : [];
    } else {
      let potentialCaptions = content.split(/\n\n+/);
      if (potentialCaptions.length < 3) {
        potentialCaptions = content.split(/\n/);
      }
      if (potentialCaptions.length < 3) {
        potentialCaptions = content.split(/\n-|\n\d+\./);
      }
      captions = potentialCaptions
        .map(caption => caption.trim())
        .filter(caption => {
          return caption.length > 15 &&
            !caption.toLowerCase().startsWith('here are') &&
            !caption.toLowerCase().startsWith('captions for') &&
            !caption.toLowerCase().startsWith('engaging captions') &&
            !caption.toLowerCase().startsWith('three captions');
        })
        .slice(0, 3);

      if (captions.length < 3) {
        const allLines = content.split(/\n/)
          .map(line => line.trim())
          .filter(line => line.length > 10);

        if (allLines.length >= 3) {
          captions = allLines.slice(0, 3);
        }
      }
    }

    return NextResponse.json({
      success: true,
      captions: captions
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'generate_captions',
      clientId: clientId,
      additionalData: {
        copyType,
        hasImageData: !!imageData,
        hasContext: !!aiContext
      }
    });
  }
}

async function remixCaption(
  openai: OpenAI,
  imageData: string,
  prompt: string,
  existingCaptions: string[] = [],
  aiContext?: string,
  clientId?: string
) {
  try {
    // Validate image data
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }

    // Fetch brand context if clientId is provided
    let brandContext = null;
    if (clientId) {
      brandContext = await getBrandContext(clientId);
    }

    let systemPrompt = 'You are a creative social media copywriter specializing in brand-aware content creation. ';
    systemPrompt += 'The user wants you to create a fresh variation of an existing caption.\n\n';
    systemPrompt += '🎯 YOUR TASK:\n';
    systemPrompt += 'Create a NEW version of the original caption that:\n';
    systemPrompt += "- Maintains the EXACT same meaning and message\n";
    systemPrompt += "- Uses DIFFERENT words and phrasing\n";
    systemPrompt += "- Keeps the SAME style, tone, and structure\n";
    systemPrompt += "- Incorporates the user's post notes naturally\n\n";
    systemPrompt += '🚨 CRITICAL REQUIREMENTS:\n';
    systemPrompt += "- DO NOT change the core message or meaning\n";
    systemPrompt += "- DO create a fresh variation with different wording\n";
    systemPrompt += "- DO maintain the same emotional tone and style\n";
    systemPrompt += "- DO include the post notes content naturally\n";
    systemPrompt += "- DO NOT add any explanations, introductions, or commentary\n";
    systemPrompt += "- DO NOT mention the image or try to analyze it\n\n";
    systemPrompt += '🎭 TONE MATCHING (HIGHEST PRIORITY):\n';
    systemPrompt += "- Study the original caption's tone, style, and personality\n";
    systemPrompt += "- Match the exact emotional feel and writing style\n";
    systemPrompt += "- If the original is casual and friendly, keep it casual and friendly\n";
    systemPrompt += "- If the original is professional and formal, keep it professional and formal\n";
    systemPrompt += "- Copy the same level of enthusiasm, humor, or seriousness\n\n";

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

      systemPrompt += "Use this brand context to ensure your variation matches the company's voice and style.\n\n";
    }

    if (brandContext && (brandContext.dos || brandContext.donts)) {
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

    // Fix: the prompt breakdown expects an "original" caption string, not the prompt itself
    let originalCaption = prompt;
    if (typeof prompt === 'string' && prompt.startsWith('Original caption: "')) {
      const match = prompt.match(/^Original caption: "(.*)"$/);
      if (match && match[1]) {
        originalCaption = match[1];
      }
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: 'Create a fresh variation of this caption: "' + originalCaption + '"'
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
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'remix_caption',
      clientId: clientId,
      additionalData: {
        hasImageData: !!imageData,
        hasContext: !!aiContext,
        hasExistingCaptions: existingCaptions.length > 0
      }
    });
  }
}

async function generateContentIdeas(openai: OpenAI, clientId: string, userId: string) {
  try {
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Get client brand context first (needed for region)
    const brandContext = await getBrandContext(clientId);
    if (!brandContext) {
      return NextResponse.json(
        { error: 'Could not fetch client brand context' },
        { status: 404 }
      );
    }

    // Get client region
    const clientRegion = brandContext.region || 'New Zealand - Wellington';

    // Get upcoming holidays - filter by region
    const allUpcomingHolidays = getUpcomingHolidays(8);
    
    // Filter holidays by client region
    const upcomingHolidays = allUpcomingHolidays.filter(holiday => {
      // Always include international holidays
      if (holiday.type === 'international') {
        return true;
      }
      
      // Include national holidays if client is in the same country
      if (holiday.category === 'National') {
        // Check if client region matches country
        if (clientRegion.includes('New Zealand') && (holiday.name.includes('Waitangi') || holiday.name.includes('ANZAC'))) {
          return true;
        }
        return true; // Include national holidays for now
      }
      
      // Filter regional holidays - only include if they match the client's region
      if (holiday.category === 'Regional') {
        // Extract region name from holiday (e.g., "Wellington Anniversary Day" -> "Wellington")
        const holidayRegion = holiday.name.replace(' Anniversary Day', '').replace(' Day', '');
        
        // Check if client region includes the holiday region
        if (clientRegion.includes(holidayRegion)) {
          return true;
        }
        return false; // Exclude regional holidays from other regions
      }
      
      // Include public holidays and other types by default
      return true;
    });

    // Determine locale based on client region
    let locale = 'en-NZ';
    if (clientRegion.includes('USA') || clientRegion.includes('United States')) {
      locale = 'en-US';
    } else if (clientRegion.includes('UK') || clientRegion.includes('United Kingdom')) {
      locale = 'en-GB';
    } else if (clientRegion.includes('Australia')) {
      locale = 'en-AU';
    } else if (clientRegion.includes('Canada')) {
      locale = 'en-CA';
    }

    // Get current date and season info
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Set to midnight for accurate date comparison
    const currentDate = now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Determine current season based on region (southern hemisphere vs northern)
    const month = now.getMonth() + 1;
    const isSouthernHemisphere = clientRegion.includes('New Zealand') || clientRegion.includes('Australia');
    let season = '';
    if (isSouthernHemisphere) {
      // Southern hemisphere seasons
      if (month === 12 || month === 1 || month === 2) season = 'Summer';
      else if (month >= 3 && month <= 5) season = 'Autumn';
      else if (month >= 6 && month <= 8) season = 'Winter';
      else season = 'Spring';
    } else {
      // Northern hemisphere seasons
      if (month === 12 || month === 1 || month === 2) season = 'Winter';
      else if (month >= 3 && month <= 5) season = 'Spring';
      else if (month >= 6 && month <= 8) season = 'Summer';
      else season = 'Autumn';
    }

    // Build industry-specific content guidance
    const industry = extractIndustry(brandContext.company || '');

    interface ClientData {
      company_description?: string;
      industry?: string;
      brand_tone?: string;
      target_audience?: string;
      value_proposition?: string;
      brand_voice_examples?: string;
      caption_dos?: string;
      caption_donts?: string;
    }

    interface HolidayData {
      name: string;
      date: string;
      daysUntil: number;
      marketingAngle: string;
    }

    interface CurrentContext {
      date: string;
      season: string;
      weatherContext: string;
    }

    const generateContentIdeasPrompt = (clientData: ClientData, holidays: HolidayData[], currentContext: CurrentContext, clientRegion: string) => {
      return `You are a senior marketing strategist with 15+ years of agency experience, generating high-converting social media content that drives measurable business results. You think in terms of customer journeys, platform algorithms, and competitive differentiation—not generic social media templates.



## Core Mission

Generate 3 strategically diverse content ideas that solve real business challenges for ${clientData.company_description || 'this client'}. Each idea must be platform-specific, actionable, and differentiated from typical industry content.



**Current Context:** ${currentContext.date} | ${currentContext.season} | ${clientRegion || 'Not specified'}



---



## CRITICAL DATE & HOLIDAY RULES



**ABSOLUTE REQUIREMENT:** Only suggest content for dates AFTER ${currentContext.date}



**Holiday Content Policy - DEFAULT TO NO HOLIDAYS:**

- ✅ 0 holiday ideas is IDEAL for most brands

- ✅ 3 evergreen ideas demonstrates superior strategic thinking  

- ⚠️ Only include a holiday if it scores 4/5 on the relevance test below

- 🚫 Never suggest holidays that have passed

- 🚫 Avoid obscure "international days" unless directly relevant



**Holiday Relevance Score (Must score 4/5+ to include):**

1. **Direct Business Connection** (2 pts) - Does this holiday relate to their products/services?

2. **Audience Alignment** (1 pt) - Would 70%+ of their audience genuinely care?

3. **Unique Angle** (1 pt) - Can they differentiate from competitors?

4. **Future-Dated** (1 pt) - Event is AFTER ${currentContext.date}?

5. **Authentic Fit** (1 pt) - Aligns with brand values and tone?



**Available Upcoming Events:** ${holidays.filter(h => h.daysUntil >= 0 && h.daysUntil <= 30).map(h => `${h.name} (${h.date})`).join(', ') || 'None - generate evergreen ideas'}



**If no holiday scores 4/5+, generate 3 evergreen ideas instead.**



---



## STRATEGIC FRAMEWORK



### Step 1: Client Intelligence Analysis



**Auto-detect from context:**

- **Industry:** ${clientData.industry || 'Determine from company description'}

- **Business Model:** B2B, B2C, D2C, Service-based, Product-based

- **Risk Level:** Standard, Sensitive (finance/health), High-risk (betting/alcohol/crypto)

- **Company:** ${clientData.company_description || 'Not specified'}

- **Target Audience:** ${clientData.target_audience || 'General consumers'}

- **Brand Tone:** ${clientData.brand_tone || 'Professional'}



**Critical Questions to Answer:**

1. **What keeps their audience awake at 3am?** (Pain points to address)

2. **What are they scrolling for?** (Entertainment, education, inspiration, solutions?)

3. **What would make them save/share this post?** (Value threshold)

4. **What objections do they have about this brand/industry?** (Address these)

5. **What unique insider knowledge does this brand have?** (Competitive advantage)



### Step 2: Content Funnel Strategy



**MANDATORY DISTRIBUTION (unless client specifies otherwise):**

- **2 ideas: TOFU (Top of Funnel)** - Awareness, education, entertainment for cold audiences

- **1 idea: MOFU/BOFU (Middle/Bottom)** - Consideration, conversion for warm/hot audiences



**TOFU Content Characteristics:**

- Solves audience problems without selling

- Educational, entertaining, or inspirational

- Broad appeal, easily shareable

- No hard CTAs, builds trust first

- Examples: "5 mistakes in [industry]", Behind-the-scenes, Industry myths debunked



**MOFU Content Characteristics:**

- Demonstrates expertise and results

- Case studies, client testimonials, process reveals

- Builds credibility and trust

- Soft CTAs (Learn more, Follow for tips)

- Examples: "How we helped [client type]", Before/after, ROI breakdowns



**BOFU Content Characteristics:**

- Direct conversion focus

- Limited offers, exclusive access, strong urgency

- Clear, action-oriented CTAs

- Examples: Flash sales, Consultation offers, Limited spots



### Step 3: Competitive Differentiation Mandate



**BEFORE finalizing ANY idea, pass this test:**

- ❌ **Reject if:** 5+ competitors would post the exact same thing

- ✅ **Approve if:** This leverages unique insider knowledge, proprietary processes, or brand personality

- ✅ **Ideal:** Only THIS brand could create this content authentically



**Differentiation Sources:**

- Proprietary methodologies or processes

- Unique brand personality/voice

- Specific client results and data

- Behind-the-scenes access others don't have

- Controversial or contrarian industry takes

- Local/regional relevance



### Step 4: Platform & Format Intelligence



**Platform Selection Criteria:**



**LinkedIn** - Best for:

- B2B services, Professional services, SaaS, Corporate

- Thought leadership, industry insights, career content

- Formats: Carousels, text posts with personal stories, video interviews



**Instagram** - Best for:

- Visual products, Lifestyle brands, Retail, Health/Wellness

- Behind-the-scenes, aesthetic content, short tutorials

- Formats: Reels (priority), Carousels, Stories, Static posts



**TikTok/Reels** - Best for:

- Consumer brands, Entertainment, Education with personality

- Quick tips, transformations, trending audio usage

- Format: Vertical video 15-60 seconds



**Facebook** - Best for:

- Local businesses, Community-focused brands, Older demographics

- Event promotion, community engagement, longer-form stories

- Formats: Video, community posts, event announcements



**Twitter/X** - Best for:

- Tech, Finance, News-related, Real-time commentary

- Hot takes, industry news, quick insights

- Format: Text threads, quote tweets, polls



### Step 5: Psychological Trigger Integration



**Incorporate these persuasion principles strategically:**



- **Social Proof:** "Join 10,000+ [audience]", Client testimonials, User-generated content

- **Scarcity:** "Only 5 spots left", Seasonal exclusivity, Limited-time offers

- **Authority:** Credentials, Awards, Media features, Industry recognition

- **Reciprocity:** Free value upfront (guides, templates, insights)

- **FOMO:** "What [successful people] know that you don't", Trend warnings

- **Curiosity Gap:** "The [surprising thing] about [topic]", Tease without full reveal

- **Transformation:** Before/after, Problem/solution, Old way vs. new way



---



## INDUSTRY-SPECIFIC PLAYBOOKS



**B2B/Professional Services** (Consulting, SaaS, Agencies):

- Platform priority: LinkedIn > Twitter > Instagram

- Content focus: Thought leadership, ROI demonstrations, process transparency

- Avoid: Consumer holidays, casual memes, overly salesy content

- Win with: Data insights, case studies, industry predictions, "How we think differently"

- Tone: Authoritative but accessible, conversational professionalism



**Consumer/Retail** (E-commerce, Fashion, Home goods):

- Platform priority: Instagram > TikTok > Facebook

- Content focus: Lifestyle integration, styling tips, social proof

- Leverage: User-generated content, unboxing, seasonal trends

- Win with: Aesthetic consistency, relatable scenarios, aspirational but achievable

- Tone: Friendly, on-trend, community-focused



**Health/Wellness** (Fitness, Mental health, Nutrition):

- Platform priority: Instagram > TikTok > YouTube

- Content focus: Education, transformation stories, myth-busting

- Avoid: Medical claims, quick fixes, before/after that seem fake

- Win with: Science-backed info, realistic progress, community support

- Tone: Encouraging, evidence-based, empathetic



**Finance/Legal** (Accounting, Law, Insurance):

- Platform priority: LinkedIn > Facebook > Twitter

- Content focus: Simplifying complex topics, risk mitigation, trust-building

- Avoid: Most holidays, casual tone, anything that could be misinterpreted

- Win with: Clear explanations, real scenarios, "What most people get wrong"

- Tone: Professional, trustworthy, educational



**Local/Service Businesses** (Restaurants, Salons, Contractors):

- Platform priority: Instagram > Facebook > Google Business

- Content focus: Behind-the-scenes, customer spotlights, local community

- Leverage: User-generated content, local events, team personalities

- Win with: Authenticity, consistency, community connection

- Tone: Warm, personable, locally-rooted



**High-Risk Industries** (Betting, Alcohol, Crypto):

- Platform priority: Depends on regulations

- Content focus: Entertainment value, community, education (not promotion)

- Avoid: Almost ALL holidays, anything controversial, hard selling

- Win with: Responsible messaging, entertainment, very conservative approach

- Tone: Mature, responsible, community-first



---



## CONTENT CATEGORIES & STRATEGIC MIX



**AUTHORITY CONTENT** (Positions as Industry Expert):

- Educational insights solving real customer problems

- Industry trend analysis and future predictions

- "Insider knowledge" and professional tips

- Data-driven insights with actionable takeaways

- Myth-busting common misconceptions

- "Here's what most people get wrong about [topic]"



**SOCIAL PROOF CONTENT** (Builds Trust & Credibility):

- Client success stories with specific results

- Team milestones and company achievements

- Industry recognition and awards

- User-generated content and testimonials

- Behind-the-scenes showing quality/process

- "What our customers say" features



**ENGAGEMENT CONTENT** (Drives Community & Interaction):

- Thought-provoking questions (no engagement bait)

- Polls and opinions on industry topics

- Controversial but professional takes

- Fill-in-the-blank that reveals audience needs

- "Comment [emoji] if..." but with strategic purpose

- Community spotlights and shoutouts



**CONVERSION CONTENT** (Drives Direct Business Results):

- Strategic offers with clear business purpose

- Limited-time promotions with genuine urgency

- Referral programs with mutual benefit

- Free value with clear next step (lead magnet)

- Exclusive access or early-bird opportunities

- "DM us [word]" for personalized follow-up



---



## QUALITY ASSURANCE CHECKPOINTS



**Before finalizing each idea, verify:**



✅ **Strategic Value:** Would a CMO approve this? Does it solve a real business problem?

✅ **Audience Relevance:** Would the target audience genuinely care and engage?

✅ **Competitive Edge:** Is this differentiated from typical industry content?

✅ **Platform Fit:** Is this optimized for the recommended platform's algorithm?

✅ **Business Results:** Could this reasonably drive measurable business outcomes?

✅ **Brand Alignment:** Does this match their tone (${clientData.brand_tone})?

✅ **Production Feasibility:** Can they actually create this with reasonable resources?

✅ **Risk Assessment:** Could this be misinterpreted or damage reputation?

✅ **Funnel Distribution:** Do I have 2 TOFU + 1 MOFU/BOFU?

✅ **Date Validation:** If holiday-related, is it AFTER ${currentContext.date} AND does it score 4/5+?



**If ANY answer is NO, generate a different idea.**



---



## OUTPUT FORMAT



Deliver 3 ideas in this exact format:



---



**IDEA 1:** [Concise strategic title, no colons]



**Funnel Stage:** [TOFU / MOFU / BOFU]  

**Primary Platform:** [LinkedIn/Instagram/TikTok/Facebook - with 1-line reasoning]  

**Content Format:** [Reel/Carousel/Static Image/Story/Text Post/Video]  

**Business Goal:** [Specific outcome - Leads/Awareness/Trust/Sales]



**Target Audience Insight:** [The specific pain point or desire this addresses]



**Content Angle:** [The unique perspective only this brand can take]



**Visual Concept:** [Specific, actionable visual description]



**Hook/Opening:** [First line that stops the scroll - 8-12 words max]



**Content Structure:**

- Opening: [Hook expansion - 1 sentence]

- Body: [2-3 key points to cover]

- Close: [Wrap-up message]



**CTA Strategy:** [Specific action - Comment, Share, DM, Click bio, Save, etc.]



**Hashtag Strategy:** [3-5 strategic hashtags: mix of niche + broader reach]



**Success Metric:** [What to measure - Saves/Shares/DMs/Clicks/Comments]



**Pro Tip:** [One insider tactical suggestion for execution]



---



**IDEA 2:** [Structure repeats]



---



**IDEA 3:** [Structure repeats]



---



**CONTENT SERIES OPPORTUNITY:** [If 2+ ideas could build on each other as a series, note it here. Otherwise write "N/A"]



---



## FINAL STRATEGIC REMINDERS



🎯 **Think executive-level:** Every idea must justify itself strategically, not just creatively  

🎯 **Platform-first:** Tailor content to where it will be posted, not generic multi-platform  

🎯 **Evergreen preference:** Timeless value beats trendy hooks (0 holidays is ideal)  

🎯 **Audience obsession:** What do THEY need, not what's easy to create  

🎯 **Differentiation mandate:** If competitors would post the same thing, reject it  

🎯 **Results orientation:** Every idea must have a clear path to business value  

🎯 **Production reality:** Can this actually be created with reasonable effort?  



**Remember:** You're not filling a template. You're solving business challenges through strategic content. Each idea should demonstrate why a company would pay an agency executive for this thinking.`;
    };

    const currentContext: CurrentContext = {
      date: currentDate,
      season: season,
      weatherContext: `${season} weather patterns in ${clientRegion}`
    };

    const clientData: ClientData = {
      company_description: brandContext.company,
      industry: industry,
      brand_tone: brandContext.tone,
      target_audience: brandContext.audience,
      value_proposition: brandContext.value_proposition,
      brand_voice_examples: brandContext.voice_examples,
      caption_dos: brandContext.dos,
      caption_donts: brandContext.donts
    };

    // Filter to only future holidays (exclude past dates)
    const futureHolidays = upcomingHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0); // Set to midnight for accurate comparison
      return holidayDate >= today; // Only include holidays on or after today
    });

    const formattedHolidays: HolidayData[] = futureHolidays.map(holiday => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: holiday.name,
        date: holidayDate.toLocaleDateString(locale),
        daysUntil: Math.max(0, daysUntil), // Ensure non-negative
        marketingAngle: holiday.marketingAngle
      };
    });

    const systemPrompt = generateContentIdeasPrompt(clientData, formattedHolidays, currentContext, clientRegion);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Generate 5 content ideas for this client. Current date is ${currentDate}. Client region: ${clientRegion}. IMPORTANT: Only suggest ideas for future holidays and events that occur AFTER ${currentDate}. DO NOT suggest regional holidays from other regions - only use regional holidays relevant to ${clientRegion}. If a holiday or seasonal event has already passed, use evergreen content ideas instead. Only use the holidays listed in the "Available FUTURE Holidays" section - do not suggest holidays that are not listed there or that have already passed.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse the new format response
    let ideas: Array<{ idea: string; angle: string; visualSuggestion: string; timing: string; holidayConnection: string }> = [];
    try {
      // Match IDEA X: ... blocks with their sub-lines
      const ideaMatches = content.match(/IDEA \d+: (.+?)\n\*\*Purpose:\*\* (.+?)\n\*\*Visual:\*\* (.+?)\n\*\*Hook:\*\* (.+?)(?=\nIDEA \d+:|\n\n|$)/gs);

      if (ideaMatches && ideaMatches.length > 0) {
        ideas = ideaMatches.map(match => {
          const lines = match.split('\n');
          return {
            idea: lines[0].replace(/IDEA \d+: /, '').trim(),
            angle: lines[1].replace(/\*\*Purpose:\*\* /, '').trim(),
            visualSuggestion: lines[2].replace(/\*\*Visual:\*\* /, '').trim(),
            timing: lines[3].replace(/\*\*Hook:\*\* /, '').trim(),
            holidayConnection: "Strategic content aligned with business goals"
          };
        });
      } else {
        // Fallback: try to parse as JSON (for backward compatibility)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          ideas = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse response format');
        }
      }
    } catch (parseError) {
      logger.error('Failed to parse content ideas response:', parseError);

      // Fallback: create basic ideas structure
      ideas = [
        {
          idea: "Expert Authority",
          angle: "Share industry insights that position your brand as the go-to expert",
          visualSuggestion: "Clean infographic with key insights and data",
          timing: "Here's what most people don't know about [industry topic]...",
          holidayConnection: "Evergreen content that builds authority year-round"
        },
        {
          idea: "Client Success Story",
          angle: "Showcase a real client transformation to build trust and credibility",
          visualSuggestion: "Before/after photos with testimonial quote overlay",
          timing: "Sarah's journey from [problem] to [solution] in just 3 months...",
          holidayConnection: "Social proof content that converts regardless of season"
        },
        {
          idea: "Behind the Scenes",
          angle: "Reveal your process and team to build personal connection with audience",
          visualSuggestion: "Candid team photos or process documentation",
          timing: "Ever wondered how we [key process]? Here's a day in our office...",
          holidayConnection: "Authentic content that humanizes your brand"
        }
      ];
    }

    // Fix: ensure fallback returns 3 ideas only, but do not slice if already 3
    if (!Array.isArray(ideas) || ideas.length < 3 || ideas.length > 3) {
      logger.warn('Content ideas response format invalid, using fallback');
      ideas = ideas.slice(0, 3);
    }

    return NextResponse.json({
      success: true,
      ideas: ideas
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'generate_content_ideas',
      clientId: clientId,
      additionalData: { clientId }
    });
  }
}

// Helper function to extract industry from company description
function extractIndustry(companyDescription: string): string {
  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Retail', 'Food & Beverage',
    'Fashion', 'Beauty', 'Fitness', 'Education', 'Real Estate',
    'Travel', 'Automotive', 'Professional Services', 'Manufacturing',
    'Construction', 'Agriculture', 'Entertainment', 'Non-profit'
  ];

  const description = companyDescription ? companyDescription.toLowerCase() : '';
  for (const industry of industries) {
    if (description.includes(industry.toLowerCase())) {
      return industry;
    }
  }

  return 'General Business';
}

// Helper function to provide industry-specific content guidance
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getIndustryContentGuidance(companyDescription: string): string {
  const industry = extractIndustry(companyDescription);

  const guidanceMap: Record<string, string> = {
    'Technology': `
- Focus on innovation, digital transformation, and tech trends
- Use screenshots, demos, and technical visuals
- Highlight problem-solving and efficiency improvements
- Target tech-savvy professionals and early adopters`,

    'Healthcare': `
- Emphasize patient care, wellness, and medical expertise
- Use professional medical imagery and infographics
- Focus on health education and preventive care
- Target health-conscious individuals and families`,

    'Finance': `
- Highlight financial security, investment advice, and planning
- Use charts, graphs, and financial visualizations
- Focus on trust, expertise, and long-term relationships
- Target individuals and businesses seeking financial guidance`,

    'Retail': `
- Showcase products, customer experiences, and shopping benefits
- Use high-quality product photography and lifestyle images
- Focus on value, quality, and customer satisfaction
- Target consumers and shopping enthusiasts`,

    'Food & Beverage': `
- Emphasize taste, quality ingredients, and dining experiences
- Use appetizing food photography and kitchen scenes
- Focus on flavor, freshness, and culinary expertise
- Target food lovers and dining enthusiasts`,

    'Fashion': `
- Highlight style, trends, and personal expression
- Use fashion photography and lifestyle imagery
- Focus on aesthetics, quality, and individual style
- Target fashion-conscious consumers`,

    'Beauty': `
- Emphasize transformation, self-care, and confidence
- Use beauty photography and before/after visuals
- Focus on results, techniques, and self-expression
- Target beauty enthusiasts and self-care advocates`,

    'Fitness': `
- Highlight health, strength, and personal achievement
- Use action photography and fitness demonstrations
- Focus on motivation, results, and healthy lifestyle
- Target fitness enthusiasts and health-conscious individuals`,

    'Education': `
- Emphasize learning, growth, and knowledge sharing
- Use educational graphics and classroom imagery
- Focus on skill development and academic success
- Target students, parents, and lifelong learners`,

    'Real Estate': `
- Highlight properties, locations, and lifestyle opportunities
- Use property photography and neighborhood imagery
- Focus on investment potential and lifestyle benefits
- Target homebuyers, investors, and property seekers`,

    'Travel': `
- Emphasize experiences, destinations, and adventure
- Use travel photography and destination imagery
- Focus on discovery, relaxation, and cultural experiences
- Target travelers and adventure seekers`,

    'Automotive': `
- Highlight performance, reliability, and innovation
- Use vehicle photography and technical specifications
- Focus on safety, efficiency, and driving experience
- Target car enthusiasts and vehicle buyers`,

    'Professional Services': `
- Emphasize expertise, results, and client success
- Use professional headshots and office imagery
- Focus on trust, competence, and value delivery
- Target business owners and decision-makers`,

    'Manufacturing': `
- Highlight quality, innovation, and production excellence
- Use factory imagery and product showcases
- Focus on precision, efficiency, and reliability
- Target industry professionals and business buyers`,

    'Construction': `
- Emphasize craftsmanship, safety, and project completion
- Use construction site photography and finished projects
- Focus on quality workmanship and project success
- Target property owners and construction professionals`,

    'Agriculture': `
- Highlight sustainability, quality, and farming expertise
- Use farm photography and agricultural imagery
- Focus on natural products and farming practices
- Target consumers and agricultural professionals`,

    'Entertainment': `
- Emphasize fun, creativity, and memorable experiences
- Use event photography and entertainment imagery
- Focus on enjoyment, engagement, and entertainment value
- Target entertainment seekers and event attendees`,

    'Non-profit': `
- Highlight impact, community service, and social causes
- Use community photography and impact imagery
- Focus on social good, volunteerism, and positive change
- Target supporters, volunteers, and community members`
  };

  return guidanceMap[industry] || `
- Focus on your unique value proposition and customer benefits
- Use professional imagery that represents your brand
- Highlight what makes your business special
- Target your ideal customers and their needs`;
}

// Handle CORS preflight requests
export async function OPTIONS(_request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
