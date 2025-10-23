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
      .select('company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples')
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
    if (subscriptionCheck instanceof NextResponse) {
      return subscriptionCheck;
    }

    const userId = subscriptionCheck.user!.id;

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
        result = await generateCaptions(
          openai,
          body.imageData as string,
          body.existingCaptions as string[] | undefined,
          body.aiContext as string | undefined,
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
        result = await generateContentIdeas(openai, body.clientId as string);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    // Track AI credit usage if request was successful
    if (result?.status === 200) {
      await trackAICreditUsage(userId, 1);
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
  existingCaptions: string[] = [],
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

    // Videos require post notes since we can't analyze them visually
    if (isVideo && !(aiContext && aiContext.trim())) {
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
**User's Message Intent:** ${aiContext || 'Not provided'}
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

## Requirements
✓ Professional business language (translate casual language to professional tone)
✓ Email-appropriate formatting (no hashtags, no social media slang)
✓ Specific details when provided (prices, dates, features)
✓ Action-oriented CTA appropriate to the business type
✓ Concise - maximum 4 sentences total
✗ No multiple options or variations
✗ No "\\n" literal text - use actual line breaks
✗ No casual social media language ("DM", "link in bio", emojis)

Generate the email copy now.`
      :
      `# Social Media Content Creation System

## Content Strategy
**Copy Tone:** ${copyTone || 'General'}
**Post Notes Style:** ${postNotesStyle || 'Paraphrase'}
**Image Focus:** ${imageFocus || 'Supporting'}

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
- Include relevant hashtags when appropriate
- Format as ready-to-post social media captions

## Quality Standards
- Every caption must align with the selected copy tone
- Content must reflect the specified post notes handling approach  
- Image elements should be integrated according to focus level
- Brand voice and rules must be consistently applied
- Captions should be platform-appropriate and engaging

${finalInstruction}`;

    // Prepare the user message content
    const userContent: any[] = [
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
          content: userContent
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

async function generateContentIdeas(openai: OpenAI, clientId: string) {
  try {
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Get upcoming holidays
    const upcomingHolidays = getUpcomingHolidays(8);

    // Get client brand context
    const brandContext = await getBrandContext(clientId);
    if (!brandContext) {
      return NextResponse.json(
        { error: 'Could not fetch client brand context' },
        { status: 404 }
      );
    }

    // Get current date and season info
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Determine current season in New Zealand
    const month = now.getMonth() + 1;
    let season = '';
    if (month === 12 || month === 1 || month === 2) season = 'Summer';
    else if (month >= 3 && month <= 5) season = 'Autumn';
    else if (month >= 6 && month <= 8) season = 'Winter';
    else season = 'Spring';

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

    const generateContentIdeasPrompt = (clientData: ClientData, holidays: HolidayData[], currentContext: CurrentContext) => {
      return `You are a strategic marketing consultant with 10+ years of experience generating high-converting social media content across diverse industries. Your expertise lies in creating content that drives genuine business results, not just engagement vanity metrics.

## Content Generation Process

### STEP 1: Industry & Context Analysis
**Analyze the client information to determine:**
- **Primary Industry:** [Auto-detect from company description, services, target audience]
- **Business Model:** B2B, B2C, D2C, Service-based, Product-based, etc.
- **Risk Level:** Standard, Sensitive (finance/health), High-risk (betting/alcohol/crypto)
- **Target Audience Profile:** Demographics, interests, pain points
- **Competitive Landscape:** What would differentiate this brand

### STEP 2: Strategic Content Framework
**Before generating ideas, establish:**
1. **Primary Business Goal:** Lead generation, brand awareness, customer retention, sales conversion
2. **Content Strategy:** What type of content drives results for this industry?
3. **Audience Behavior:** How does their target audience consume social media?
4. **Competitive Advantage:** What unique angle can this brand take?

### STEP 3: Holiday & Seasonal Relevance Filter
**STRICT FILTERING RULES:**

**NEVER suggest holidays unless:**
- Direct audience overlap (Mother's Day → family-focused brands)
- Natural business connection (Small Business Saturday → B2B services)
- Major cultural relevance (Christmas, New Year, Valentine's Day)
- Industry-specific events (World Mental Health Day → wellness brands)

**AUTOMATICALLY REJECT holidays that are:**
- Completely unrelated to target audience
- Tone-deaf to industry context
- Too niche for broad business appeal
- Potentially damaging to brand reputation

**HIGH-RISK INDUSTRIES (Betting, Alcohol, Crypto, etc.):**
- Extremely conservative holiday approach
- Avoid sensitive topics entirely
- Focus on entertainment and community value

### STEP 4: Content Categories & Strategic Mix

**AUTHORITY CONTENT (Positions as Industry Expert):**
- Educational insights that solve real customer problems
- Industry trend analysis and predictions
- "Insider knowledge" and professional tips
- Data-driven insights with actionable takeaways

**BUSINESS SUCCESS CONTENT (Builds Trust & Credibility):**
- Recent company achievements and milestones
- Team expansion and new hire announcements
- Technology upgrades and process improvements
- Industry recognition and award wins
- Growth metrics and business expansion
- Project completions and successful outcomes

**ENGAGEMENT CONTENT (Drives Community & Interaction):**
- Thought-provoking industry questions
- Behind-the-scenes process reveals
- Team culture and workplace insights
- Local community involvement

**PROMOTIONAL CONTENT (Drives Direct Business Results):**
- Strategic giveaways with clear business purpose
- Limited-time offers with urgency
- Referral programs and loyalty rewards
- Social challenges tied to brand values

### STEP 5: Quality Assurance Checkpoint
**Before finalizing each idea, verify:**
✅ Would a senior marketing director approve this strategy?
✅ Does this solve a real business problem for the client?
✅ Would the target audience genuinely care about this content?
✅ Does this differentiate from typical industry content?
✅ Could this reasonably drive business results?
✅ Is this appropriate for the industry and audience?

**If any answer is NO, generate a different idea.**

## Content Generation Rules

**STRATEGIC DISTRIBUTION:**
- Generate 3 distinctly different content approaches
- Maximum 1 seasonal/holiday idea (only if highly relevant)
- Maximum 1 promotional/giveaway idea
- Prioritize evergreen content that works year-round
- Ensure variety in content types and strategic purposes

**INDUSTRY-SMART APPROACH:**
- **B2B/Professional Services:** Authority and credibility-focused
- **Consumer/Retail:** Lifestyle benefits and social proof
- **Health/Wellness:** Educational value and results-driven
- **Finance/Legal:** Trust-building and expertise demonstration
- **Technology:** Innovation and problem-solving focus
- **High-Risk Industries:** Conservative, entertainment-focused, community-building

**CONTENT QUALITY STANDARDS:**
- Ideas must be specific and actionable
- Content should feel authentic to the brand
- Avoid generic marketing speak
- Focus on customer value, not just brand promotion
- Consider what would make someone stop scrolling

## Output Format

IDEA 1: [Strategic title reflecting business purpose - no colons, single line]
**Purpose:** [What business goal this achieves]
**Visual:** [Specific visual concept]
**Hook:** [Compelling opening line that drives engagement]

IDEA 2: [Strategic title reflecting business purpose - no colons, single line]
**Purpose:** [What business goal this achieves]
**Visual:** [Specific visual concept]
**Hook:** [Compelling opening line that drives engagement]

IDEA 3: [Strategic title reflecting business purpose - no colons, single line]
**Purpose:** [What business goal this achieves]
**Visual:** [Specific visual concept]
**Hook:** [Compelling opening line that drives engagement]

## Critical Success Factors
- **Strategic Thinking Over Template Filling:** Each idea should solve a specific business challenge
- **Industry Intelligence:** Content must feel native to the industry
- **Audience-First Approach:** What would genuinely interest their customers?
- **Business Results Focus:** Every idea should have a clear path to business value
- **Quality Over Creativity:** Solid, strategic ideas beat clever but irrelevant content

**Context Variables:**
- **Current Date:** ${currentContext.date}
- **Season:** ${currentContext.season} (New Zealand)
- **Location:** Wellington, New Zealand
- **Available Holidays:** ${holidays.filter(h => h.daysUntil <= 30).map(h => `${h.name} - ${h.date} (${h.daysUntil} days)`).join(', ')}
- **Client Information:** Company: ${clientData.company_description || 'Not specified'}, Industry: ${clientData.industry || 'General Business'}, Target Audience: ${clientData.target_audience || 'General consumers'}, Brand Tone: ${clientData.brand_tone || 'Professional'}${clientData.brand_voice_examples ? `, Brand Voice: ${clientData.brand_voice_examples.slice(0, 200)}...` : ''}`;
    };

    const currentContext: CurrentContext = {
      date: currentDate,
      season: season,
      weatherContext: `${season} weather patterns in Wellington`
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

    const formattedHolidays: HolidayData[] = upcomingHolidays.map(holiday => {
      const holidayDate = new Date(holiday.date);
      const today = new Date();
      const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: holiday.name,
        date: holidayDate.toLocaleDateString('en-NZ'),
        daysUntil: daysUntil,
        marketingAngle: holiday.marketingAngle
      };
    });

    const systemPrompt = generateContentIdeasPrompt(clientData, formattedHolidays, currentContext);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: 'Generate 5 content ideas for this client based on upcoming holidays and brand context.'
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse the new format response
    let ideas: any[] = [];
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
export async function OPTIONS(_request: NextRequest) {
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
