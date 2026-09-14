import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderSlideCard, renderAdCard, type Product } from "./render-card.js";
import { uploadImageToMediaBucket, insertMediaGalleryRow } from "./image.js";
import { computeSlots } from "./schedule.js";
import { isProductSocialPost, type ProductSocialPost } from "./product-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const VAULT_PATH = process.env.ONEONETHREE_VAULT_PATH || "/Users/cambrewitt/oneonethree-content";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLIENT_IDS: Record<Product, string | undefined> = {
  planpulse: process.env.PLANPULSE_CLIENT_ID,
  "content-manager": process.env.CONTENT_MANAGER_CLIENT_ID,
};

const DRY_RUN = process.argv.includes("--dry-run");
const filesArg = process.argv.find((a) => a.startsWith("--files="));
const explicitFiles = filesArg
  ? filesArg
      .split("=")[1]
      .split(",")
      .map((n) => n.trim().padStart(3, "0"))
  : null;

const LEDGER_PATH = path.join(VAULT_PATH, "runs", "published-ledger.json");
const DRY_RUN_DIR = path.join(__dirname, "dry-run-preview");

// Matches any product-social format value (the field the switch below
// actually dispatches on -- more robust than matching "platform", which one
// vault file has a typo in). Used as a cheap pre-filter so LinkedIn drafts
// (run.ts's job, not this script's) never even reach JSON.parse -- some of
// the vault's earliest files (001-008) contain invalid-JSON artifacts
// (literal unescaped newlines inside string values, stray non-breaking-space
// padding) that would otherwise error on every run, harmlessly but noisily,
// since they'd just get skipped anyway.
const PRODUCT_SOCIAL_FORMAT_RE = /"format"\s*:\s*"(tiktok-carousel|single-post|ad-static|video-script)"/;

// Non-breaking space (U+00A0) -- looks like ordinary whitespace but isn't
// valid JSON whitespace. Some vault files carry it as padding, likely an
// Obsidian/paste artifact. Normalize before parsing.
const NBSP_RE = new RegExp(" ", "g");

interface LedgerEntry {
  vault_file: string;
  calendar_scheduled_posts_id: string | null;
  published_at: string;
  format: string;
  product?: string;
}

async function loadLedger(): Promise<LedgerEntry[]> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf-8");
    return JSON.parse(raw) as LedgerEntry[];
  } catch {
    return [];
  }
}

async function saveLedger(entries: LedgerEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fs.writeFile(LEDGER_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

async function listCandidateFiles(): Promise<string[]> {
  if (explicitFiles) return explicitFiles.map((n) => `${n}.json.md`);
  const postsDir = path.join(VAULT_PATH, "posts");
  const all = await fs.readdir(postsDir);
  return all.filter((f) => /^\d{3}\.json\.md$/.test(f));
}

async function saveDryRunImage(buffer: Buffer, name: string): Promise<string> {
  await fs.mkdir(DRY_RUN_DIR, { recursive: true });
  const filePath = path.join(DRY_RUN_DIR, name);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

interface ClientRow {
  id: string;
  user_id: string | null;
  timezone: string | null;
  posting_preferences: { preferred_days?: string[]; preferred_times?: string[] } | null;
}

const clientCache = new Map<string, ClientRow>();

async function getClient(supabase: SupabaseClient, clientId: string): Promise<ClientRow> {
  if (clientCache.has(clientId)) return clientCache.get(clientId)!;
  const { data, error } = await supabase
    .from("clients")
    .select("id, user_id, timezone, posting_preferences")
    .eq("id", clientId)
    .single();
  if (error || !data) throw new Error(`Failed to load client ${clientId}: ${error?.message}`);
  clientCache.set(clientId, data as ClientRow);
  return data as ClientRow;
}

async function nextSlotForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ scheduled_date: string; scheduled_time: string } | null> {
  const client = await getClient(supabase, clientId);
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: existing, error } = await supabase
    .from("calendar_scheduled_posts")
    .select("scheduled_date")
    .eq("client_id", clientId)
    .gte("scheduled_date", todayIso);
  if (error) throw new Error(`Failed to load existing scheduled posts for ${clientId}: ${error.message}`);

  const slots = computeSlots({
    count: 1,
    timezone: client.timezone || "Pacific/Auckland",
    preferredDays: client.posting_preferences?.preferred_days ?? null,
    preferredTimes: client.posting_preferences?.preferred_times ?? null,
    alreadyScheduledDates: new Set((existing ?? []).map((r) => r.scheduled_date)),
  });
  return slots[0] ?? null;
}

async function uploadOrPreview(
  supabase: SupabaseClient,
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (DRY_RUN) return saveDryRunImage(buffer, filename);
  return uploadImageToMediaBucket(supabase, buffer, filename);
}

async function publishTikTokCarousel(
  supabase: SupabaseClient,
  vaultFile: string,
  post: Extract<ProductSocialPost, { format: "tiktok-carousel" }>
): Promise<LedgerEntry> {
  const clientId = CLIENT_IDS[post.product];
  if (!clientId) {
    console.log(`[skip] ${vaultFile}: no client id configured for product "${post.product}" (set ${post.product === "planpulse" ? "PLANPULSE_CLIENT_ID" : "CONTENT_MANAGER_CLIENT_ID"} in .env.local)`);
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  const mediaUrls: string[] = [];
  for (let i = 0; i < post.slides.length; i++) {
    const slide = post.slides[i];
    const usingRealScreenshot = slide.visual.startsWith("screenshot:");
    if (usingRealScreenshot) {
      console.log(`[note] ${vaultFile} slide ${i + 1}: wanted "${slide.visual}" but no screenshot library exists yet -- rendering as a text card instead.`);
    }
    const buffer = await renderSlideCard({ product: post.product, text: slide.text, eyebrow: `${i + 1}/${post.slides.length}` });
    const filename = `${vaultFile.replace(".json.md", "")}-slide${i + 1}-${Date.now()}.png`;
    const url = await uploadOrPreview(supabase, buffer, filename);
    mediaUrls.push(url);
  }

  if (DRY_RUN) {
    console.log(`[dry-run] ${vaultFile}: would insert carousel with ${mediaUrls.length} slides for client ${clientId}`);
    console.log(mediaUrls.map((u) => `  - ${u}`).join("\n"));
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  const slot = await nextSlotForClient(supabase, clientId);
  const { data: inserted, error } = await supabase
    .from("calendar_scheduled_posts")
    .insert({
      client_id: clientId,
      caption: post.caption,
      image_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
      scheduled_date: slot?.scheduled_date ?? null,
      scheduled_time: slot?.scheduled_time ?? null,
      post_notes: `[auto-published] format: tiktok-carousel | signal: ${post.signal}${post.cta ? ` | cta: ${post.cta}` : ""}`,
      ai_reasoning: post.why_this_works,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed for ${vaultFile}: ${error.message}`);
  console.log(`[insert] ${vaultFile} -> calendar_scheduled_posts ${inserted.id} (${mediaUrls.length} slides)`);
  return { vault_file: vaultFile, calendar_scheduled_posts_id: inserted.id, published_at: new Date().toISOString(), format: post.format, product: post.product };
}

async function publishSinglePost(
  supabase: SupabaseClient,
  vaultFile: string,
  post: Extract<ProductSocialPost, { format: "single-post" }>
): Promise<LedgerEntry> {
  const clientId = CLIENT_IDS[post.product];
  if (!clientId) {
    console.log(`[skip] ${vaultFile}: no client id configured for product "${post.product}"`);
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  const buffer = await renderSlideCard({ product: post.product, text: post.hook });
  const filename = `${vaultFile.replace(".json.md", "")}-${Date.now()}.png`;
  const url = await uploadOrPreview(supabase, buffer, filename);

  if (DRY_RUN) {
    console.log(`[dry-run] ${vaultFile}: would insert single post for client ${clientId} -> ${url}`);
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  let mediaGalleryId: string | null = null;
  const client = await getClient(supabase, clientId);
  if (client.user_id) {
    mediaGalleryId = await insertMediaGalleryRow(supabase, {
      clientId,
      userId: client.user_id,
      mediaUrl: url,
      fileName: filename,
      imagePrompt: post.hook,
    });
  }

  const slot = await nextSlotForClient(supabase, clientId);
  const { data: inserted, error } = await supabase
    .from("calendar_scheduled_posts")
    .insert({
      client_id: clientId,
      caption: post.body,
      image_url: url,
      media_gallery_id: mediaGalleryId,
      scheduled_date: slot?.scheduled_date ?? null,
      scheduled_time: slot?.scheduled_time ?? null,
      post_notes: `[auto-published] format: single-post | signal: ${post.signal}${post.cta ? ` | cta: ${post.cta}` : ""}`,
      ai_reasoning: post.why_this_works,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed for ${vaultFile}: ${error.message}`);
  console.log(`[insert] ${vaultFile} -> calendar_scheduled_posts ${inserted.id}`);
  return { vault_file: vaultFile, calendar_scheduled_posts_id: inserted.id, published_at: new Date().toISOString(), format: post.format, product: post.product };
}

async function publishAdStatic(
  supabase: SupabaseClient,
  vaultFile: string,
  post: Extract<ProductSocialPost, { format: "ad-static" }>
): Promise<LedgerEntry> {
  const clientId = CLIENT_IDS[post.product];
  if (!clientId) {
    console.log(`[skip] ${vaultFile}: no client id configured for product "${post.product}"`);
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  const buffer = await renderAdCard({
    product: post.product,
    headline: post.creative_brief.headline,
    subhead: post.creative_brief.subhead,
    ctaText: post.creative_brief.cta_text,
  });
  const filename = `${vaultFile.replace(".json.md", "")}-ad-${Date.now()}.png`;
  const url = await uploadOrPreview(supabase, buffer, filename);

  if (DRY_RUN) {
    console.log(`[dry-run] ${vaultFile}: would insert ad-static for client ${clientId} -> ${url}`);
    return { vault_file: vaultFile, calendar_scheduled_posts_id: null, published_at: "", format: post.format, product: post.product };
  }

  const slot = await nextSlotForClient(supabase, clientId);
  const { data: inserted, error } = await supabase
    .from("calendar_scheduled_posts")
    .insert({
      client_id: clientId,
      caption: post.caption,
      image_url: url,
      scheduled_date: slot?.scheduled_date ?? null,
      scheduled_time: slot?.scheduled_time ?? null,
      post_notes: `[auto-published][ad-static, not organic] signal: ${post.signal}`,
      ai_reasoning: post.why_this_works,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed for ${vaultFile}: ${error.message}`);
  console.log(`[insert] ${vaultFile} -> calendar_scheduled_posts ${inserted.id} (ad-static)`);
  return { vault_file: vaultFile, calendar_scheduled_posts_id: inserted.id, published_at: new Date().toISOString(), format: post.format, product: post.product };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (check .env.local)");
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const ledger = await loadLedger();
  const alreadyPublished = new Set(ledger.map((e) => e.vault_file));

  const candidateFiles = await listCandidateFiles();
  const toProcess = candidateFiles.filter((f) => explicitFiles || !alreadyPublished.has(f));

  console.log(`[publish] ${DRY_RUN ? "DRY RUN -- " : ""}checking ${candidateFiles.length} file(s), processing ${toProcess.length}`);

  const newEntries: LedgerEntry[] = [];

  for (const file of toProcess) {
    const filePath = path.join(VAULT_PATH, "posts", file);
    const raw = await fs.readFile(filePath, "utf-8");

    if (!PRODUCT_SOCIAL_FORMAT_RE.test(raw)) {
      continue;
    }

    const normalized = raw.replace(NBSP_RE, " ");
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch (err) {
      console.error(`[error] ${file}: could not parse JSON (${err instanceof Error ? err.message : err})`);
      continue;
    }

    if (!isProductSocialPost(parsed)) {
      continue; // LinkedIn posts (platform: "linkedin") are run.ts's job, not this script's.
    }

    try {
      let entry: LedgerEntry;
      switch (parsed.format) {
        case "tiktok-carousel":
          entry = await publishTikTokCarousel(supabase, file, parsed);
          break;
        case "single-post":
          entry = await publishSinglePost(supabase, file, parsed);
          break;
        case "ad-static":
          entry = await publishAdStatic(supabase, file, parsed);
          break;
        case "video-script":
          console.log(`[skip] ${file}: video-script has no image-rendering path yet -- publish this one manually.`);
          entry = { vault_file: file, calendar_scheduled_posts_id: null, published_at: new Date().toISOString(), format: "video-script", product: parsed.product };
          break;
      }
      // Only ledger it (so it's never retried) once it actually succeeded, or
      // it's a format we're deliberately not going to support automatically.
      // A "no client id configured" skip is left un-ledgered so it retries
      // automatically once PLANPULSE_CLIENT_ID / CONTENT_MANAGER_CLIENT_ID is set.
      if (!DRY_RUN && (entry.calendar_scheduled_posts_id || entry.format === "video-script")) {
        newEntries.push(entry);
      }
    } catch (err) {
      console.error(`[error] ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!DRY_RUN && newEntries.length) {
    await saveLedger([...ledger, ...newEntries]);
  }

  console.log(`[publish] done. ${newEntries.filter((e) => e.calendar_scheduled_posts_id).length} inserted, ${newEntries.filter((e) => e.format === "video-script").length} skipped (unsupported format).`);
  if (DRY_RUN) {
    console.log(`[dry-run] preview images written to ${DRY_RUN_DIR}`);
  }
}

main().catch((err) => {
  console.error("[publish] fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
