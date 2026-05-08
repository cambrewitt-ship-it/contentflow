import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

Deno.serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const mediaIds: string[] = body.mediaIds ?? (body.mediaId ? [body.mediaId] : []);
    if (mediaIds.length === 0) {
      return jsonResponse({ success: false, error: 'mediaId or mediaIds is required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: mediaItems, error: fetchError } = await admin
      .from('media_gallery')
      .select('id, media_url, media_type, client_id, clients(user_id)')
      .in('id', mediaIds);

    if (fetchError) {
      return jsonResponse({ success: false, error: 'Failed to fetch media items' }, 500);
    }

    const ownedImageItems = (mediaItems || []).filter((m: { clients: { user_id?: string } | Array<{ user_id?: string }> | null; media_type: string }) => {
      const clientUserId = Array.isArray(m.clients) ? m.clients[0]?.user_id : (m.clients as { user_id?: string } | null)?.user_id;
      return clientUserId === user.id && m.media_type === 'image';
    });

    if (ownedImageItems.length === 0) {
      return jsonResponse({ success: false, error: 'No accessible image items found' }, 404);
    }

    const results: Array<{ id: string; ai_analysis_status: string }> = [];

    for (const media of ownedImageItems) {
      await admin.from('media_gallery').update({ ai_analysis_status: 'analyzing' }).eq('id', media.id);

      try {
        const imageResponse = await fetch(media.media_url);
        if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

        const arrayBuffer = await imageResponse.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const base64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(''));
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
                { type: 'text', text: 'Analyze this image and return the structured JSON metadata.' },
              ],
            },
          ],
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';
        const aiData = JSON.parse(rawContent) as {
          description?: string; tags?: string[]; categories?: string[];
          mood?: string; setting?: string; subjects?: unknown[];
        };

        await admin.from('media_gallery').update({
          ai_description: aiData.description ?? null,
          ai_tags: aiData.tags ?? [],
          ai_categories: aiData.categories ?? [],
          ai_mood: aiData.mood ?? null,
          ai_setting: aiData.setting ?? null,
          ai_subjects: aiData.subjects ?? [],
          ai_analysis_status: 'complete',
          ai_analysis_error: null,
        }).eq('id', media.id);

        results.push({ id: media.id, ai_analysis_status: 'complete' });
      } catch (analysisError) {
        const errorMessage = analysisError instanceof Error ? analysisError.message : 'Analysis failed';
        await admin.from('media_gallery').update({ ai_analysis_status: 'failed', ai_analysis_error: errorMessage }).eq('id', media.id);
        results.push({ id: media.id, ai_analysis_status: 'failed' });
      }
    }

    return jsonResponse({
      success: true,
      analyzed: results.filter(r => r.ai_analysis_status === 'complete').length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('analyze-media error:', message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
