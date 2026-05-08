import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function fetchBrandContext(clientId: string, admin: ReturnType<typeof createClient>) {
  const { data: client } = await admin
    .from('clients')
    .select('name, brand_tone, target_audience, caption_dos, caption_donts')
    .eq('id', clientId)
    .single();
  return client;
}

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
    const { planId, postId, newMediaGalleryId } = body;
    if (!planId || !postId || !newMediaGalleryId) {
      return jsonResponse({ success: false, error: 'planId, postId and newMediaGalleryId are required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify plan ownership
    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, user_id, client_id')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) return jsonResponse({ success: false, error: 'Plan not found' }, 404);
    if (plan.user_id !== user.id) return jsonResponse({ success: false, error: 'Forbidden' }, 403);

    // Fetch the post
    const { data: post } = await admin
      .from('calendar_scheduled_posts')
      .select('id, media_gallery_id, autopilot_plan_id, caption')
      .eq('id', postId)
      .eq('autopilot_plan_id', planId)
      .maybeSingle();

    if (!post) return jsonResponse({ success: false, error: 'Post not found in this plan' }, 404);

    // Fetch new gallery item (verify it belongs to this client)
    const { data: newMedia } = await admin
      .from('media_gallery')
      .select('id, media_url, ai_description, ai_tags, ai_categories, ai_mood, ai_setting, ai_subjects, freshness_score, times_used, user_context, last_used_at, media_type, client_id')
      .eq('id', newMediaGalleryId)
      .eq('client_id', plan.client_id)
      .eq('status', 'available')
      .maybeSingle();

    if (!newMedia) return jsonResponse({ success: false, error: 'Media item not found or not available for this client' }, 404);

    // Fetch brand context
    const client = await fetchBrandContext(plan.client_id, admin);

    // Regenerate caption
    let newCaption = post.caption || '';
    try {
      const prompt = `You are a social media copywriter. Write a single caption for an engagement post on instagram and facebook.

Brand: ${client?.name || 'the business'}
Tone: ${client?.brand_tone || 'engaging and authentic'}
Target audience: ${client?.target_audience || 'general'}
Caption dos: ${client?.caption_dos || 'none'}
Caption don'ts: ${client?.caption_donts || 'none'}

Photo details:
- Description: ${newMedia.ai_description || 'none'}
- Tags: ${(newMedia.ai_tags || []).join(', ')}
- Mood: ${newMedia.ai_mood || 'none'}
- Context: ${newMedia.user_context || 'none'}

Write ONLY the caption text (with hashtags). No explanation.`;

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.8,
      });
      newCaption = completion.choices[0]?.message?.content?.trim() || newCaption;
    } catch (_captionErr) {
      // Keep original caption if regeneration fails
    }

    // Update the post
    const { data: updatedPost, error: updateErr } = await admin
      .from('calendar_scheduled_posts')
      .update({
        caption: newCaption,
        image_url: newMedia.media_url,
        media_gallery_id: newMediaGalleryId,
        autopilot_status: 'pending_approval',
        approval_status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select('*')
      .single();

    if (updateErr || !updatedPost) {
      return jsonResponse({ success: false, error: 'Failed to update post' }, 500);
    }

    // Update gallery usage counts
    const oldMediaId = post.media_gallery_id;
    if (oldMediaId && oldMediaId !== newMediaGalleryId) {
      const { data: oldMedia } = await admin.from('media_gallery').select('times_used, freshness_score').eq('id', oldMediaId).maybeSingle();
      if (oldMedia) {
        await admin.from('media_gallery').update({
          times_used: Math.max(0, (oldMedia.times_used || 0) - 1),
          freshness_score: Math.min(1.0, (oldMedia.freshness_score || 0.8) + 0.2),
        }).eq('id', oldMediaId);
      }
    }

    await admin.from('media_gallery').update({
      times_used: (newMedia.times_used || 0) + 1,
      last_used_at: new Date().toISOString(),
      freshness_score: Math.max(0.1, (newMedia.freshness_score || 1) - 0.2),
    }).eq('id', newMediaGalleryId);

    return jsonResponse({ success: true, post: updatedPost });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('swap-photo-caption error:', message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
