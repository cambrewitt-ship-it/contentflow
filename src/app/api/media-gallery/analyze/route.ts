import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { withAICreditCheck, trackAICreditUsage } from '@/lib/subscriptionMiddleware';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const client = new OpenAI();

const analyzeSchema = z.union([
  z.object({ mediaId: z.string().uuid() }),
  z.object({ mediaIds: z.array(z.string().uuid()).min(1).max(20) }),
]);

const AI_SYSTEM_PROMPT = `You are analyzing an image for a social media management platform.
Describe the image and extract structured metadata for content planning.

Respond in JSON only, no markdown:
{
  "description": "A detailed 1-2 sentence description of the image",
  "tags": ["tag1", "tag2"],
  "categories": ["Food & Drink"],
  "mood": "cosy",
  "setting": "indoor dining",
  "subjects": ["soup", "wooden table", "bread"]
}

Valid categories: Food & Drink, Ambience, Team & Staff, Events, Products, Exterior, Interior, Behind the Scenes, Seasonal, Lifestyle, Nature, Sports, User Generated
Valid moods (one word): cosy, energetic, elegant, casual, warm, vibrant, professional, rustic, modern, playful, serene
Tags: provide 5-15 descriptive tags.`;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const mediaIds =
      'mediaIds' in parsed.data ? parsed.data.mediaIds : [parsed.data.mediaId];

    const creditCheck = await withAICreditCheck(request, mediaIds.length);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Fetch all requested media items and verify ownership
    const { data: mediaItems, error: fetchError } = await supabaseAdmin
      .from('media_gallery')
      .select('id, media_url, media_type, client_id, clients(user_id)')
      .in('id', mediaIds);

    if (fetchError) {
      logger.error('Error fetching media items for analysis:', fetchError);
      return NextResponse.json({ success: false, error: 'Failed to fetch media items' }, { status: 500 });
    }

    // Filter to only items owned by this user and that are images
    const ownedImageItems = (mediaItems || []).filter((m) => {
      const clientUserId = Array.isArray(m.clients)
        ? m.clients[0]?.user_id
        : (m.clients as { user_id?: string } | null)?.user_id;
      return clientUserId === user.id && m.media_type === 'image';
    });

    if (ownedImageItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No accessible image items found' },
        { status: 404 }
      );
    }

    const results: Array<{ id: string; ai_analysis_status: string }> = [];

    for (const media of ownedImageItems) {
      // Mark as analyzing
      await supabaseAdmin
        .from('media_gallery')
        .update({ ai_analysis_status: 'analyzing' })
        .eq('id', media.id);

      try {
        // Fetch image and convert to base64
        const imageResponse = await fetch(media.media_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Call GPT-4o vision
        const completion = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: AI_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${contentType};base64,${base64}` },
                },
                {
                  type: 'text',
                  text: 'Analyze this image and return the structured JSON metadata.',
                },
              ],
            },
          ],
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';
        const aiData = JSON.parse(rawContent) as {
          description?: string;
          tags?: string[];
          categories?: string[];
          mood?: string;
          setting?: string;
          subjects?: unknown[];
        };

        await supabaseAdmin
          .from('media_gallery')
          .update({
            ai_description: aiData.description ?? null,
            ai_tags: aiData.tags ?? [],
            ai_categories: aiData.categories ?? [],
            ai_mood: aiData.mood ?? null,
            ai_setting: aiData.setting ?? null,
            ai_subjects: aiData.subjects ?? [],
            ai_analysis_status: 'complete',
            ai_analysis_error: null,
          })
          .eq('id', media.id);

        await trackAICreditUsage(user.id, 1, 'analyze_media', media.client_id);

        results.push({ id: media.id, ai_analysis_status: 'complete' });
      } catch (analysisError) {
        const errorMessage =
          analysisError instanceof Error ? analysisError.message : 'Analysis failed';
        logger.error(`AI analysis failed for media ${media.id}:`, analysisError);

        await supabaseAdmin
          .from('media_gallery')
          .update({
            ai_analysis_status: 'failed',
            ai_analysis_error: errorMessage,
          })
          .eq('id', media.id);

        results.push({ id: media.id, ai_analysis_status: 'failed' });
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: results.filter((r) => r.ai_analysis_status === 'complete').length,
      results,
    });
  } catch (error) {
    logger.error('POST /api/media-gallery/analyze error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
