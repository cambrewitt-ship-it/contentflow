// Mirrors .claude/skills/product-social/SKILL.md's four output schemas in the
// oneonethree-content vault. Kept as a sibling to types.ts (which mirrors
// social-post/SKILL.md's single LinkedIn schema) rather than merged into it,
// since the two skills never share a shape.

export type Product = "planpulse" | "content-manager";

interface Slide {
  text: string;
  visual: string; // "text-on-background" | "screenshot: <slug>"
}

export interface TikTokCarouselPost {
  signal: string;
  platform: "tiktok";
  format: "tiktok-carousel";
  product: Product;
  slides: Slide[];
  caption: string;
  cta: string | null;
  sources: string[];
  why_this_works: string;
}

export interface SingleProductPost {
  signal: string;
  platform: "instagram" | "facebook";
  format: "single-post";
  product: Product;
  hook: string;
  body: string;
  cta: string | null;
  visual: string;
  sources: string[];
  why_this_works: string;
}

export interface AdStaticPost {
  signal: string;
  platform: "meta-ads";
  format: "ad-static";
  product: Product;
  creative_brief: {
    headline: string;
    subhead?: string | null;
    cta_text: string;
    visual_direction: string;
  };
  caption: string;
  cta: string | null;
  sources: string[];
  why_this_works: string;
}

export interface VideoScriptPost {
  signal: string;
  platform: "video";
  format: "video-script";
  product: Product;
  voiceover_source: "ai" | "cam";
  scenes: Array<{ screen: string; voiceover: string }>;
  cta: string | null;
  sources: string[];
  why_this_works: string;
}

export type ProductSocialPost =
  | TikTokCarouselPost
  | SingleProductPost
  | AdStaticPost
  | VideoScriptPost;

export function isProductSocialPost(obj: unknown): obj is ProductSocialPost {
  if (!obj || typeof obj !== "object") return false;
  const format = (obj as { format?: unknown }).format;
  return (
    format === "tiktok-carousel" ||
    format === "single-post" ||
    format === "ad-static" ||
    format === "video-script"
  );
}
