import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidImageData, isValidMediaData } from '../../../lib/blobUpload';
import { getUpcomingHolidays } from '../../../lib/data/holidays';
import { handleApiError } from '../../../lib/apiErrorHandler';
import { validateApiRequest } from '../../../lib/validationMiddleware';
import { aiRequestSchema } from '../../../lib/validators';
import { withAICreditCheck, trackAICreditUsage } from '../../../lib/subscriptionMiddleware';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

export const maxDuration = 60;
// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Use Node.js runtime for better performance

function getCopyToneInstructions(copyTone: string) {
  const toneMap: Record<string, string> = {
    promotional: `
**Promotional Focus:**
- Lead with compelling offers, benefits, or value propositions
- Include clear, actionable calls-to-action
- Create urgency where appropriate ("limited time", "don't miss out")
- Highlight specific deals, prices, or exclusive opportunities
- Use persuasive language that drives immediate action`,

    educational: `
**Educational Focus:**
- Share valuable insights, tips, or industry knowledge
- Position the brand as a trusted expert and resource
- Use informative, helpful language that teaches or guides
- Include practical advice or actionable takeaways
- Build authority through expertise demonstration`,

    personal: `
**Personal Focus:**
- Use authentic, behind-the-scenes storytelling
- Share personal experiences, insights, or day-in-the-life content
- Create genuine connections with a conversational tone
- Include personal anecdotes or authentic moments
- Build trust through transparency and relatability`,

    testimonial: `
**Testimonial Focus:**
- Highlight client success stories and positive outcomes
- Use social proof to build credibility and trust
- Include specific results, achievements, or transformations
- Feature client quotes, reviews, or feedback when available
- Demonstrate value through real-world examples`,

    engagement: `
**Engagement Focus:**
- Ask questions to encourage audience interaction
- Create conversation starters and community discussion
- Use interactive elements like polls, opinions, or experiences
- Invite audience to share their thoughts or stories
- Build community through two-way communication`
  };

  return toneMap[copyTone] || '**General Social Media Copy:** Create engaging, brand-appropriate content that drives social interaction.';
}

function getPostNotesApproach(style: string) {
  const approaches: Record<string, string> = {
    'quote-directly': 'Use exact wording and specific details from notes',
    paraphrase: "Rewrite notes content in brand voice while keeping all key information",
    'use-as-inspiration': 'Capture the essence and intent of notes with creative interpretation'
  };
  return approaches[style] || 'Incorporate notes content appropriately';
}

function getImageRole(focus: string) {
  const roles: Record<string, string> = {
    'main-focus': 'Primary Content Driver',
    supporting: 'Content Enhancer',
    background: 'Context Provider',
    none: 'Not Used'
  };
  return roles[focus] || 'Supporting';
}

function getImageDescription(focus: string) {
  const descriptions: Record<string, string> = {
    'main-focus': "Build captions around what's shown in the image",
    supporting: 'Use image details to enhance and support the main message',
    background: 'Reference image elements briefly for context',
    none: 'Focus entirely on text content, ignore image'
  };
  return descriptions[focus] || 'Use image details to support content';
}

function getPostNotesInstructions(style: string) {
  const instructions: Record<string, string> = {
    'quote-directly': 'Include specific phrases, numbers, and details exactly as written. If notes mention "$50 special offer", your caption must include "$50 special offer".',
    paraphrase: "Rewrite the notes content in the brand's voice while preserving all key information, prices, dates, and important details.",
    'use-as-inspiration': 'Capture the core message and intent from the notes, using them as a foundation for brand-appropriate content.'
  };
  return instructions[style] || 'Incorporate the notes content appropriately based on context.';
}

function getImageInstructions(focus: string) {
  const instructions: Record<string, string> = {
    'main-focus': `
**Primary Image Focus:**
- Describe the key elements, setting, and visual story
- Build captions around what's prominently featured
- Connect all content back to the main visual elements
- Use the image as the central narrative foundation`,

    supporting: `
**Supporting Image Role:**
- Identify relevant visual elements that enhance the message
- Connect image details to the main content theme
- Use visuals to add credibility and context
- Balance image references with primary content focus`,

    background: `
**Background Image Context:**
- Briefly acknowledge the setting or context shown
- Use minimal image references to support the message
- Focus primarily on text content with light visual mentions
- Keep image descriptions concise and contextual`,

    none: `
**Text-Only Focus:**
- Do not reference or describe image elements
- Focus entirely on post notes and brand messaging
- Create content independent of visual elements
- Treat this as text-based content creation`
  };

  return instructions[focus] || instructions.supporting;
}

function isRefusalResponse(content?: string | null): boolean {
  if (!content) return false;
  const normalized = content.toLowerCase();
  const refusalPhrases = [
    "i'm sorry",
    'i am sorry',
    'i cannot assist',
    "i can't assist",
    'i cannot help',
    "i can't help",
    "i'm unable to",
    'i am unable to',
    'cannot comply',
    'cannot fulfill',
    'i will not comply',
    'i cannot provide that',
    'i cannot provide',
    'i do not have the ability to',
    'refuse to'
  ];

  return refusalPhrases.some(phrase => normalized.includes(phrase));
}

function sanitizeFallbackText(text?: string | null): string | undefined {
  if (!text) return text ?? undefined;

  const sensitiveTerms = [
    'suicide',
    'kill',
    'murder',
    'weapon',
    'gun',
    'knife',
    'violence',
    'blood',
    'drugs',
    'nude',
    'sexual',
    'sex',
    'porn',
    'explicit',
    'hate',
    'terror',
    'bomb',
    'weaponry',
    'shoot'
  ];

  let sanitized = text;
  for (const term of sensitiveTerms) {
    const regex = new RegExp(term, 'gi');
    sanitized = sanitized.replace(regex, '[redacted]');
  }

  return sanitized;
}

function getContentHierarchy(aiContext: string | undefined, postNotesStyle: string, imageFocus: string) {
  if (aiContext) {
    return `
**Content Priority Order:**
1. **Post Notes Content** (Primary) - ${getPostNotesApproach(postNotesStyle)}
2. **Brand Voice & Guidelines** (Secondary) - Apply brand personality to content
3. **Image Elements** (${getImageRole(imageFocus)}) - ${getImageDescription(imageFocus)}`;
  }

  return `
**Content Priority Order:**
1. **Brand Context** (Primary) - Use company values, tone, and target audience
2. **Image Analysis** (${getImageRole(imageFocus)}) - ${getImageDescription(imageFocus)}
3. **Brand Guidelines** (Always) - Apply dos/don'ts and style rules consistently`;
}

// Fetch brand context for a client
async function getBrandContext(supabase: SupabaseClient, clientId: string) {
  try {
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
    let clientId: string | undefined;
    try {
      const preliminaryBody = await request.clone().json();
      clientId =
        typeof preliminaryBody?.clientId === 'string'
          ? preliminaryBody.clientId
          : typeof preliminaryBody?.client_id === 'string'
            ? preliminaryBody.client_id
            : undefined;
    } catch {
      clientId = undefined;
    }

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    let supabase = auth.supabase;

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
    const validatedClientId =
      typeof body.clientId === 'string'
        ? body.clientId
        : typeof body.client_id === 'string'
          ? (body.client_id as string)
          : clientId;

    if (!validatedClientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    clientId = validatedClientId;

    if (validatedClientId !== auth.client.id) {
      const ownership = await requireClientOwnership(request, validatedClientId);
      if (ownership.error) return ownership.error;
      supabase = ownership.supabase;
    }

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
        result = await generateCaptions(
          openai,
          supabase,
          body.imageData as string,
          body.existingCaptions as string[] | undefined,
          (body.aiContext ?? (body as Record<string, unknown>).postNotes) as string | undefined,
          (body.clientId as string | undefined) ?? clientId,
          body.copyType as 'social-media' | 'email-marketing' | undefined,
          body.copyTone as 'promotional' | 'educational' | 'personal' | 'testimonial' | 'engagement' | undefined,
          body.postNotesStyle as 'quote-directly' | 'paraphrase' | 'use-as-inspiration' | undefined,
          body.imageFocus as 'main-focus' | 'supporting' | 'background' | 'none' | undefined
        );
        break;

      case 'remix_caption':
        result = await remixCaption(
          openai,
          supabase,
          body.imageData as string,
          body.prompt as string,
          body.existingCaptions as string[] | undefined,
          body.aiContext as string | undefined,
          (body.clientId as string | undefined) ?? clientId
        );
        break;

      case 'generate_content_ideas':
        result = await generateContentIdeas(openai, supabase, clientId, userId);
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

async function callOpenAIWithRetry(openai: OpenAI, params: any, maxRetries = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create(params);
      return response;
    } catch (error: any) {
      lastError = error;

      if (error?.status === 400 || error?.status === 401) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`OpenAI attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function generateCaptions(
  openai: OpenAI,
  supabase: SupabaseClient,
  imageData: string,
  existingCaptions: string[] = [],
  aiContext?: string,
  clientId?: string,
  copyType?: 'social-media' | 'email-marketing',
  copyTone?: 'promotional' | 'educational' | 'personal' | 'testimonial' | 'engagement',
  postNotesStyle?: 'quote-directly' | 'paraphrase' | 'use-as-inspiration',
  imageFocus?: 'main-focus' | 'supporting' | 'background' | 'none'
) {
  try {
    const isVideoPlaceholder = imageData === 'VIDEO_PLACEHOLDER' || imageData === '';
    const isVideo = isVideoPlaceholder;

    let validation: { isValid: boolean; type: 'base64' | 'blob' | 'invalid' } = { isValid: true, type: 'base64' };
    if (!isVideoPlaceholder) {
      const mediaValidation = isValidMediaData(imageData);
      if (!mediaValidation.isValid) {
        throw new Error('Invalid media data - must be blob URL or base64');
      }

      validation = isValidImageData(imageData);
    }

    if (isVideo && !aiContext?.trim()) {
      throw new Error('Post Notes are required for video content. AI cannot analyze videos visually.');
    }

    let brandContext: Awaited<ReturnType<typeof getBrandContext>> | null = null;
    if (clientId) {
      brandContext = await getBrandContext(supabase, clientId);
    }

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

    const finalInstruction = copyType === 'email-marketing' ? '' : 'Provide only 3 captions, separated by blank lines. No introduction or explanation.';

    const systemPrompt = copyType === 'email-marketing'
      ? `# Professional Email Copy Generator

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
✗ No "\n" literal text - use actual line breaks
✗ No casual social media language ("DM", "link in bio", emojis)

Generate the email copy now.`
      : `You are a social media copywriter. Your task is to write 3 unique, engaging captions based on the provided image and context.

## Role
- Apply strategic, brand-aware thinking to every caption
- Use the specified post notes, brand context, and image cues with precision

## Task
- Deliver captions that reflect the provided copy tone, post notes approach, and image focus
- Ensure each caption highlights a different angle while staying on brief

## Format Requirements
- ${finalInstruction}
- Keep caption 1 short (1-2 lines), caption 2 medium (3-4 lines), caption 3 longer (5-6 lines)
- Provide only caption text with any hashtags integrated naturally
- Avoid introductions, summaries, or numbering

## Style Guidelines
- Match the brand voice and tone guidelines at all times
- Follow the post notes handling instructions with full fidelity
- Integrate image elements according to the specified focus level
- Maintain a platform-ready, conversational tone that drives engagement

## Strategy Inputs
Copy Tone: ${copyTone || 'General'}
Post Notes Style: ${postNotesStyle || 'Paraphrase'}
Image Focus: ${imageFocus || 'Supporting'}

### Copy Tone Guidance
${getCopyToneInstructions(copyTone || 'promotional')}

### Content Hierarchy
${getContentHierarchy(aiContext, postNotesStyle || 'paraphrase', imageFocus || 'supporting')}

${aiContext ? `### Post Notes
${aiContext}

Processing Instructions: ${getPostNotesInstructions(postNotesStyle || 'paraphrase')}` : ''}

${brandContextSection}

### Image Direction
${getImageInstructions(imageFocus || 'supporting')}

## Quality Checklist
- Captions align with tone, hierarchy, and post notes rules
- Image references match the declared focus
- Brand context rules, dos, and don'ts are respected
- No placeholder language, apologies, or meta commentary`;

    const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail: 'high' } }> = [
      {
        type: 'text',
        text:
          copyType === 'email-marketing'
            ? aiContext
              ? `Generate ONE single email paragraph (2-3 concise sentences + CTA) based on your Post Notes: "${aiContext}". Write as a professional email with actual line breaks between the main text and CTA. CRITICAL: Match the brand voice examples exactly - use the same tone, style, and personality. NO hashtags or social media formatting.`
              : 'Generate ONE single email paragraph (2-3 concise sentences + CTA) for this image. Write as a professional email with actual line breaks between the main text and CTA. CRITICAL: Match the brand voice examples exactly - use the same tone, style, and personality. NO hashtags or social media formatting.'
            : aiContext
              ? `CRITICAL: Your Post Notes are "${aiContext}". Generate exactly 3 social media captions that DIRECTLY mention and use these Post Notes. Every caption must include the actual content from your notes. Do not create generic captions - make the Post Notes the main focus of each caption. Start with the first caption immediately, no introduction needed.`
              : 'Generate exactly 3 social media captions for this image based on what you see. Start with the first caption immediately, no introduction needed.'
      }
    ];

    if (validation.isValid && imageData && !isVideo && !isVideoPlaceholder) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageData,
          detail: 'high'
        }
      });
    }

    // Warn if promotional captions lack supporting context
    if (copyTone === 'promotional' && !aiContext?.trim()) {
      console.warn('Generating promotional content without Post Notes - results may be generic');
    }

    const response = await callOpenAIWithRetry(openai, {
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
      temperature: 0.8
    });

    let content = response.choices[0]?.message?.content || '';
    const finishReason = response.choices[0]?.finish_reason;

    if (
      (typeof finishReason === 'string' && finishReason.toLowerCase() === 'content_filter') ||
      isRefusalResponse(content) ||
      content.trim().length === 0
    ) {
      logger.warn('Caption generation initial attempt refused or filtered. Retrying with safety fallback.', {
        finishReason,
        clientId,
        hasContext: !!aiContext,
        isVideo,
        contentLength: content.length
      });

      const sanitizedContext = sanitizeFallbackText(aiContext);
      const fallbackSystemPrompt = `You are a policy-compliant social media copywriter. Produce safe, positive captions that follow all usage guidelines. If the provided context includes sensitive or disallowed content, omit or neutralize it while still delivering helpful, brand-friendly captions. Provide the safest possible alternative instead of refusing.`;

      const fallbackUserMessage =
        copyType === 'email-marketing'
          ? sanitizedContext
            ? `Write one compliant, brand-safe promotional email paragraph plus a call-to-action based on this context. Remove or neutralize any sensitive details: "${sanitizedContext}".`
            : 'Write one compliant, brand-safe promotional email paragraph with a call-to-action. Keep the tone professional and positive.'
          : sanitizedContext
            ? `Create three short, brand-safe social media captions. Use this context where it is safe to do so, but remove or neutralize any sensitive details: "${sanitizedContext}".`
            : 'Create three short, brand-safe social media captions suitable for a generic promotional post. Keep them positive and compliant.';

      const fallbackResponse = await callOpenAIWithRetry(openai, {
        model: process.env.OPENAI_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: fallbackSystemPrompt
          },
          {
            role: 'user',
            content: fallbackUserMessage
          }
        ],
        max_tokens: copyType === 'email-marketing' ? 500 : 600,
        temperature: 0.7
      });

      const fallbackContent = fallbackResponse.choices[0]?.message?.content || '';

      if (fallbackContent.trim().length > 0 && !isRefusalResponse(fallbackContent)) {
        content = fallbackContent;
      } else {
        logger.error('Caption generation failed after fallback attempt.', {
          clientId,
          hasContext: !!aiContext,
          fallbackContentLength: fallbackContent.length
        });

        return NextResponse.json(
          {
            success: false,
            error: 'AI safety filters prevented caption generation. Please adjust your media or notes and try again.'
          },
          { status: 400 }
        );
      }
    }

    let captions: string[] = [];

    if (copyType === 'email-marketing') {
      let processedContent = content.trim();
      processedContent = processedContent.replace(/\\n\\n/g, '\n\n');
      processedContent = processedContent.replace(/\\n/g, '\n');
      processedContent = processedContent.replace(/\.\s*([A-Z][^.!?]*[.!?]?)$/gm, '.\n\n$1');
      processedContent = processedContent.replace(/\n{3,}/g, '\n\n');

      if (processedContent.length > 20) {
        captions = [processedContent];
      }
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
        .filter(caption =>
          caption.length > 15 &&
          !caption.toLowerCase().startsWith('here are') &&
          !caption.toLowerCase().startsWith('captions for') &&
          !caption.toLowerCase().startsWith('engaging captions') &&
          !caption.toLowerCase().startsWith('three captions')
        )
        .slice(0, 3);

      if (captions.length < 3) {
        const allLines = content
          .split(/\n/)
          .map(line => line.trim())
          .filter(line => line.length > 10);

        if (allLines.length >= 3) {
          captions = allLines.slice(0, 3);
        }
      }
    }

    return NextResponse.json({
      success: true,
      captions
    });
  } catch (error: any) {
    console.error('Caption generation error:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      clientId
    });

    return {
      success: false,
      error: error?.message || 'Failed to generate captions'
    };
  }
}

async function remixCaption(
  openai: OpenAI,
  supabase: SupabaseClient,
  imageData: string,
  prompt: string,
  existingCaptions: string[] = [],
  aiContext?: string,
  clientId?: string
) {
  try {
    const validation = isValidImageData(imageData);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }

    let brandContext: Awaited<ReturnType<typeof getBrandContext>> | null = null;
    if (clientId) {
      brandContext = await getBrandContext(supabase, clientId);
    }

    let systemPrompt = 'You are a creative social media copywriter specializing in brand-aware content creation. The user wants you to create a fresh variation of an existing caption.\n\n';
    systemPrompt += '🎯 YOUR TASK:\n';
    systemPrompt += 'Create a NEW version of the original caption that:\n';
    systemPrompt += '- Maintains the EXACT same meaning and message\n';
    systemPrompt += '- Uses DIFFERENT words and phrasing\n';
    systemPrompt += '- Keeps the SAME style, tone, and structure\n';
    systemPrompt += "- Incorporates the user's post notes naturally\n\n";
    systemPrompt += '🚨 CRITICAL REQUIREMENTS:\n';
    systemPrompt += '- DO NOT change the core message or meaning\n';
    systemPrompt += '- DO create a fresh variation with different wording\n';
    systemPrompt += '- DO maintain the same emotional tone and style\n';
    systemPrompt += "- DO include the post notes content naturally\n";
    systemPrompt += '- DO NOT add any explanations, introductions, or commentary\n';
    systemPrompt += '- DO NOT mention the image or try to analyze it\n\n';
    systemPrompt += '🎭 TONE MATCHING (HIGHEST PRIORITY):\n';
    systemPrompt += "- Study the original caption's tone, style, and personality\n";
    systemPrompt += '- Match the exact emotional feel and writing style\n';
    systemPrompt += '- If the original is casual and friendly, keep it casual and friendly\n';
    systemPrompt += '- If the original is professional and formal, keep it professional and formal\n';
    systemPrompt += '- Copy the same level of enthusiasm, humor, or seriousness\n\n';

    if (aiContext) {
      systemPrompt += '📝 POST NOTES (MANDATORY - include this content):\n';
      systemPrompt += `${aiContext}\n\n`;
      systemPrompt += 'IMPORTANT: Weave the post notes content naturally into your variation. If the notes mention specific details (like "$50", "available online"), these must appear in your caption.\n\n';
    }

    if (brandContext) {
      systemPrompt += '🎨 BRAND CONTEXT (use for tone and style):\n';
      systemPrompt += `- Company: ${brandContext.company || 'Not specified'}\n`;
      systemPrompt += `- Brand Tone: ${brandContext.tone || 'Not specified'}\n`;
      systemPrompt += `- Target Audience: ${brandContext.audience || 'Not specified'}\n`;
      systemPrompt += `- Value Proposition: ${brandContext.value_proposition || 'Not specified'}\n\n`;

      if (brandContext.voice_examples) {
        systemPrompt += '🎤 BRAND VOICE EXAMPLES (MATCH THIS STYLE):\n';
        systemPrompt += `${brandContext.voice_examples}\n\n`;
        systemPrompt += '🚨 CRITICAL: Study these examples and ensure your variation matches this exact style and voice.\n\n';
      }

      systemPrompt += "Use this brand context to ensure your variation matches the company's voice and style.\n\n";
    }

    if (brandContext?.dos || brandContext?.donts) {
      systemPrompt += '📋 STYLE RULES:\n';
      if (brandContext.dos) {
        systemPrompt += `✅ DO: ${brandContext.dos}\n`;
      }
      if (brandContext.donts) {
        systemPrompt += `❌ DON'T: ${brandContext.donts}\n`;
      }
      systemPrompt += '\n';
    }

    if (existingCaptions.length > 0) {
      systemPrompt += `📚 EXISTING CAPTIONS FOR REFERENCE: ${existingCaptions.join(', ')}\n\n`;
    }

    systemPrompt += '🎯 FINAL INSTRUCTION:\n';
    systemPrompt += 'Generate exactly 1 caption variation that rephrases the original while keeping the same meaning, style, and tone.\n';
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
          content: `Create a fresh variation of this caption: "${prompt.split('Original caption: "')[1]?.replace('"', '') || 'Unknown caption'}"`
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });

    return NextResponse.json({
      success: true,
      caption: response.choices[0]?.message?.content || 'No caption generated'
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'remix_caption',
      clientId,
      additionalData: {
        hasImageData: !!imageData,
        hasContext: !!aiContext,
        hasExistingCaptions: existingCaptions.length > 0
      }
    });
  }
}

// ... [generateCaptions and remixCaption REMAIN THE SAME, omitted for brevity in this reply]

async function generateContentIdeas(openai: OpenAI, supabase: SupabaseClient, clientId: string, userId: string) {
  try {
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const brandContext = await getBrandContext(supabase, clientId);
    if (!brandContext) {
      return NextResponse.json(
        { error: 'Could not fetch client brand context' },
        { status: 404 }
      );
    }

    const clientRegion = brandContext.region || 'New Zealand - Wellington';
    const allUpcomingHolidays = getUpcomingHolidays(8);
    const upcomingHolidays = allUpcomingHolidays.filter(holiday => {
      if (holiday.type === 'international') return true;
      if (holiday.category === 'National') {
        if (clientRegion.includes('New Zealand') && (holiday.name.includes('Waitangi') || holiday.name.includes('ANZAC'))) {
          return true;
        }
        return true;
      }
      if (holiday.category === 'Regional') {
        const holidayRegion = holiday.name.replace(' Anniversary Day', '').replace(' Day', '');
        if (clientRegion.includes(holidayRegion)) {
          return true;
        }
        return false;
      }
      return true;
    });

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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDate = now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const month = now.getMonth() + 1;
    const isSouthernHemisphere = clientRegion.includes('New Zealand') || clientRegion.includes('Australia');
    let season = '';
    if (isSouthernHemisphere) {
      if (month === 12 || month === 1 || month === 2) season = 'Summer';
      else if (month >= 3 && month <= 5) season = 'Autumn';
      else if (month >= 6 && month <= 8) season = 'Winter';
      else season = 'Spring';
    } else {
      if (month === 12 || month === 1 || month === 2) season = 'Winter';
      else if (month >= 3 && month <= 5) season = 'Spring';
      else if (month >= 6 && month <= 8) season = 'Summer';
      else season = 'Autumn';
    }

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

    // ---- Begin: New Prompt w/ Enforcements ----
    const generateContentIdeasPrompt = (clientData: ClientData, holidays: HolidayData[], currentContext: CurrentContext, clientRegion: string) => {
      return `
You are a senior marketing strategist with 15+ years of agency experience, generating high-converting social media content that drives measurable business results. You think in terms of customer journeys, platform algorithms, and competitive differentiation—not generic social media templates.

## Core Mission

Generate 3 strategically diverse content ideas that solve real business challenges for ${clientData.company_description || 'this client'}. Each idea must be platform-specific, actionable, and differentiated from typical industry content.

**Current Context:** ${currentContext.date} | ${currentContext.season} | ${clientRegion || 'Not specified'}

---

## CRITICAL: ZERO TOLERANCE FOR GENERIC PLACEHOLDERS

- ABSOLUTELY BAN any content containing [, ] or variables like [industry topic], [target audience], [location], [problem], [solution], [audience], [key process], [client name].
- Every sentence MUST use *actual client data*: 
    - Company: "${clientData.company_description || '[MISSING COMPANY DESC]'}"
    - Industry: "${clientData.industry || '[MISSING INDUSTRY]'}"
    - Target Audience: "${clientData.target_audience || '[MISSING AUDIENCE]'}"
    - Brand Tone: "${clientData.brand_tone || '[MISSING TONE]'}"
- Replace ALL placeholders with relevant, real client/company/audience/context info.
- **If ANY placeholder is present in your output, REJECT and regenerate before submitting!**

**EXAMPLES:**
- ❌ BAD: “Here’s what most people don’t know about [industry topic]...”
- ❌ BAD: “Tips for [target audience] to succeed in [industry area].”
- ✅ GOOD: “The 6am workout myths Wellington professionals still believe.”
- ✅ GOOD: “Why Wellington’s busy moms love FitLife’s 30-minute sessions.”

Before submitting, perform a full placeholder ban/self-check.

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

**MANDATORY:** Before you write a single idea, you MUST answer these questions USING THE ACTUAL CLIENT DATA (repeat values verbatim from below):
- Industry (write the client industry): "${clientData.industry || '[NEEDS INDUSTRY]'}"
- Business Model (guess from description): 
- Risk Level (see if there’s financial/health/regulatory risk): 
- Company: "${clientData.company_description || '[MISSING COMPANY DESC]'}"
- Target Audience: "${clientData.target_audience || '[MISSING AUDIENCE]'}"
- Brand Tone: "${clientData.brand_tone || '[MISSING TONE]'}"

**Specific Question Responses (show how you use actual client data):**
1. What keeps their audience awake at 3am? (Call out a pain point SPECIFIC to THEIR audience/company)
2. What are ${clientData.target_audience || 'their audience'} scrolling for? (Relate to their reality)
3. What would make them save/share this post? (Insert a trigger tied to business or customer truth)
4. What objections do they have about ${clientData.company_description || 'this brand/industry'}? (Be as specific as possible)
5. What unique INSIDER knowledge does "${clientData.company_description || '[MISSING COMPANY DESC]'}" have? (No generalities)

**EXAMPLES**
- ❌ BAD: "Their audience worries about [pain point]…" or "Their target audience wants [generic goal]."
- ✅ GOOD: "Wellington professionals struggle to fit workouts into busy mornings—so they look for routines that work before 7am."
- ✅ GOOD: "FitLife’s main competitor, GymX, offers only evening classes—this is a unique selling angle."

If you cannot answer using client data, state "MISSING DATA: [field]" and proceed with best possible specificity.

---

### Step 2: Content Funnel Strategy

**MANDATORY DISTRIBUTION (unless client specifies otherwise):**
- **2 ideas: TOFU (Top of Funnel)** - Awareness, education, entertainment for cold audiences
- **1 idea: MOFU/BOFU (Middle/Bottom)** - Consideration, conversion for warm/hot audiences

**TOFU Content Characteristics:**
- Solves audience problems without selling
- Educational, entertaining, or inspirational
- Broad appeal, easily shareable
- No hard CTAs, builds trust first

**MOFU Content Characteristics:**
- Demonstrates expertise and results
- Case studies, client testimonials, process reveals
- Builds credibility and trust
- Soft CTAs (Learn more, Follow for tips)

**BOFU Content Characteristics:**
- Direct conversion focus
- Limited offers, exclusive access, strong urgency
- Clear, action-oriented CTAs

---

### Step 3: Competitive Differentiation Mandate

**BEFORE finalizing ANY idea, ask:**
- ❌ REJECT if: 5+ competitors in same city could post the exact same thing
- ✅ APPROVE if: Idea leverages unique insider knowledge, customer base, or operating model
- ✅ IDEAL: Only THIS brand, with provided audience/context, could post the idea

---

### Step 4: Platform & Format Intelligence

**Platform Selection Criteria (choose by audience/company, not at random):**
- LinkedIn: Best for B2B, professional, consulting, SaaS, expert content
- Instagram: Visuals, consumers, lifestyle, products, wellness—pick only if it makes sense
- TikTok: Fast tips, younger consumer focus, fun/edgy
- Facebook: Community, local, older conversations
- Twitter/X: Tech, finance, breaking news

---

### Step 5: Psychological Trigger Integration

Weave in Social Proof, Scarcity, Authority, Reciprocity, FOMO, Curiosity Gap, or Transformation—but with ACTUAL company facts/examples, not generic templates.

---

## Bad Example vs Good Example (NEVER DO THE BAD VERSION)

**Context**: Client = FitLife Studio in Wellington, Target Audience = Busy local professionals, Brand Tone = Energetic, Friendly

**BAD (TEMPLATE) IDEA — NEVER ALLOWED:**
- Title: The Power of [industry topic]
- Hook: “Here’s what most people don’t know about [target audience] and [industry topic].”
- Hashtag Strategy: #[city] #[topic] #[something]

**GOOD (SPECIFIC) IDEA — REQUIRED:**
- Title: Beat the Morning Rush
- Hook: “Wellington pros are winning their day with a 6am sweat session at FitLife Studio.”
- Hashtags: #FitLifeWellington #BusyProfessionals #EarlyWorkoutWins

If any bracketed template language remains, REJECT and rewrite.

---

## PRE-OUTPUT VALIDATION CHECKLIST

**EVERY IDEA must pass ALL of these before submission:**

- [ ] **Specificity Audit:** ZERO bracketed placeholders OR generic templates; all hooks and hashtags refer to real client context/industry/audience
- [ ] **Client Data Usage:** Hooks, angles, and platform choices CLEARLY reflect the company, its audience, and its differentiators.
- [ ] **Strategic Audit:** 2 TOFU + 1 MOFU/BOFU; platform reasoning fits THEIR audience/location/industry; funnel logic justified
- [ ] **Quality Audit:** An experienced CMO would approve it (non-obvious angle, not a re-skinned template, offers measurable business value)
- [ ] **Competitive Check:** Could 5+ local competitors post it? If yes, REJECT.
- [ ] **Production Reality:** Business could actually create/post it with available resources
- [ ] **Zero Placeholder Check:** Any [bracketed term] or variable detected = automatic failure/rewrite

**If ANY check is not satisfied, STOP and regenerate better output. If MISSING DATA, explain what & use SMART fallback.**

---

## OUTPUT FORMAT (USE THIS EXACTLY)

- Before presenting the 3 ideas, show your filled answers for "Client Intelligence Analysis" and "Critical Questions" using real client data.
- For every idea:
    - Make title, angles, hooks, and hashtags all specific to the client/company/location/industry
    - DO NOT use any bracketed terms (like [audience], [industry topic], etc) anywhere
    - Hooks must be ready-to-post, real lines (no brackets)
    - Platform reasoning must cite facts about their actual audience/location/industry
    - Hashtags: use 3-5 relevant tags referencing the actual brand/industry/location (never placeholders)
    - If idea draws on a holiday, cite it with full date and linkage

---
**IDEA 1:** (Title, see above)

**Funnel Stage:** TOFU / MOFU / BOFU  
**Primary Platform:** {Platform, PLUS 1-sentence reasoning using client/audience}  
**Content Format:**  
**Business Goal:**  
**Target Audience Insight:**  
**Content Angle:**  
**Visual Concept:**  
**Hook/Opening:**  
**Content Structure:**
- Opening: 
- Body: 
- Close: 
**CTA Strategy:**  
**Hashtag Strategy:**  
**Success Metric:**  
**Pro Tip:**  

---

**IDEA 2:** (repeat structure)

---

**IDEA 3:** (repeat structure)

---

**CONTENT SERIES OPPORTUNITY:** [If 2+ ideas could build on each other as a series, note "YES: ..." and why; else, "N/A"]

---

## FINAL STRATEGIC REMINDERS

🎯 Recheck for genericity/placeholder—reject/rewrite if present  
🎯 Platform/audience choices must flow from THEIR company context  
🎯 2 TOFU, 1 MOFU/BOFU idea, properly explained  
🎯 NO BRACKETED or variable text  
🎯 Every idea must be production-ready and differentiated

Remember: You're not filling a template. You're solving business challenges using the actual client data provided above. Each idea should make it obvious why an agency would charge real money for your thinking.

-- END PROMPT --
      `.trim();
    };
    // ---- End: New Prompt w/ Enforcements ----

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

    const futureHolidays = upcomingHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      return holidayDate >= today;
    });

    const formattedHolidays: HolidayData[] = futureHolidays.map(holiday => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: holiday.name,
        date: holidayDate.toLocaleDateString(locale),
        daysUntil: Math.max(0, daysUntil),
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

    let ideas: Array<{ idea: string; angle: string; visualSuggestion: string; timing: string; holidayConnection: string }> = [];
    try {
      if (!content || content.trim() === '') throw new Error('Empty response');

      // Parse the structured text response from OpenAI
      // The response format includes sections like "IDEA 1:", "IDEA 2:", etc.
      let parsedIdeas: Array<{ idea: string; angle: string; visualSuggestion: string; timing: string; holidayConnection: string }> = [];
      
      // Try to extract ideas using regex patterns - match "**IDEA 1:**" or "IDEA 1:" patterns
      const ideaRegex = /(?:^|\n)(?:\*\*)?IDEA\s+(\d+)(?:\*\*)?:?\s*\n?(.*?)(?=(?:^|\n)(?:\*\*)?IDEA\s+\d+|CONTENT SERIES|$)/gis;
      const matches = Array.from(content.matchAll(ideaRegex));
      
      for (const match of matches.slice(0, 3)) { // Extract up to 3 ideas
        const ideaText = match[2] || '';
        
        // Extract title - first non-empty line after "IDEA X:"
        const lines = ideaText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const titleLine = lines.find(line => 
          !line.match(/^(Funnel Stage|Primary Platform|Content Format|Business Goal|Target Audience|Content Angle|Visual|Hook|Content Structure|CTA|Hashtag|Success|Pro Tip)/i) &&
          line.length > 5
        ) || lines[0] || 'Content Idea';
        const idea = titleLine.replace(/^\*\*|\*\*$/g, '').replace(/^[\d\.\-\*]+[\s\.]+/g, '').trim().replace(/^["']+|["']+$/g, '');
        
        // Extract Content Angle
        const angleMatch = ideaText.match(/Content Angle[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Visual|Hook|Content Structure|CTA|$))/is);
        const angle = angleMatch ? angleMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0] : 
                      (lines.find(l => l.toLowerCase().includes('angle'))?.replace(/^.*?angle[:\s]+/i, '').trim() || 'Strategic content angle');
        
        // Extract Visual Concept
        const visualMatch = ideaText.match(/Visual Concept[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Hook|Content Structure|CTA|$))/is);
        const visualSuggestion = visualMatch ? visualMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0] : 
                                 (lines.find(l => l.toLowerCase().includes('visual'))?.replace(/^.*?visual[:\s]+/i, '').trim() || 'Engaging visual content');
        
        // Extract Hook/Opening as timing
        const hookMatch = ideaText.match(/Hook[\/\s]*Opening[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Content Structure|CTA|$))/is);
        let timing = hookMatch ? hookMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0].replace(/^["']|["']$/g, '') : 
                     (lines.find(l => l.toLowerCase().includes('hook'))?.replace(/^.*?hook[:\s]+/i, '').trim() || 'Timely and relevant');
        // Clean up timing
        timing = timing.replace(/^["']|["']$/g, '').trim();
        if (!timing || timing.length < 10) {
          timing = idea.substring(0, 100) || 'Timely and relevant';
        }
        
        // Extract holiday connection - look for holiday mentions in the idea text
        let holidayConnection = 'Evergreen content';
        const holidayKeywords = /(holiday|Holiday|event|Event|seasonal|Seasonal|Christmas|Easter|Thanksgiving|New Year|Valentine|Halloween|Independence|Waitangi|ANZAC)/i;
        if (holidayKeywords.test(ideaText)) {
          const holidayMatch = ideaText.match(/(?:holiday|Holiday|event|Event|seasonal|Seasonal).*?(?:\n|$)/i);
          if (holidayMatch) {
            holidayConnection = holidayMatch[0].trim().substring(0, 150);
          } else {
            holidayConnection = 'Holiday-themed content';
          }
        }
        
        parsedIdeas.push({
          idea: idea || 'Content Idea',
          angle: angle || 'Strategic content angle',
          visualSuggestion: visualSuggestion || 'Engaging visual content',
          timing: timing || 'Timely and relevant',
          holidayConnection: holidayConnection || 'Evergreen content'
        });
      }
      
      // If we didn't parse any ideas from the structured format, try a simpler approach
      if (parsedIdeas.length === 0) {
        // Try to find numbered sections or bullet points
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        let currentIdea: Partial<{ idea: string; angle: string; visualSuggestion: string; timing: string; holidayConnection: string }> = {};
        
        for (let i = 0; i < lines.length && parsedIdeas.length < 3; i++) {
          const line = lines[i].trim();
          
          // Look for idea headers
          if (/IDEA\s+\d+|^[\*\-\d]+\./.test(line)) {
            if (currentIdea.idea) {
              parsedIdeas.push({
                idea: currentIdea.idea || 'Content Idea',
                angle: currentIdea.angle || 'Strategic content angle',
                visualSuggestion: currentIdea.visualSuggestion || 'Engaging visual content',
                timing: currentIdea.timing || currentIdea.idea || 'Timely and relevant',
                holidayConnection: currentIdea.holidayConnection || 'Evergreen content'
              });
            }
            currentIdea = { idea: line.replace(/^[\*\-\d\.\s]+|IDEA\s+\d+:?\s*/gi, '').trim().replace(/^["']+|["']+$/g, '') };
          } else if (currentIdea.idea && line.length > 20) {
            // If we have an idea started, accumulate details
            if (!currentIdea.angle) {
              currentIdea.angle = line;
            } else if (!currentIdea.visualSuggestion) {
              currentIdea.visualSuggestion = line;
            } else if (!currentIdea.timing) {
              currentIdea.timing = line;
            }
          }
        }
        
        // Add the last idea if we have one
        if (currentIdea.idea && parsedIdeas.length < 3) {
          parsedIdeas.push({
            idea: currentIdea.idea || 'Content Idea',
            angle: currentIdea.angle || 'Strategic content angle',
            visualSuggestion: currentIdea.visualSuggestion || 'Engaging visual content',
            timing: currentIdea.timing || currentIdea.idea || 'Timely and relevant',
            holidayConnection: currentIdea.holidayConnection || 'Evergreen content'
          });
        }
      }
      
      // If still no ideas parsed, create structured ideas from the raw content
      if (parsedIdeas.length === 0) {
        // Split content into chunks and create ideas
        const chunks = content.split(/\n\n+/).filter(chunk => chunk.trim().length > 50);
        for (let i = 0; i < Math.min(3, chunks.length); i++) {
          const chunk = chunks[i];
          const firstLine = chunk.split('\n')[0]?.trim() || 'Content Idea';
          parsedIdeas.push({
            idea: firstLine.replace(/^[\*\-\d\.\s]+/g, '').replace(/^["']+|["']+$/g, '').substring(0, 100),
            angle: chunk.substring(0, 200),
            visualSuggestion: 'Engaging visual content',
            timing: firstLine.substring(0, 100),
            holidayConnection: 'Evergreen content'
          });
        }
      }
      
      ideas = parsedIdeas.length > 0 ? parsedIdeas : [];
      
      // Ensure we have at least one idea, even if parsing failed
      if (ideas.length === 0) {
        throw new Error('Failed to parse ideas from response');
      }
      
      return NextResponse.json({
        success: true,
        ideas: ideas
      });
    } catch (parseError) {
      logger.error('Failed to parse content ideas response:', parseError);

      // Fallback: create basic ideas structure
      ideas = [
        {
          idea: "Expert Authority",
          angle: "Share industry insights that position your brand as the go-to expert",
          visualSuggestion: "Clean infographic with key insights and data",
          timing: "Wellington professionals start their day at FitLife Studio.",
          holidayConnection: "Evergreen content that builds authority year-round"
        },
        {
          idea: "Client Success Story",
          angle: "Showcase a real client transformation to build trust and credibility",
          visualSuggestion: "Before/after photos with testimonial quote overlay",
          timing: "Sarah's journey from 'No Time' to 'Every Morning' in 90 days with FitLife.",
          holidayConnection: "Social proof content that converts regardless of season"
        },
        {
          idea: "Behind the Scenes",
          angle: "Reveal your process and team to build personal connection with audience",
          visualSuggestion: "Candid team photos or process documentation",
          timing: "How the FitLife crew preps for your 6am workout, every single day.",
          holidayConnection: "Authentic content that humanizes your brand"
        }
      ];
      return NextResponse.json({
        success: true,
        ideas: ideas
      });
    }
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'generate_content_ideas',
      clientId: clientId,
      additionalData: { clientId }
    });
  }
}

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
