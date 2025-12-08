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
import { sanitizeAndValidateContentIdeas } from '@/lib/ai-utils';
import { detectPromptLeakage, logLeakageIncident } from '@/lib/ai-monitoring';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
- Build community through two-way communication`,
  };
  return toneMap[copyTone] || '**General Social Media Copy:** Create engaging, brand-appropriate content that drives social interaction.';
}

function getPostNotesApproach(style: string) {
  const approaches: Record<string, string> = {
    'quote-directly': 'Use exact wording and specific details from notes',
    paraphrase: "Rewrite notes content in brand voice while keeping all key information",
    'use-as-inspiration': 'Capture the essence and intent of notes with creative interpretation',
  };
  return approaches[style] || 'Incorporate notes content appropriately';
}

function getImageRole(focus: string) {
  const roles: Record<string, string> = {
    'main-focus': 'Primary Content Driver',
    supporting: 'Content Enhancer',
    background: 'Context Provider',
    none: 'Not Used',
  };
  return roles[focus] || 'Supporting';
}

function getImageDescription(focus: string) {
  const descriptions: Record<string, string> = {
    'main-focus': "Build captions around what's shown in the image",
    supporting: 'Use image details to enhance and support the main message',
    background: 'Reference image elements briefly for context',
    none: 'Focus entirely on text content, ignore image',
  };
  return descriptions[focus] || 'Use image details to support content';
}

function getPostNotesInstructions(style: string) {
  const instructions: Record<string, string> = {
    'quote-directly':
      'Include specific phrases, numbers, and details exactly as written. If notes mention "$50 special offer", your caption must include "$50 special offer".',
    paraphrase: "Rewrite the notes content in the brand's voice while preserving all key information, prices, dates, and important details.",
    'use-as-inspiration': 'Capture the core message and intent from the notes, using them as a foundation for brand-appropriate content.',
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
- Treat this as text-based content creation`,
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
    'refuse to',
  ];

  return refusalPhrases.some((phrase) => normalized.includes(phrase));
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
    'shoot',
  ];
  let sanitized = text;
  for (const term of sensitiveTerms) {
    const regex = new RegExp(term, 'gi');
    sanitized = sanitized.replace(regex, '[redacted]');
  }
  return sanitized;
}

function getContentHierarchy(
  aiContext: string | undefined,
  postNotesStyle: string,
  imageFocus: string
) {
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
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(
        'company_description, website_url, brand_tone, target_audience, value_proposition, caption_dos, caption_donts, brand_voice_examples, region, timezone'
      )
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      logger.error('Could not fetch client brand info:', { error: clientError?.message });
      return null;
    }

    const { data: documents, error: docsError } = await supabase
      .from('brand_documents')
      .select('extracted_text, original_filename')
      .eq('client_id', clientId)
      .eq('processing_status', 'completed')
      .not('extracted_text', 'is', null);

    if (docsError) {
      logger.error('Could not fetch brand documents:', { error: docsError.message });
    }

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

    const brandContext = {
      company: client.company_description,
      tone: client.brand_tone,
      audience: client.target_audience,
      value_proposition: client.value_proposition,
      dos: client.caption_dos,
      donts: client.caption_donts,
      voice_examples: client.brand_voice_examples,
      region: client.region,
      timezone: client.timezone,
      documents: documents || [],
      website:
        scrapes && Array.isArray(scrapes) && scrapes.length > 0 ? scrapes[0] : null,
    };

    return brandContext;
  } catch (error) {
    logger.error('Error fetching brand context:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check content length first (before reading body)
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

    // Validate request body first (this reads the body once)
    const validation = await validateApiRequest(request, {
      body: aiRequestSchema,
      maxBodySize: 10 * 1024 * 1024,
    });

    if (!validation.success) {
      logger.error('AI request validation failed');
      return validation.response;
    }

    const body = validation.data.body!;
    
    // Extract clientId from validated body (handle discriminated union type)
    const bodyRecord = body as Record<string, unknown>;
    const validatedClientId =
      typeof bodyRecord.clientId === 'string'
        ? bodyRecord.clientId
        : typeof bodyRecord.client_id === 'string'
        ? (bodyRecord.client_id as string)
        : undefined;

    if (!validatedClientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const clientId = validatedClientId;

    // Now perform auth check with the validated clientId
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    let supabase = auth.supabase;

    const subscriptionCheck = await withAICreditCheck(request, 1);
    if (!subscriptionCheck.allowed) {
      logger.error('Subscription check failed:', subscriptionCheck.error);
      return NextResponse.json(
        {
          error: subscriptionCheck.error || 'AI credit limit reached',
          details: subscriptionCheck.error,
        },
        { status: 403 }
      );
    }
    if (!subscriptionCheck.userId) {
      logger.error('User ID not found in subscription check');
      return NextResponse.json(
        {
          error: 'User identification failed',
          details: 'Could not identify user for AI request',
        },
        { status: 401 }
      );
    }
    const userId = subscriptionCheck.userId;

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
    } catch {}

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let result: NextResponse | any;
    switch (body.action) {
      case 'analyze_image':
        result = await analyzeImage(
          openai,
          body.imageData as string,
          body.prompt as string | undefined
        );
        break;
      case 'generate_captions':
        result = await generateCaptions(
          openai,
          supabase,
          body.imageData as string,
          body.existingCaptions as string[] | undefined,
          (body.aiContext ?? (body as Record<string, unknown>).postNotes) as
            | string
            | undefined,
          (body.clientId as string | undefined) ?? clientId,
          body.copyType as 'social-media' | 'email-marketing' | undefined,
          body.copyTone as
            | 'promotional'
            | 'educational'
            | 'personal'
            | 'testimonial'
            | 'engagement'
            | undefined,
          body.postNotesStyle as
            | 'quote-directly'
            | 'paraphrase'
            | 'use-as-inspiration'
            | undefined,
          body.imageFocus as
            | 'main-focus'
            | 'supporting'
            | 'background'
            | 'none'
            | undefined
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

    if ((result && result.status === 200) || (result && result.success)) {
      const bodyData = body as Record<string, unknown>;
      await trackAICreditUsage(userId, 1, body.action as string, bodyData.clientId as string | undefined, {
        copyType: bodyData.copyType as string | undefined,
        copyTone: bodyData.copyTone as string | undefined,
        postNotesStyle: bodyData.postNotesStyle as string | undefined,
        imageFocus: bodyData.imageFocus as string | undefined,
      });
    }

    return result;
  } catch (error: any) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'ai_request',
      additionalData: { error: error instanceof Error ? error.message : 'Unknown error' },
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
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image for social media content creation:',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      analysis: response.choices[0]?.message?.content || 'No analysis generated',
    });
  } catch (error: any) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'analyze_image',
      additionalData: { hasPrompt: !!prompt },
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
        // eslint-disable-next-line no-console
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

    const systemPrompt =
      copyType === 'email-marketing'
        ? `You are a professional email copywriter. Write exactly ONE email paragraph (2-3 sentences + CTA) based on the provided context.

CRITICAL OUTPUT RULES:
- Output ONLY the email text - no instructions, no explanations, no meta-commentary
- Do NOT include phrases like "Here's the email:" or "Email copy:"
- Do NOT repeat any instructions or guidelines in your output
- Start directly with the email content

Brand Context: ${brandContext?.company || 'Not specified'} | Tone: ${brandContext?.tone || 'Professional'} | Audience: ${brandContext?.audience || 'Not specified'}

Write professional email copy now.`
        : `You are a social media copywriter. Write 3 unique captions based on the image and context provided.

CRITICAL OUTPUT RULES:
- Output ONLY the 3 captions separated by blank lines
- Do NOT include any instructions, guidelines, or meta-commentary
- Do NOT include phrases like "Here are 3 captions:" or "Caption 1:", "Caption 2:", etc.
- Do NOT repeat any of these instructions in your output
- Start directly with the first caption text
- No introductions, summaries, numbering, or explanations

Caption Guidelines:
- Caption 1: Short (1-2 lines)
- Caption 2: Medium (3-4 lines)  
- Caption 3: Longer (5-6 lines)
- Match brand voice and tone
- Integrate hashtags naturally
- Use post notes as specified

Copy Tone: ${copyTone || 'General'} | Post Notes Style: ${postNotesStyle || 'Paraphrase'} | Image Focus: ${imageFocus || 'Supporting'}

${getCopyToneInstructions(copyTone || 'promotional')}

${getContentHierarchy(aiContext, postNotesStyle || 'paraphrase', imageFocus || 'supporting')}

${aiContext ? `Post Notes: ${aiContext}\n\nProcessing: ${getPostNotesInstructions(postNotesStyle || 'paraphrase')}` : ''}

${brandContextSection}

${getImageInstructions(imageFocus || 'supporting')}

Write the 3 captions now. Output only the caption text, nothing else.`;

    const userContent: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string; detail: 'high' };
    }> = [
      {
        type: 'text',
        text:
          copyType === 'email-marketing'
            ? aiContext
              ? `Write ONE professional email paragraph (2-3 sentences + CTA) based on: "${aiContext}". Output ONLY the email text - no instructions, no explanations. Start directly with the email content.`
              : 'Write ONE professional email paragraph (2-3 sentences + CTA) for this image. Output ONLY the email text - no instructions, no explanations. Start directly with the email content.'
            : aiContext
            ? `Write 3 social media captions based on Post Notes: "${aiContext}". Output ONLY the 3 captions separated by blank lines. No introductions, no explanations, no numbering. Start directly with the first caption text.`
            : 'Write 3 social media captions for this image. Output ONLY the 3 captions separated by blank lines. No introductions, no explanations, no numbering. Start directly with the first caption text.',
      },
    ];

    if (validation.isValid && imageData && !isVideo && !isVideoPlaceholder) {
      // Check if imageData is a URL (HTTPS) or base64
      const isUrl = imageData.startsWith('https://') || imageData.startsWith('http://');
      
      if (isUrl) {
        // For URLs, OpenAI Vision API will fetch the image
        // Note: URL must be publicly accessible
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageData,
            detail: 'high',
          },
        });
      } else if (imageData.startsWith('data:')) {
        // For base64, use data URL format
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageData,
            detail: 'high',
          },
        });
      } else {
        // Unknown format - log warning but try anyway
        logger.warn('Unknown image data format, attempting to use as URL', {
          imageDataPrefix: imageData.substring(0, 50),
          type: validation.type,
        });
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageData,
            detail: 'high',
          },
        });
      }
    }

    if (copyTone === 'promotional' && !aiContext?.trim()) {
      // eslint-disable-next-line no-console
      console.warn('Generating promotional content without Post Notes - results may be generic');
    }

    const response = await callOpenAIWithRetry(openai, {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_tokens: 800,
      temperature: 0.8,
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
        contentLength: content.length,
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
        model:
          process.env.OPENAI_FALLBACK_MODEL ||
          process.env.OPENAI_MODEL ||
          'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: fallbackSystemPrompt,
          },
          {
            role: 'user',
            content: fallbackUserMessage,
          },
        ],
        max_tokens: copyType === 'email-marketing' ? 500 : 600,
        temperature: 0.7,
      });

      const fallbackContent = fallbackResponse.choices[0]?.message?.content || '';
      if (fallbackContent.trim().length > 0 && !isRefusalResponse(fallbackContent)) {
        content = fallbackContent;
      } else {
        logger.error('Caption generation failed after fallback attempt.', {
          clientId,
          hasContext: !!aiContext,
          fallbackContentLength: fallbackContent.length,
        });

        return NextResponse.json(
          {
            success: false,
            error: 'AI safety filters prevented caption generation. Please adjust your media or notes and try again.',
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
      // Remove common prompt leakage patterns
      let cleanedContent = content.trim();

      // Remove instruction-like headers and sections
      cleanedContent = cleanedContent.replace(/^##?\s*(Role|Task|Format Requirements?|Style Guidelines?|Strategy Inputs?|Copy Tone|Content Hierarchy|Post Notes|Image Direction|Quality Checklist|Output Format|Requirements?|Your Role|Brand Context|Content Inputs?|Critical Output Rules?|Caption Guidelines?)[:\s]*\n?/gmi, '');
      cleanedContent = cleanedContent.replace(/^###\s*(Copy Tone|Content Hierarchy|Post Notes|Image Direction|Processing Instructions?)[:\s]*\n?/gmi, '');
      cleanedContent = cleanedContent.replace(/^[🎯🚨📋🎨🎭👥💼🎤📝🌐📄✅❌]\s*[:\s]*\n?/gm, '');

      cleanedContent = cleanedContent.replace(/^(here are|here's|here is|below are|below is|following are|following is|i've created|i've generated|i've written|i'll provide|i'll create|i'll generate|captions for|engaging captions|three captions|3 captions|caption \d+:|caption option \d+:|option \d+:|variation \d+:)\s*/gi, '');

      cleanedContent = cleanedContent.replace(/^(provide|output|write|generate|create|deliver|ensure|match|follow|integrate|maintain|avoid|do not|don't|no|start|begin|end|critical|important|note|remember|guideline|requirement|rule|instruction)[:\s]*\n?/gmi, '');
      cleanedContent = cleanedContent.replace(/^(✓|✗|[-*•])\s*(professional|email|caption|hashtag|introduction|explanation|numbering|placeholder|apology|meta)[:\s]*\n?/gmi, '');

      cleanedContent = cleanedContent.replace(/^#{1,6}\s+.*$/gm, '');
      cleanedContent = cleanedContent.replace(/^\*\*.*?\*\*[:\s]*$/gm, '');

      const instructionPattern = /\b(must|should|need to|required to|expected to|instructed to|guideline|requirement|rule|instruction|format|output|provide|generate|create|write|deliver|ensure|match|follow|avoid|do not|don't|critical|important)\b/gi;
      cleanedContent = cleanedContent
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          if (trimmed.length < 10) return false;
          if (trimmed.match(/^["'`]/) || trimmed.includes('#') || trimmed.length > 50) return true;
          return !instructionPattern.test(trimmed);
        })
        .join('\n');

      let potentialCaptions = cleanedContent.split(/\n\n+/);
      if (potentialCaptions.length < 3) {
        potentialCaptions = cleanedContent.split(/\n/);
      }
      if (potentialCaptions.length < 3) {
        potentialCaptions = cleanedContent.split(/\n-|\n\d+\./);
      }

      captions = potentialCaptions
        .map((caption) => caption.trim())
        .filter((caption) => {
          const lower = caption.toLowerCase();
          return (
            caption.length > 15 &&
            !lower.startsWith('here are') &&
            !lower.startsWith("here's") &&
            !lower.startsWith('here is') &&
            !lower.startsWith('captions for') &&
            !lower.startsWith('engaging captions') &&
            !lower.startsWith('three captions') &&
            !lower.startsWith('3 captions') &&
            !lower.startsWith('caption ') &&
            !lower.startsWith('caption option') &&
            !lower.startsWith('option ') &&
            !lower.match(/^(role|task|format|style|strategy|guideline|requirement|rule|instruction|output|provide|generate|create|write|deliver|ensure|match|follow|avoid|critical|important)[:\s]/) &&
            !lower.match(/^(##?|###)\s/) &&
            !lower.match(/^[🎯🚨📋🎨🎭👥💼🎤📝🌐📄✅❌]/) &&
            !lower.match(/^(✓|✗|[-*•])\s*(professional|email|caption|hashtag|introduction|explanation|numbering)/)
          );
        })
        .slice(0, 3);

      if (captions.length < 3) {
        const allLines = cleanedContent
          .split(/\n/)
          .map((line) => line.trim())
          .filter((line) => {
            const lower = line.toLowerCase();
            return (
              line.length > 10 &&
              !lower.match(/^(role|task|format|style|strategy|guideline|requirement|rule|instruction|output|provide|generate|create|write|deliver|ensure|match|follow|avoid|critical|important)[:\s]/) &&
              !lower.match(/^(##?|###)\s/) &&
              !lower.match(/^[🎯🚨📋🎨🎭👥💼🎤📝🌐📄✅❌]/)
            );
          });
        if (allLines.length >= 3) {
          captions = allLines.slice(0, 3);
        }
      }
    }

    return NextResponse.json({
      success: true,
      captions,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Caption generation error:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate captions' },
      { status: 400 }
    );
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
    if (imageData && imageData.trim()) {
      const validation = isValidImageData(imageData);
      if (!validation.isValid) {
        throw new Error('Invalid image data - must be blob URL or base64');
      }
    }

    let brandContext: Awaited<ReturnType<typeof getBrandContext>> | null = null;
    if (clientId) {
      brandContext = await getBrandContext(supabase, clientId);
    }

    let systemPrompt = 'You are a creative social media copywriter. Create a fresh variation of the provided caption.\n\n';
    systemPrompt += 'CRITICAL OUTPUT RULES:\n';
    systemPrompt += '- Output ONLY the new caption text - no instructions, no explanations, no meta-commentary\n';
    systemPrompt += '- Do NOT include phrases like "Here\'s a remix:" or "Caption variation:"\n';
    systemPrompt += '- Do NOT repeat any instructions or guidelines in your output\n';
    systemPrompt += '- Start directly with the caption text\n\n';
    systemPrompt += 'Requirements:\n';
    systemPrompt += '- Maintain the EXACT same meaning and message\n';
    systemPrompt += '- Use DIFFERENT words and phrasing\n';
    systemPrompt += '- Keep the SAME style, tone, and structure\n';
    systemPrompt += '- Match the original\'s emotional feel and writing style\n';

    if (aiContext) {
      systemPrompt += `\nPost Notes to include: ${aiContext}\n`;
    }

    if (brandContext) {
      systemPrompt += `\nBrand Context: ${brandContext.company || 'Not specified'} | Tone: ${
        brandContext.tone || 'Not specified'
      } | Audience: ${brandContext.audience || 'Not specified'}\n`;
      if (brandContext.voice_examples) {
        systemPrompt += `Brand Voice Examples: ${brandContext.voice_examples}\n`;
      }
      if (brandContext.dos) {
        systemPrompt += `Do: ${brandContext.dos}\n`;
      }
      if (brandContext.donts) {
        systemPrompt += `Don't: ${brandContext.donts}\n`;
      }
    }

    systemPrompt += '\nWrite the caption variation now. Output only the caption text, nothing else.';

    let originalCaption = prompt;
    // fallback for case: 'Original caption: "..."'
    const og = prompt.match(/Original caption: "([^"]+)"/);
    if (og && og[1]) {
      originalCaption = og[1];
    }
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Create a fresh variation of this caption: "${originalCaption}"`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    let caption = response.choices[0]?.message?.content || 'No caption generated';
    caption = caption.trim();

    caption = caption.replace(
      /^(here's|here is|here are|below is|below are|following is|following are|i've created|i've generated|i've written|i'll provide|i'll create|i'll generate|remix|caption remix|caption variation|variation|new caption|fresh variation|here's a remix|here's a variation|caption:)\s*/gi,
      ''
    );
    caption = caption.replace(
      /^(provide|output|write|generate|create|deliver|ensure|match|follow|integrate|maintain|avoid|do not|don't|no|start|begin|end|critical|important|note|remember|guideline|requirement|rule|instruction)[:\s]*\n?/gmi,
      ''
    );
    caption = caption.replace(/^#{1,6}\s+.*$/gm, '');
    caption = caption.replace(/^\*\*.*?\*\*[:\s]*$/gm, '');
    caption = caption.replace(/^[🎯🚨📋🎨🎭👥💼🎤📝🌐📄✅❌]\s*[:\s]*/gm, '');

    const instructionPattern =
      /\b(must|should|need to|required to|expected to|instructed to|guideline|requirement|rule|instruction|format|output|provide|generate|create|write|deliver|ensure|match|follow|avoid|do not|don't|critical|important)\b/gi;
    caption = caption
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed.length < 5) return false;
        if (trimmed.match(/^["'`]/) || trimmed.includes('#') || trimmed.length > 30) return true;
        return !instructionPattern.test(trimmed);
      })
      .join('\n')
      .trim();

    return NextResponse.json({
      success: true,
      caption: caption || 'No caption generated',
    });
  } catch (error: any) {
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'remix_caption',
      clientId,
      additionalData: {
        hasImageData: !!imageData,
        hasContext: !!aiContext,
        hasExistingCaptions: existingCaptions.length > 0,
      },
    });
  }
}

async function generateContentIdeas(
  openai: OpenAI,
  supabase: SupabaseClient,
  clientId: string,
  userId: string
) {
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
    const upcomingHolidays = allUpcomingHolidays.filter((holiday) => {
      if (holiday.type === 'international') return true;
      if (holiday.category === 'National') {
        if (
          clientRegion.includes('New Zealand') &&
          (holiday.name.includes('Waitangi') || holiday.name.includes('ANZAC'))
        ) {
          return true;
        }
        return true;
      }
      if (holiday.category === 'Regional') {
        const holidayRegion = holiday.name
          .replace(' Anniversary Day', '')
          .replace(' Day', '');
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
      day: 'numeric',
    });

    const month = now.getMonth() + 1;
    const isSouthernHemisphere =
      clientRegion.includes('New Zealand') || clientRegion.includes('Australia');
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

    const generateContentIdeasPrompt = (
      clientData: ClientData,
      holidays: HolidayData[],
      currentContext: CurrentContext,
      clientRegion: string
    ) => {
      const holidaysList = holidays.length > 0
        ? holidays.map(h => `- ${h.name} (${h.date}, ${h.daysUntil} days away): ${h.marketingAngle}`).join('\n')
        : 'No upcoming holidays in the next 8 weeks';

      return `
You are a senior marketing strategist generating targeted social media content ideas that drive business results.

🎯 CLIENT BUSINESS CONTEXT:
${clientData.company_description ? `💼 COMPANY: ${clientData.company_description}` : '💼 COMPANY: Not specified'}
${clientData.industry ? `🏭 INDUSTRY: ${clientData.industry}` : ''}
${clientData.target_audience ? `👥 AUDIENCE: ${clientData.target_audience}` : '👥 AUDIENCE: Not specified'}
${clientData.value_proposition ? `✨ VALUE PROPOSITION: ${clientData.value_proposition}` : '✨ VALUE PROPOSITION: Not specified'}
${clientData.brand_tone ? `🎭 TONE: ${clientData.brand_tone}` : ''}

📍 CONTEXT:
- Region: ${clientRegion}
- Date: ${currentContext.date}
- Season: ${currentContext.season}

📅 UPCOMING HOLIDAYS:
${holidaysList}

🚨 REQUIREMENTS:
Every idea must be specifically tailored to THIS client's business by combining:
1. What they do (company description)
2. Who their customers are (target audience)  
3. What makes them unique (value proposition)
4. Where they operate (${clientRegion})
5. Current season/timing

Make each idea unique to THIS business - not generic content any competitor could post.
`.trim();
    };

    const currentContext: CurrentContext = {
      date: currentDate,
      season: season,
      weatherContext: `${season} weather patterns in ${clientRegion}`,
    };

    const clientData: ClientData = {
      company_description: brandContext.company,
      industry: industry,
      brand_tone: brandContext.tone,
      target_audience: brandContext.audience,
      value_proposition: brandContext.value_proposition,
      brand_voice_examples: brandContext.voice_examples,
      caption_dos: brandContext.dos,
      caption_donts: brandContext.donts,
    };

    const futureHolidays = upcomingHolidays.filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      return holidayDate >= today;
    });

    const formattedHolidays: HolidayData[] = futureHolidays.map((holiday) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil(
        (holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        name: holiday.name,
        date: holidayDate.toLocaleDateString(locale),
        daysUntil: Math.max(0, daysUntil),
        marketingAngle: holiday.marketingAngle,
      };
    });

    const systemPrompt = generateContentIdeasPrompt(
      clientData,
      formattedHolidays,
      currentContext,
      clientRegion
    );

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a content strategist that ONLY outputs valid JSON. Never include framework questions, meta-commentary, or prompt artifacts in your output.',
        },
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `OUTPUT RULES:
- Output ONLY valid JSON
- DO NOT include framework questions or meta-commentary
- No asterisks (**) or prompt artifacts

REQUIRED JSON STRUCTURE:
{
  "content_ideas": [
    {
      "title": "Clear content idea title",
      "marketingAngle": "One sentence explaining why this works for this business",
      "postExample": "Short post text under 50 characters"
    }
  ]
}

FIELD REQUIREMENTS:
- "title": Clear, engaging content idea title (no questions, no colons)
- "marketingAngle": ONE sentence explaining why this specific idea works for THIS business and their target audience
- "postExample": A concise social media post example (maximum 150 characters)

EXAMPLE:
{
  "content_ideas": [
    {
      "title": "Summer Kickoff Fiesta",
      "marketingAngle": "Drives foot traffic by targeting families seeking local summer activities, positioning the venue as a community gathering spot.",
      "postExample": "Summer is here! 🌞 Join us this Saturday for our Summer Kickoff Fiesta - live music, food trucks, and family fun. See you there!"
    }
  ]
}

---

Generate 3 content ideas specifically tailored to this client.

Each idea must combine:
1. The client's business, audience, and value proposition
2. Their location (${clientRegion})
3. Current season/timing (${currentDate}, ${season})

Make the 3 ideas different from each other (vary content types and emotions).
Each idea should be unique to THIS business - not generic content any competitor could post.

Only suggest future holidays/events after ${currentDate} that are relevant to ${clientRegion}.`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const rawOutput = response.choices[0]?.message?.content || '';
    const content = rawOutput;

    // TEMPORARY DEBUG: Log raw output and leakage detection
    console.log('=== AI Content Ideas Debug ===');
    console.log('Raw output:', rawOutput);
    const leakageDetected = rawOutput ? detectPromptLeakage(rawOutput) : false;
    console.log('Leakage detected:', leakageDetected);

    // Monitor for prompt leakage
    if (rawOutput && leakageDetected) {
      logLeakageIncident(rawOutput, { 
        clientId, 
        operation: 'generateContentIdeas',
        userId,
      });
    }

    let ideas: Array<{
      idea: string;
      angle: string;
      visualSuggestion: string;
      timing: string;
      holidayConnection: string;
    }> = [];
    
    // Try to sanitize and validate the response first
    try {
      if (!rawOutput || rawOutput.trim() === '') throw new Error('Empty response');
      
      // Extract JSON from raw output (may have text before/after)
      let jsonString = rawOutput.trim();
      
      // Remove text prefixes like "Marketing Angle" or "Post Example" that appear before JSON
      jsonString = jsonString.replace(/^[^{[]*/, ''); // Remove everything before first { or [
      
      // Find the first { or [ to start JSON extraction
      const firstBrace = jsonString.indexOf('{');
      const firstBracket = jsonString.indexOf('[');
      
      let startPos = -1;
      let endPos = -1;
      
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        // JSON object - need to find matching closing brace
        startPos = firstBrace;
        let braceCount = 0;
        for (let i = startPos; i < jsonString.length; i++) {
          if (jsonString[i] === '{') braceCount++;
          if (jsonString[i] === '}') braceCount--;
          if (braceCount === 0) {
            endPos = i;
            break;
          }
        }
      } else if (firstBracket !== -1) {
        // JSON array - need to find matching closing bracket
        startPos = firstBracket;
        let bracketCount = 0;
        for (let i = startPos; i < jsonString.length; i++) {
          if (jsonString[i] === '[') bracketCount++;
          if (jsonString[i] === ']') bracketCount--;
          if (bracketCount === 0) {
            endPos = i;
            break;
          }
        }
      }
      
      if (startPos !== -1 && endPos !== -1 && endPos > startPos) {
        jsonString = jsonString.substring(startPos, endPos + 1);
      } else {
        // If extraction failed, try using the whole string (might be clean JSON already)
        // Remove any obvious text prefixes/suffixes
        jsonString = rawOutput.trim();
        jsonString = jsonString.replace(/^[^{[]*/, '');
        // Try to find the end by looking for the last complete closing brace/bracket
        const lastBrace = jsonString.lastIndexOf('}');
        const lastBracket = jsonString.lastIndexOf(']');
        if (lastBrace > lastBracket && lastBrace > 0) {
          jsonString = jsonString.substring(0, lastBrace + 1);
        } else if (lastBracket > 0) {
          jsonString = jsonString.substring(0, lastBracket + 1);
        }
      }
      
      // TEMPORARY DEBUG: Log extracted JSON
      console.log('Extracted JSON string:', jsonString.substring(0, 500));
      
      // Attempt to sanitize and validate the JSON response
      const sanitizedIdeas = sanitizeAndValidateContentIdeas(jsonString);
      
      // TEMPORARY DEBUG: Log sanitized output
      console.log('Sanitized ideas:', JSON.stringify(sanitizedIdeas, null, 2));
      console.log('=============================');
      
      // Map sanitized ContentIdea[] to the expected format
      ideas = sanitizedIdeas.map((sanitized) => ({
        idea: sanitized.title,
        angle: sanitized.marketingAngle,
        visualSuggestion: 'Engaging visual content',
        timing: sanitized.postExample || sanitized.title || 'Timely and relevant',
        holidayConnection: 'Evergreen content',
      }));
      
      if (ideas.length > 0) {
        return NextResponse.json({
          success: true,
          ideas: ideas,
        });
      }
    } catch (sanitizationError) {
      // TEMPORARY DEBUG: Log sanitization errors
      console.log('Sanitization failed:', sanitizationError instanceof Error ? sanitizationError.message : String(sanitizationError));
      
      // Check if this is a validation error from sanitization
      const isValidationError = sanitizationError instanceof Error && 
        (sanitizationError.message.includes('validation') || 
         sanitizationError.message.includes('missing required field') ||
         sanitizationError.message.includes('empty') ||
         sanitizationError.message.includes('parse JSON'));
      
      if (isValidationError) {
        // Log detailed error server-side only
        logger.error('Content ideas validation failed:', {
          error: sanitizationError instanceof Error ? sanitizationError.message : String(sanitizationError),
          clientId,
          userId,
          operation: 'generate_content_ideas',
        });
        
        // Return user-friendly error without exposing internals
        return NextResponse.json(
          {
            error: 'Failed to generate valid content ideas. Please try again.',
            code: 'VALIDATION_ERROR',
          },
          { status: 500 }
        );
      }
      
      // If sanitization fails for other reasons, log and fall through to existing parsing logic
      logger.warn('Content ideas sanitization failed, falling back to legacy parsing:', sanitizationError);
    }
    
    // Fallback to existing parsing logic if sanitization fails
    try {
      if (!content || content.trim() === '') throw new Error('Empty response');

      let parsedIdeas: Array<{
        idea: string;
        angle: string;
        visualSuggestion: string;
        timing: string;
        holidayConnection: string;
      }> = [];
      const ideaRegex =
        /(?:^|\n)(?:\*\*)?IDEA\s+(\d+)(?:\*\*)?:?\s*\n?(.*?)(?=(?:^|\n)(?:\*\*)?IDEA\s+\d+|CONTENT SERIES|$)/gis;
      const matches = Array.from(content.matchAll(ideaRegex));
      for (const match of matches.slice(0, 3)) {
        const ideaText = match[2] || '';
        const lines = ideaText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const titleLine =
          lines.find(
            (line) =>
              !line.match(
                /^(Funnel Stage|Primary Platform|Content Format|Business Goal|Target Audience|Content Angle|Visual|Hook|Content Structure|CTA|Hashtag|Success|Pro Tip)/i
              ) && line.length > 5
          ) ||
          lines[0] ||
          'Content Idea';
        const idea = titleLine
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/^[\d\.\-\*]+[\s\.]+/g, '')
          .trim()
          .replace(/^["']+|["']+$/g, '');

        const angleMatch = ideaText.match(
          /Content Angle[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Visual|Hook|Content Structure|CTA|$))/is
        );
        const angle = angleMatch
          ? angleMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0]
          : lines
              .find((l) => l.toLowerCase().includes('angle'))
              ?.replace(/^.*?angle[:\s]+/i, '')
              .trim() || 'Strategic content angle';

        const visualMatch = ideaText.match(
          /Visual Concept[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Hook|Content Structure|CTA|$))/is
        );
        const visualSuggestion = visualMatch
          ? visualMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0]
          : lines
              .find((l) => l.toLowerCase().includes('visual'))
              ?.replace(/^.*?visual[:\s]+/i, '')
              .trim() || 'Engaging visual content';

        const hookMatch = ideaText.match(
          /Hook[\/\s]*Opening[:\s]+\*?\*?(.*?)(?=\n(?:\*\*)?(?:Content Structure|CTA|$))/is
        );
        let timing = hookMatch
          ? hookMatch[1].trim().replace(/^\*\*|\*\*$/g, '').split('\n')[0].replace(/^["']|["']$/g, '')
          : lines
              .find((l) => l.toLowerCase().includes('hook'))
              ?.replace(/^.*?hook[:\s]+/i, '')
              .trim() || 'Timely and relevant';
        timing = timing.replace(/^["']|["']$/g, '').trim();
        if (!timing || timing.length < 10) {
          timing = idea.substring(0, 100) || 'Timely and relevant';
        }

        let holidayConnection = 'Evergreen content';
        const holidayKeywords =
          /(holiday|Holiday|event|Event|seasonal|Seasonal|Christmas|Easter|Thanksgiving|New Year|Valentine|Halloween|Independence|Waitangi|ANZAC)/i;
        if (holidayKeywords.test(ideaText)) {
          const holidayMatch = ideaText.match(
            /(?:holiday|Holiday|event|Event|seasonal|Seasonal).*?(?:\n|$)/i
          );
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
          holidayConnection: holidayConnection || 'Evergreen content',
        });
      }

      if (parsedIdeas.length === 0) {
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        let currentIdea: Partial<{
          idea: string;
          angle: string;
          visualSuggestion: string;
          timing: string;
          holidayConnection: string;
        }> = {};

        for (let i = 0; i < lines.length && parsedIdeas.length < 3; i++) {
          const line = lines[i].trim();
          if (/IDEA\s+\d+|^[\*\-\d]+\./.test(line)) {
            if (currentIdea.idea) {
              parsedIdeas.push({
                idea: currentIdea.idea || 'Content Idea',
                angle: currentIdea.angle || 'Strategic content angle',
                visualSuggestion: currentIdea.visualSuggestion || 'Engaging visual content',
                timing: currentIdea.timing || currentIdea.idea || 'Timely and relevant',
                holidayConnection: currentIdea.holidayConnection || 'Evergreen content',
              });
            }
            currentIdea = {
              idea: line
                .replace(/^[\*\-\d\.\s]+|IDEA\s+\d+:?\s*/gi, '')
                .trim()
                .replace(/^["']+|["']+$/g, ''),
            };
          } else if (currentIdea.idea && line.length > 20) {
            if (!currentIdea.angle) {
              currentIdea.angle = line;
            } else if (!currentIdea.visualSuggestion) {
              currentIdea.visualSuggestion = line;
            } else if (!currentIdea.timing) {
              currentIdea.timing = line;
            }
          }
        }
        if (currentIdea.idea && parsedIdeas.length < 3) {
          parsedIdeas.push({
            idea: currentIdea.idea || 'Content Idea',
            angle: currentIdea.angle || 'Strategic content angle',
            visualSuggestion: currentIdea.visualSuggestion || 'Engaging visual content',
            timing: currentIdea.timing || currentIdea.idea || 'Timely and relevant',
            holidayConnection: currentIdea.holidayConnection || 'Evergreen content',
          });
        }
      }

      if (parsedIdeas.length === 0) {
        const chunks = content.split(/\n\n+/).filter((chunk) => chunk.trim().length > 50);
        for (let i = 0; i < Math.min(3, chunks.length); i++) {
          const chunk = chunks[i];
          const firstLine = chunk.split('\n')[0]?.trim() || 'Content Idea';
          parsedIdeas.push({
            idea: firstLine
              .replace(/^[\*\-\d\.\s]+/g, '')
              .replace(/^["']+|["']+$/g, '')
              .substring(0, 100),
            angle: chunk.substring(0, 200),
            visualSuggestion: 'Engaging visual content',
            timing: firstLine.substring(0, 100),
            holidayConnection: 'Evergreen content',
          });
        }
      }

      ideas = parsedIdeas.length > 0 ? parsedIdeas : [];
      if (ideas.length === 0) {
        throw new Error('Failed to parse ideas from response');
      }
      return NextResponse.json({
        success: true,
        ideas: ideas,
      });
    } catch (parseError) {
      logger.error('Failed to parse content ideas response:', parseError);
      ideas = [
        {
          idea: 'Expert Authority',
          angle: 'Share industry insights that position your brand as the go-to expert',
          visualSuggestion: 'Clean infographic with key insights and data',
          timing: "Wellington professionals start their day at FitLife Studio.",
          holidayConnection: 'Evergreen content that builds authority year-round',
        },
        {
          idea: 'Client Success Story',
          angle: 'Showcase a real client transformation to build trust and credibility',
          visualSuggestion: 'Before/after photos with testimonial quote overlay',
          timing: "Sarah's journey from 'No Time' to 'Every Morning' in 90 days with FitLife.",
          holidayConnection: 'Social proof content that converts regardless of season',
        },
        {
          idea: 'Behind the Scenes',
          angle: 'Reveal your process and team to build personal connection with audience',
          visualSuggestion: 'Candid team photos or process documentation',
          timing: 'How the FitLife crew preps for your 6am workout, every single day.',
          holidayConnection: 'Authentic content that humanizes your brand',
        },
      ];
      return NextResponse.json({
        success: true,
        ideas: ideas,
      });
    }
  } catch (error: any) {
    // Check if this is a validation error from sanitization
    const isValidationError = error instanceof Error && 
      (error.message.includes('validation') || 
       error.message.includes('missing required field') ||
       error.message.includes('empty') ||
       error.message.includes('parse JSON'));
    
    if (isValidationError) {
      // Log detailed error server-side only
      logger.error('Content ideas validation error:', {
        error: error instanceof Error ? error.message : String(error),
        clientId,
        userId,
        operation: 'generate_content_ideas',
      });
      
      // Return user-friendly error without exposing internals
      return NextResponse.json(
        {
          error: 'Failed to generate valid content ideas. Please try again.',
          code: 'VALIDATION_ERROR',
        },
        { status: 500 }
      );
    }
    
    // For other errors, log detailed info server-side and return generic message
    logger.error('Content ideas generation error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      clientId,
      userId,
      operation: 'generate_content_ideas',
    });
    
    // Use handleApiError for other errors (it will sanitize the response)
    return handleApiError(error, {
      route: '/api/ai',
      operation: 'generate_content_ideas',
      clientId: clientId,
      additionalData: { clientId },
    });
  }
}

function extractIndustry(companyDescription: string): string {
  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Retail',
    'Food & Beverage',
    'Fashion',
    'Beauty',
    'Fitness',
    'Education',
    'Real Estate',
    'Travel',
    'Automotive',
    'Professional Services',
    'Manufacturing',
    'Construction',
    'Agriculture',
    'Entertainment',
    'Non-profit',
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
    Technology: `
- Focus on innovation, digital transformation, and tech trends
- Use screenshots, demos, and technical visuals
- Highlight problem-solving and efficiency improvements
- Target tech-savvy professionals and early adopters`,
    Healthcare: `
- Emphasize patient care, wellness, and medical expertise
- Use professional medical imagery and infographics
- Focus on health education and preventive care
- Target health-conscious individuals and families`,
    Finance: `
- Highlight financial security, investment advice, and planning
- Use charts, graphs, and financial visualizations
- Focus on trust, expertise, and long-term relationships
- Target individuals and businesses seeking financial guidance`,
    Retail: `
- Showcase products, customer experiences, and shopping benefits
- Use high-quality product photography and lifestyle images
- Focus on value, quality, and customer satisfaction
- Target consumers and shopping enthusiasts`,
    'Food & Beverage': `
- Emphasize taste, quality ingredients, and dining experiences
- Use appetizing food photography and kitchen scenes
- Focus on flavor, freshness, and culinary expertise
- Target food lovers and dining enthusiasts`,
    Fashion: `
- Highlight style, trends, and personal expression
- Use fashion photography and lifestyle imagery
- Focus on aesthetics, quality, and individual style
- Target fashion-conscious consumers`,
    Beauty: `
- Emphasize transformation, self-care, and confidence
- Use beauty photography and before/after visuals
- Focus on results, techniques, and self-expression
- Target beauty enthusiasts and self-care advocates`,
    Fitness: `
- Highlight health, strength, and personal achievement
- Use action photography and fitness demonstrations
- Focus on motivation, results, and healthy lifestyle
- Target fitness enthusiasts and health-conscious individuals`,
    Education: `
- Emphasize learning, growth, and knowledge sharing
- Use educational graphics and classroom imagery
- Focus on skill development and academic success
- Target students, parents, and lifelong learners`,
    'Real Estate': `
- Highlight properties, locations, and lifestyle opportunities
- Use property photography and neighborhood imagery
- Focus on investment potential and lifestyle benefits
- Target homebuyers, investors, and property seekers`,
    Travel: `
- Emphasize experiences, destinations, and adventure
- Use travel photography and destination imagery
- Focus on discovery, relaxation, and cultural experiences
- Target travelers and adventure seekers`,
    Automotive: `
- Highlight performance, reliability, and innovation
- Use vehicle photography and technical specifications
- Focus on safety, efficiency, and driving experience
- Target car enthusiasts and vehicle buyers`,
    'Professional Services': `
- Emphasize expertise, results, and client success
- Use professional headshots and office imagery
- Focus on trust, competence, and value delivery
- Target business owners and decision-makers`,
    Manufacturing: `
- Highlight quality, innovation, and production excellence
- Use factory imagery and product showcases
- Focus on precision, efficiency, and reliability
- Target industry professionals and business buyers`,
    Construction: `
- Emphasize craftsmanship, safety, and project completion
- Use construction site photography and finished projects
- Focus on quality workmanship and project success
- Target property owners and construction professionals`,
    Agriculture: `
- Highlight sustainability, quality, and farming expertise
- Use farm photography and agricultural imagery
- Focus on natural products and farming practices
- Target consumers and agricultural professionals`,
    Entertainment: `
- Emphasize fun, creativity, and memorable experiences
- Use event photography and entertainment imagery
- Focus on enjoyment, engagement, and entertainment value
- Target entertainment seekers and event attendees`,
    'Non-profit': `
- Highlight impact, community service, and social causes
- Use community photography and impact imagery
- Focus on social good, volunteerism, and positive change
- Target supporters, volunteers, and community members`,
  };

  return (
    guidanceMap[industry] ||
    `
- Focus on your unique value proposition and customer benefits
- Use professional imagery that represents your brand
- Highlight what makes your business special
- Target your ideal customers and their needs`
  );
}

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
