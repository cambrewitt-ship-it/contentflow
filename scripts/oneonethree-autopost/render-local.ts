import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { compositeTikTokSlide, compositeTikTokScreenshotSlide } from "./render-card.js";
import { isProductSocialPost } from "./product-types.js";

// Renders tiktok-native carousel drafts to finished PNGs without any API keys,
// so a cloud session can produce slides and hand them to the ingest endpoint
// (push.ts). Photo backgrounds are supplied as files (generated elsewhere, e.g.
// Higgsfield or gpt-image-1) named <NNN>-s<slide>.<png|jpg|jpeg|webp>; real
// screenshots are resolved from the slug list in the vault's products file.
//
//   npx tsx render-local.ts --files=109,110 --photos=<dir> --out=<dir> \
//     [--vault=<oneonethree-content>] [--screenshots=<planpulse>/public]

function arg(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = hit ? hit.slice(name.length + 3) : fallback;
  if (value === undefined) throw new Error(`--${name} is required`);
  return value;
}

const VAULT = arg("vault", process.env.ONEONETHREE_VAULT_PATH || "/Users/cambrewitt/oneonethree-content");
const SCREENSHOTS = arg("screenshots", path.join(path.dirname(VAULT), "planpulse", "public"));
const PHOTOS = arg("photos");
const OUT = arg("out");
const FILES = arg("files")
  .split(",")
  .map((n) => n.trim().padStart(3, "0"));

async function screenshotSlugs(): Promise<Map<string, string>> {
  const md = await fs.readFile(path.join(VAULT, "products", "planpulse.md"), "utf-8");
  const map = new Map<string, string>();
  for (const m of md.matchAll(/`(planpulse: [^`]+)` \(([^)]+?\.png)/g)) map.set(m[1].trim(), m[2].trim());
  return map;
}

async function findPhoto(post: string, slide: number): Promise<Buffer> {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    try {
      return await fs.readFile(path.join(PHOTOS, `${post}-s${slide}.${ext}`));
    } catch {}
  }
  throw new Error(`no photo for ${post} slide ${slide} in ${PHOTOS}`);
}

async function main() {
  const slugs = await screenshotSlugs();
  for (const n of FILES) {
    const raw = await fs.readFile(path.join(VAULT, "posts", `${n}.json.md`), "utf-8");
    const post = JSON.parse(raw);
    if (!isProductSocialPost(post) || post.format !== "tiktok-carousel" || post.render_style !== "tiktok-native") {
      console.log(`[skip] ${n}: not a tiktok-native carousel`);
      continue;
    }
    const dir = path.join(OUT, n);
    await fs.mkdir(dir, { recursive: true });
    for (let i = 0; i < post.slides.length; i++) {
      const { text, visual } = post.slides[i];
      let png: Buffer;
      if (visual.startsWith("screenshot:")) {
        const slug = visual.slice("screenshot:".length).trim();
        const file = slugs.get(slug);
        if (!file) throw new Error(`${n} slide ${i + 1}: unknown screenshot slug "${slug}"`);
        png = await compositeTikTokScreenshotSlide(await fs.readFile(path.join(SCREENSHOTS, file)), text);
      } else {
        png = await compositeTikTokSlide(await findPhoto(n, i + 1), text);
      }
      // JPEG keeps a week of slides small enough to commit to the vault.
      const name = `slide-${String(i + 1).padStart(2, "0")}.jpg`;
      await fs.writeFile(path.join(dir, name), await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer());
    }
    console.log(`[render] ${n}: ${post.slides.length} slides -> ${dir}`);
  }
}

main().catch((err) => {
  console.error("[render-local] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
