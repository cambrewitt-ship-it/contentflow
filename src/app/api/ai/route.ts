import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { action, imageData, prompt, existingCaptions, aiContext } = await request.json();

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
        return await generateCaptions(imageData, existingCaptions, aiContext);
      
      case 'remix_caption':
        return await remixCaption(imageData, prompt, existingCaptions, aiContext);
      
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

async function generateCaptions(imageData: string, existingCaptions: string[] = [], aiContext?: string) {
  try {
    const systemPrompt = `You are a creative social media copywriter. 
    Generate exactly 3 engaging, diverse captions for the provided image.
    
    Requirements:
    - Each caption should be different in tone and approach
    - Include relevant hashtags (3-5 per caption)
    - Keep captions engaging and shareable
    - Consider the visual elements and mood of the image
    - Make them suitable for platforms like Instagram, Facebook, or LinkedIn
    
    ${aiContext ? `Use this comprehensive context to inform your captions: ${aiContext}` : ''}
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

async function remixCaption(imageData: string, prompt: string, existingCaptions: string[] = [], aiContext?: string) {
  try {
    const systemPrompt = `You are a creative social media copywriter. 
    The user wants to remix/improve a caption based on their feedback.
    
    User feedback: ${prompt}
    
    ${aiContext ? `Use this comprehensive context to inform your caption improvement: ${aiContext}` : ''}
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
