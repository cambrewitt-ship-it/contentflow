import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData } from '../../../lib/blobUpload';
import { getUpcomingHolidays, formatHolidaysForPrompt } from '../../../lib/data/holidays';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper functions for dynamic content

function getCopyToneInstructions(copyTone: string) {
  const toneMap: Record<string, string> = {
    'promotional': `
**Promotional Focus:**
- Lead with compelling offers, benefits, or value propositions
- Include clear, actionable calls-to-action
- Create urgency where appropriate ("limited time", "don't miss out")
- Highlight specific deals, prices, or exclusive opportunities
- Use persuasive language that drives immediate action`,

    'educational': `
**Educational Focus:**
- Share valuable insights, tips, or industry knowledge
- Position the brand as a trusted expert and resource
- Use informative, helpful language that teaches or guides
- Include practical advice or actionable takeaways  
- Build authority through expertise demonstration`,

    'personal': `
**Personal Focus:**
- Use authentic, behind-the-scenes storytelling
- Share personal experiences, insights, or day-in-the-life content
- Create genuine connections with a conversational tone
- Include personal anecdotes or authentic moments
- Build trust through transparency and relatability`,

    'testimonial': `
**Testimonial Focus:**
- Highlight client success stories and positive outcomes
- Use social proof to build credibility and trust
- Include specific results, achievements, or transformations
- Feature client quotes, reviews, or feedback when available
- Demonstrate value through real-world examples`,

    'engagement': `
**Engagement Focus:**
- Ask questions to encourage audience interaction
- Create conversation starters and community discussion
- Use interactive elements like polls, opinions, or experiences
- Invite audience to share their thoughts or stories
- Build community through two-way communication`
  };
  
  return toneMap[copyTone] || `**General Social Media Copy:** Create engaging, brand-appropriate content that drives social interaction.`;
}

function getContentHierarchy(aiContext: string | undefined, postNotesStyle: string, imageFocus: string) {
  if (aiContext) {
    return `
**Content Priority Order:**
1. **Post Notes Content** (Primary) - ${getPostNotesApproach(postNotesStyle)}
2. **Brand Voice & Guidelines** (Secondary) - Apply brand personality to content
3. **Image Elements** (${getImageRole(imageFocus)}) - ${getImageDescription(imageFocus)}`;
  } else {
    return `
**Content Priority Order:**
1. **Brand Context** (Primary) - Use company values, tone, and target audience
2. **Image Analysis** (${getImageRole(imageFocus)}) - ${getImageDescription(imageFocus)}
3. **Brand Guidelines** (Always) - Apply dos/don'ts and style rules consistently`;
  }
}

function getPostNotesApproach(style: string) {
  const approaches: Record<string, string> = {
    'quote-directly': 'Use exact wording and specific details from notes',
    'paraphrase': 'Rewrite notes content in brand voice while keeping all key information',
    'use-as-inspiration': 'Capture the essence and intent of notes with creative interpretation'
  };
  return approaches[style] || 'Incorporate notes content appropriately';
}

function getImageRole(focus: string) {
  const roles: Record<string, string> = {
    'main-focus': 'Primary Content Driver',
    'supporting': 'Content Enhancer', 
    'background': 'Context Provider',
    'none': 'Not Used'
  };
  return roles[focus] || 'Supporting';
}

function getImageDescription(focus: string) {
  const descriptions: Record<string, string> = {
    'main-focus': 'Build captions around what\'s shown in the image',
    'supporting': 'Use image details to enhance and support the main message',
    'background': 'Reference image elements briefly for context',
    'none': 'Focus entirely on text content, ignore image'
  };
  return descriptions[focus] || 'Use image details to support content';
}

function getPostNotesInstructions(style: string) {
  const instructions: Record<string, string> = {
    'quote-directly': 'Include specific phrases, numbers, and details exactly as written. If notes mention "$50 special offer", your caption must include "$50 special offer".',
    'paraphrase': 'Rewrite the notes content in the brand\'s voice while preserving all key information, prices, dates, and important details.',
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

    'supporting': `
**Supporting Image Role:**
- Identify relevant visual elements that enhance the message
- Connect image details to the main content theme
- Use visuals to add credibility and context
- Balance image references with primary content focus`,

    'background': `
**Background Image Context:**
- Briefly acknowledge the setting or context shown
- Use minimal image references to support the message  
- Focus primarily on text content with light visual mentions
- Keep image descriptions concise and contextual`,

    'none': `
**Text-Only Focus:**
- Do not reference or describe image elements
- Focus entirely on post notes and brand messaging
- Create content independent of visual elements
- Treat this as text-based content creation`
  };
  
  return instructions[focus] || instructions['supporting'];
}

// Email-specific helper functions

function getEmailCopyToneInstructions(copyTone: string) {
  const emailToneMap: Record<string, string> = {
    'promotional': `
**Promotional Email Focus:**
- Lead with compelling value propositions and exclusive offers
- Create urgency with limited-time language and deadlines  
- Include specific pricing, discounts, or promotional details
- Use direct, persuasive language that drives immediate action
- Focus on benefits and outcomes for the recipient
- End with strong, clear calls-to-action`,

    'educational': `
**Educational Email Focus:**
- Share valuable insights, tips, or industry expertise
- Position content as helpful resource or professional guidance
- Use informative, authoritative language that builds trust
- Include practical advice or actionable information
- Establish credibility through knowledge demonstration
- Guide reader toward next educational step or consultation`,

    'personal': `
**Personal Email Focus:**
- Use authentic, conversational tone with personal touch
- Share relevant experiences or behind-the-scenes insights
- Create genuine connection through relatable communication
- Include personal anecdotes that relate to business value
- Build trust through transparency and authentic voice
- Invite personal connection or direct communication`,

    'testimonial': `
**Testimonial Email Focus:**
- Highlight specific client success stories and outcomes
- Use social proof to demonstrate value and credibility
- Include concrete results, achievements, or transformations
- Feature client feedback, quotes, or case study details
- Demonstrate proven track record through real examples
- Invite reader to achieve similar results`,

    'engagement': `
**Engagement Email Focus:**
- Ask relevant questions to encourage response or interaction  
- Create conversation opportunities around reader's needs
- Use interactive language that invites participation
- Build relationship through two-way communication approach
- Encourage direct replies or personal consultation requests
- Focus on understanding reader's specific situation`
  };
  
  return emailToneMap[copyTone] || `**Professional Email Copy:** Create direct, value-focused content that drives email engagement and response.`;
}

function getEmailContentHierarchy(aiContext: string | undefined, postNotesStyle: string, imageFocus: string) {
  if (aiContext) {
    return `
**Email Content Priority:**
1. **Post Notes Content** (Primary Message) - ${getPostNotesApproach(postNotesStyle)}
2. **Brand Voice & Professionalism** (Communication Style) - Apply brand personality in professional email context
3. **Image Reference** (${getImageRole(imageFocus)}) - ${getEmailImageRole(imageFocus)}`;
  } else {
    return `
**Email Content Priority:**  
1. **Brand Context & Value** (Primary Message) - Use company expertise and value proposition
2. **Professional Communication** (Email Standards) - Apply brand voice in email-appropriate format
3. **Image Reference** (${getImageRole(imageFocus)}) - ${getEmailImageRole(imageFocus)}`;
  }
}

function getEmailImageRole(focus: string) {
  const emailImageDescriptions: Record<string, string> = {
    'main-focus': 'Reference key image elements as primary talking points in email content',
    'supporting': 'Mention relevant image details to enhance credibility and context', 
    'background': 'Briefly reference image context if relevant to message',
    'none': 'Focus entirely on text-based value proposition and messaging'
  };
  return emailImageDescriptions[focus] || 'Use image details to enhance email message credibility';
}

function getEmailImageInstructions(focus: string) {
  const emailImageInstructions: Record<string, string> = {
    'main-focus': `
**Primary Image Integration:**
- Reference key visual elements as central talking points
- Use image content to demonstrate value or showcase offering  
- Build email message around what's prominently displayed
- Connect visual proof to email value proposition`,

    'supporting': `
**Supporting Image Reference:**
- Mention relevant visual elements that add credibility
- Use image details to enhance professional presentation
- Reference visuals briefly to support main email message
- Maintain focus on text while adding visual context`,

    'background': `
**Contextual Image Reference:**
- Briefly acknowledge setting or context if relevant
- Use minimal visual references to support professionalism
- Keep image mentions subtle and message-focused
- Maintain email readability and clear value focus`,

    'none': `
**Text-Focused Email:**
- Do not reference or describe visual elements
- Focus entirely on value proposition and brand messaging  
- Create content independent of any visual components
- Treat as pure text-based professional communication`
  };
  
  return emailImageInstructions[focus] || emailImageInstructions['supporting'];
}

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
    const { action, imageData, prompt, existingCaptions, aiContext, clientId, copyType, copyTone, postNotesStyle, imageFocus } = await request.json();

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
        return await generateCaptions(imageData, existingCaptions, aiContext, clientId, copyType, copyTone, postNotesStyle, imageFocus);
      
      case 'remix_caption':
        return await remixCaption(imageData, prompt, existingCaptions, aiContext, clientId);
      
      case 'generate_content_ideas':
        return await generateContentIdeas(clientId);
      
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

async function generateCaptions(imageData: string, existingCaptions: string[] = [], aiContext?: string, clientId?: string, copyType?: string, copyTone?: string, postNotesStyle?: string, imageFocus?: string) {
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
            website: brandContext.website ? 'Available' : 'None',
            voice_examples: brandContext.voice_examples ? 'Set' : 'Not set'
          });
          
          // Enhanced logging for brand voice examples
          if (brandContext.voice_examples) {
            console.log('🎤 BRAND VOICE EXAMPLES FOUND:', brandContext.voice_examples);
            console.log('📏 BRAND VOICE EXAMPLES LENGTH:', brandContext.voice_examples.length);
          } else {
            console.log('⚠️ NO BRAND VOICE EXAMPLES FOUND - AI will use generic voice');
          }
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

    // Choose system prompt based on copy type
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

Generate the email copy now.` :
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

    console.log('🤖 Sending request to OpenAI...');
    console.log('📝 System prompt length:', systemPrompt.length);
    console.log('🖼️ Image data validation:', validation);
    console.log('🖼️ Image data type:', validation.type);
    console.log('🖼️ Image data URL:', imageData.substring(0, 100) + '...');
    
    // Log the complete prompt for debugging brand voice examples
    console.log('🔍 COMPLETE SYSTEM PROMPT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(systemPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    // Add image to content if image data is valid
    if (validation.isValid && imageData) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageData,
          detail: 'high'
        }
      });
      console.log('🖼️ Added image to OpenAI request:', {
        type: 'image_url',
        image_url: {
          url: imageData.substring(0, 50) + '...',
          detail: 'high'
        }
      });
    } else {
      console.log('⚠️ No valid image data provided, sending text-only request');
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
      // First try splitting by double line breaks
      let potentialCaptions = content.split(/\n\n+/);
      
      // If we don't have enough, try splitting by single line breaks
      if (potentialCaptions.length < 3) {
        potentialCaptions = content.split(/\n/);
      }
      
      // If still not enough, try splitting by other patterns
      if (potentialCaptions.length < 3) {
        potentialCaptions = content.split(/\n-|\n\d+\./);
      }
      
      // Filter and clean up captions
      captions = potentialCaptions
        .map(caption => caption.trim())
        .filter(caption => {
          // Only filter out very short captions and obvious intro text
          return caption.length > 15 && 
                 !caption.toLowerCase().startsWith('here are') &&
                 !caption.toLowerCase().startsWith('captions for') &&
                 !caption.toLowerCase().startsWith('engaging captions') &&
                 !caption.toLowerCase().startsWith('three captions');
        })
        .slice(0, 3);
      
      // If we still don't have 3 captions, take the first 3 non-empty lines
      if (captions.length < 3) {
        const allLines = content.split(/\n/)
          .map(line => line.trim())
          .filter(line => line.length > 10);
        
        if (allLines.length >= 3) {
          captions = allLines.slice(0, 3);
        }
      }
      
      console.log('Social media captions parsed:', captions.length, 'captions');
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

async function generateContentIdeas(clientId: string) {
  try {
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    console.log('🎯 Generating content ideas for client:', clientId);

    // Get upcoming holidays
    const upcomingHolidays = getUpcomingHolidays(8);
    const holidaysText = formatHolidaysForPrompt(upcomingHolidays);

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
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    let season = '';
    if (month >= 12 || month <= 2) season = 'Summer';
    else if (month >= 3 && month <= 5) season = 'Autumn';
    else if (month >= 6 && month <= 8) season = 'Winter';
    else season = 'Spring';

    // Build industry-specific content guidance
    const industry = extractIndustry(brandContext.company || '');
    const industryGuidance = getIndustryContentGuidance(brandContext.company || '');

    console.log('🎯 Content Ideas Generation Debug Info:');
    console.log('📊 Brand Context:', {
      company: brandContext.company || 'Not specified',
      industry: industry,
      tone: brandContext.tone || 'Not specified',
      audience: brandContext.audience || 'Not specified',
      value_proposition: brandContext.value_proposition || 'Not specified'
    });
    console.log('📅 Upcoming Holidays Count:', upcomingHolidays.length);
    console.log('🌍 Current Season:', season);

    // Type definitions for the new prompt system
    interface ClientData {
      company_description?: string
      industry?: string
      brand_tone?: string
      target_audience?: string
      value_proposition?: string
      brand_voice_examples?: string
      caption_dos?: string
      caption_donts?: string
    }

    interface HolidayData {
      name: string
      date: string
      daysUntil: number
      marketingAngle: string
    }

    interface CurrentContext {
      date: string
      season: string
      weatherContext: string
    }

    // Strategic Marketing Consultant System Prompt
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

    // Helper function for industry-specific guidance
    function getIndustryGuidance(industry: string) {
      const industryMap = {
        'Real Estate': `
**Real Estate Content Strategy:**
- Seasonal market insights and buying/selling timing
- Property preparation tips for current season
- Local area highlights and lifestyle benefits
- Market trends and investment opportunities
- Home maintenance and styling advice`,
        
        'Hospitality': `
**Hospitality Content Strategy:**
- Seasonal menu features and local ingredient highlights
- Behind-the-scenes kitchen and service operations
- Local events and community partnerships
- Customer experience stories and testimonials
- Seasonal promotions tied to holidays and weather`,
        
        'Retail': `
**Retail Content Strategy:**
- Seasonal product features and styling tips
- New arrivals and trend spotlights
- Customer styling and product demonstrations  
- Seasonal buying guides and gift ideas
- Community events and local partnerships`,
        
        'Professional Services': `
**Professional Services Content Strategy:**
- Industry insights and expert commentary
- Seasonal business advice and planning tips
- Client success stories and case studies
- Educational content that demonstrates expertise
- Behind-the-scenes team and company culture`,
        
        'Health & Wellness': `
**Health & Wellness Content Strategy:**
- Seasonal health tips and wellness advice
- Exercise and nutrition guidance for current season
- Mental health and lifestyle balance content
- Client transformation stories and testimonials
- Community health initiatives and events`,
        
        'Beauty': `
**Beauty Content Strategy:**
- Seasonal skincare and beauty tips
- Product demonstrations and tutorials
- Before/after transformations and client features
- Seasonal color and style trends
- Self-care and confidence-building content`
      };
      
      return industryMap[industry as keyof typeof industryMap] || `
**General Business Content Strategy:**
- Educational content that demonstrates expertise
- Behind-the-scenes business operations and team
- Client testimonials and success stories  
- Industry insights and trend commentary
- Community involvement and local partnerships`;
    }

    // Prepare data for the new prompt format
    const currentContext = {
      date: currentDate,
      season: season,
      weatherContext: `${season} weather patterns in Wellington`
    };

    const clientData = {
      company_description: brandContext.company,
      industry: industry,
      brand_tone: brandContext.tone,
      target_audience: brandContext.audience,
      value_proposition: brandContext.value_proposition,
      brand_voice_examples: brandContext.voice_examples,
      caption_dos: brandContext.dos,
      caption_donts: brandContext.donts
    };

    // Format holidays for the new prompt
    const formattedHolidays = upcomingHolidays.map(holiday => {
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

    console.log('🤖 Sending content ideas request to OpenAI...');

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
    let ideas;
    try {
      // Parse the new format: IDEA 1: [Title] format with Purpose and Hook
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
      console.error('Failed to parse content ideas response:', parseError);
      console.log('Raw response content:', content);
      
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

    // Ensure we have exactly 3 ideas
    if (!Array.isArray(ideas) || ideas.length !== 3) {
      console.warn('Content ideas response format invalid, using fallback');
      ideas = ideas.slice(0, 3);
    }

    return NextResponse.json({
      success: true,
      ideas: ideas
    });

  } catch (error) {
    console.error('Content ideas generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content ideas' },
      { status: 500 }
    );
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
  
  const description = companyDescription.toLowerCase();
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
