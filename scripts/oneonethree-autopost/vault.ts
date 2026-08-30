import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedPost, RunLog } from "./types.js";

const POST_FILE_RE = /^(\d{3})\.json\.md$/;

export async function nextPostNumber(vaultPath: string): Promise<number> {
  const postsDir = path.join(vaultPath, "posts");
  const files = await fs.readdir(postsDir).catch(() => [] as string[]);
  const max = files.reduce((highest, file) => {
    const match = POST_FILE_RE.exec(file);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return max + 1;
}

export async function writeVaultPost(
  vaultPath: string,
  number: number,
  post: GeneratedPost
): Promise<string> {
  // image_prompt is a run.ts-only extension, not part of the skill's Output
  // Schema (SKILL.md section 6) — keep the vault's own file format pure.
  const { image_prompt: _imagePrompt, ...vaultShape } = post;
  const filename = `${String(number).padStart(3, "0")}.json.md`;
  const filePath = path.join(vaultPath, "posts", filename);
  await fs.writeFile(filePath, JSON.stringify(vaultShape, null, 2) + "\n", "utf-8");
  return path.join("posts", filename);
}

export async function writeRunLog(vaultPath: string, log: RunLog): Promise<string> {
  const filename = `${log.started_at.replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(vaultPath, "runs", filename);
  await fs.writeFile(filePath, JSON.stringify(log, null, 2) + "\n", "utf-8");
  return path.join("runs", filename);
}
