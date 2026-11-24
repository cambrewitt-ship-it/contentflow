import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { isProductSocialPost } from "./product-types.js";

// Pushes rendered carousels (render-local.ts output, .jpg or .png slides) into ContentFlow's
// calendar through the ingest endpoint, using only INGEST_API_TOKEN -- no
// Supabase or OpenAI keys -- so it runs from a cloud session. Nothing is
// published: each post lands in the calendar for Cam to review and post.
//
//   CONTENTFLOW_URL=https://... INGEST_API_TOKEN=... PLANPULSE_CLIENT_ID=... \
//   npx tsx push.ts --rendered=<dir> --schedule=<schedule.json> [--vault=<dir>] [--dry-run]
//
// schedule.json: { "timezone": "Pacific/Auckland", "posts": [ { "file": "109", "date": "2026-11-02", "time": "12:30" }, ... ] }

function arg(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = hit ? hit.slice(name.length + 3) : fallback;
  if (value === undefined) throw new Error(`--${name} is required`);
  return value;
}

const DRY_RUN = process.argv.includes("--dry-run");
const VAULT = arg("vault", process.env.ONEONETHREE_VAULT_PATH || "/Users/cambrewitt/oneonethree-content");
const RENDERED = arg("rendered");
const SCHEDULE = arg("schedule");
const BASE_URL = (process.env.CONTENTFLOW_URL || "").replace(/\/$/, "");
const TOKEN = process.env.INGEST_API_TOKEN;
const CLIENT_ID = process.env.PLANPULSE_CLIENT_ID;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

interface ScheduleFile {
  timezone?: string;
  posts: { file: string; date: string; time: string; hypothesis?: string }[];
}

async function call(route: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// JPEG at high quality keeps each slide well under the endpoint's 3MB cap.
async function toUploadable(png: Buffer): Promise<Buffer> {
  for (const quality of [92, 85, 78]) {
    const jpg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpg.length <= MAX_UPLOAD_BYTES) return jpg;
  }
  throw new Error("slide too large even at JPEG quality 78");
}

async function main() {
  if (!DRY_RUN && (!BASE_URL || !TOKEN || !CLIENT_ID)) {
    throw new Error("CONTENTFLOW_URL, INGEST_API_TOKEN and PLANPULSE_CLIENT_ID must be set");
  }
  const schedule = JSON.parse(await fs.readFile(SCHEDULE, "utf-8")) as ScheduleFile;

  for (const entry of schedule.posts) {
    const n = entry.file.padStart(3, "0");
    const post = JSON.parse(await fs.readFile(path.join(VAULT, "posts", `${n}.json.md`), "utf-8"));
    if (!isProductSocialPost(post) || post.format !== "tiktok-carousel") throw new Error(`${n} is not a carousel`);

    const dir = path.join(RENDERED, n);
    const slides = (await fs.readdir(dir)).filter((f) => /^slide-\d+\.(png|jpg)$/.test(f)).sort();
    if (slides.length !== post.slides.length) throw new Error(`${n}: found ${slides.length} rendered slides, draft has ${post.slides.length}`);

    if (DRY_RUN) {
      console.log(`[dry-run] ${n}: ${slides.length} slides -> ${entry.date} ${entry.time}`);
      continue;
    }

    const mediaUrls: string[] = [];
    for (const slide of slides) {
      const raw = await fs.readFile(path.join(dir, slide));
      const jpg = slide.endsWith(".jpg") && raw.length <= MAX_UPLOAD_BYTES ? raw : await toUploadable(raw);
      const { url } = await call("/api/ingest/media", {
        client_id: CLIENT_ID,
        content_type: "image/jpeg",
        data_base64: jpg.toString("base64"),
        filename: `${n}-${slide.replace(/\.(png|jpg)$/, "")}`,
      });
      mediaUrls.push(url);
    }

    const result = await call("/api/ingest/scheduled-posts", {
      client_id: CLIENT_ID,
      caption: post.caption,
      media_urls: mediaUrls,
      target_platforms: ["tiktok"],
      scheduled_date: entry.date,
      scheduled_time: entry.time,
      post_notes: `format: tiktok-carousel | signal: ${post.signal}${entry.hypothesis ? ` | test: ${entry.hypothesis}` : ""}${post.cta ? ` | cta: ${post.cta}` : ""}`.slice(0, 3900),
      ai_reasoning: post.why_this_works,
      external_id: `oneonethree-content/posts/${n}.json.md`,
    });
    console.log(`[push] ${n} -> calendar_scheduled_posts ${result.id}${result.duplicate ? " (already there)" : ""} on ${entry.date} ${entry.time}`);
  }
}

main().catch((err) => {
  console.error("[push] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
