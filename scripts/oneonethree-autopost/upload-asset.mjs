#!/usr/bin/env node
// Uploads a local logo or screenshot file to Supabase storage and records it
// in asset-library.json so publish.ts can find it by key.
//
// Usage:
//   node --env-file=../../.env.local upload-asset.mjs --file=/path/to/logo.png --type=logo --key=planpulse
//   node --env-file=../../.env.local upload-asset.mjs --file=/path/to/shot.png --type=screenshot --key="planpulse: health-score dashboard"
//
// `key` for screenshots must exactly match the slug used in posts/*.json.md's
// "screenshot: <slug>" visual strings (see brand/visual-system.md).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = path.join(__dirname, "asset-library.json");

function arg(name) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
}

const filePath = arg("file");
const type = arg("type"); // "logo" | "screenshot"
const key = arg("key");

if (!filePath || !type || !key) {
  console.error("Usage: upload-asset.mjs --file=<path> --type=logo|screenshot --key=<name or slug>");
  process.exit(1);
}
if (type !== "logo" && type !== "screenshot") {
  console.error('--type must be "logo" or "screenshot"');
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const buffer = await fs.readFile(filePath);
const ext = path.extname(filePath) || ".png";
const safeKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const storagePath = `uploads/oneonethree-assets/${type}s/${safeKey}${ext}`;

const contentType = ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

const { error: uploadError } = await supabase.storage
  .from("media")
  .upload(storagePath, buffer, { contentType, upsert: true });
if (uploadError) {
  console.error(`Upload failed: ${uploadError.message}`);
  process.exit(1);
}

const { data: urlData } = supabase.storage.from("media").getPublicUrl(storagePath);

const library = JSON.parse(await fs.readFile(LIBRARY_PATH, "utf-8"));
library[`${type}s`][key] = urlData.publicUrl;
await fs.writeFile(LIBRARY_PATH, JSON.stringify(library, null, 2) + "\n", "utf-8");

console.log(`Uploaded and registered: ${type} "${key}" -> ${urlData.publicUrl}`);
