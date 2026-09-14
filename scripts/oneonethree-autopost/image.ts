import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "media";
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE_LANDSCAPE = "1536x1024"; // closest GPT-image size to a LinkedIn feed image
const IMAGE_SIZE_PORTRAIT = "1024x1536"; // closest GPT-image size to a TikTok carousel slide
const IMAGE_QUALITY = "medium";

// No visual brand guide exists for OneOneThree/LinkedIn (voice/text only so
// far) — these guardrails keep generated images brand-neutral rather than
// guessing at colors, logos, or a style that hasn't actually been decided.
// Revisit once that interview happens. PlanPulse and Content Manager DO have
// established visual identities (products/planpulse.md, products/content-
// manager.md) — see PRODUCT_STYLE_GUARDRAILS in render-card.ts for those,
// used for carousel/ad photo backgrounds instead of this one.
const LINKEDIN_STYLE_GUARDRAILS = `Style: clean, natural editorial photography or simple flat illustration — whichever
suits the subject. No invented logos or brand marks. No on-image text, captions, or typography of any kind.
No specific color palette claims (no established brand colors exist yet). Avoid generic stock-photo cliches
(handshakes, laptop-in-a-cafe, glowing abstract data visualizations). Do not depict any screen, dashboard,
app UI, spreadsheet, or document with legible content — image models render on-screen text as garbled
nonsense, which looks broken. If a screen appears at all, keep it out of focus, angled away, or reduced to
an unreadable glow — the scene should not depend on reading anything off it. Prefer tangible physical
details instead: hands, objects, expressions, posture, environment. Render the concrete, specific scene
described below plainly and believably.`;

export interface GeneratedImage {
  buffer: Buffer;
  contentType: "image/png";
  costUsd: number | null;
}

// gpt-image-1 doesn't return a cost field directly; this is a rough estimate
// from published per-image pricing at medium quality, for run-log visibility
// only — not billing-accurate.
const APPROX_COST_USD = 0.07;

export async function generateImage(openai: OpenAI, imagePrompt: string): Promise<GeneratedImage> {
  return generateStyledImage(openai, imagePrompt, LINKEDIN_STYLE_GUARDRAILS, "landscape");
}

export async function generateStyledImage(
  openai: OpenAI,
  imagePrompt: string,
  styleGuardrails: string,
  orientation: "landscape" | "portrait" = "landscape"
): Promise<GeneratedImage> {
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: `${styleGuardrails}\n\nScene: ${imagePrompt}`,
    size: orientation === "portrait" ? IMAGE_SIZE_PORTRAIT : IMAGE_SIZE_LANDSCAPE,
    quality: IMAGE_QUALITY,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response had no b64_json data.");
  }

  return {
    buffer: Buffer.from(b64, "base64"),
    contentType: "image/png",
    costUsd: APPROX_COST_USD,
  };
}

export async function uploadImageToMediaBucket(
  supabase: SupabaseClient,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const storagePath = `uploads/oneonethree-autopost/${filename}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function insertMediaGalleryRow(
  supabase: SupabaseClient,
  params: {
    clientId: string;
    userId: string;
    mediaUrl: string;
    fileName: string;
    imagePrompt: string;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from("media_gallery")
    .insert({
      client_id: params.clientId,
      user_id: params.userId,
      media_url: params.mediaUrl,
      media_type: "image",
      file_name: params.fileName,
      ai_description: params.imagePrompt,
      ai_analysis_status: "complete",
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`media_gallery insert failed: ${error.message}`);
  }
  return data.id;
}
