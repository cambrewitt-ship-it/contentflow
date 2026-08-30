import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createClient } from "@supabase/supabase-js";
import { Langfuse } from "langfuse";
import OpenAI from "openai";
import type { GeneratedPost, RunLog, RunLogPostEntry } from "./types.js";
import { computeSlots } from "./schedule.js";
import { nextPostNumber, writeVaultPost, writeRunLog } from "./vault.js";
import { generateImage, uploadImageToMediaBucket, insertMediaGalleryRow } from "./image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const VAULT_PATH = process.env.ONEONETHREE_VAULT_PATH || "/Users/cambrewitt/oneonethree-content";
const CLIENT_ID = process.env.ONEONETHREE_CLIENT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_TURNS = 40;
const MAX_BUDGET_USD = 2;

function parseCount(): number {
  const arg = process.argv.find((a) => a.startsWith("--count="));
  const n = arg ? Number(arg.split("=")[1]) : 5;
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw new Error(`--count must be an integer between 1 and 20 (got ${arg ?? "default 5"})`);
  }
  return n;
}

const POSTS_SCHEMA = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signal: { type: "string" },
          platform: { type: "string", enum: ["linkedin"] },
          format: {
            type: "string",
            enum: [
              "horror-story",
              "workflow-teardown",
              "category-take",
              "value-post",
              "shipped",
              "behind-the-build",
            ],
          },
          hook: { type: "string" },
          body: { type: "string" },
          cta: { type: ["string", "null"] },
          why_this_works: { type: "string" },
          image_prompt: { type: "string" },
        },
        required: [
          "signal",
          "platform",
          "format",
          "hook",
          "body",
          "cta",
          "why_this_works",
          "image_prompt",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
} as const;

async function generatePosts(
  count: number,
  langfuse: Langfuse | null
): Promise<{
  posts: GeneratedPost[];
  error: string | null;
  sessionId: string | null;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  traceId: string | null;
}> {
  const trace = langfuse?.trace({
    name: "oneonethree-autopost",
    input: { count, vaultPath: VAULT_PATH },
    metadata: { clientId: CLIENT_ID },
  });
  const generation = trace?.generation({
    name: "agent-sdk-generate-posts",
    model: "claude-sonnet-5",
    input: { count },
  });

  const prompt = `Use the social-post skill to generate ${count} new LinkedIn post drafts for OneOneThree Digital.

Each post must be grounded in a distinct signal entry per the skill's signal rule. Check posts/ first for
signals that have already been used so this batch doesn't repeat them, unless there genuinely aren't enough
unused signals left. Follow the format weights in formats/formats.md across the batch as closely as the
available signals allow.

In addition to the skill's own Output Schema, add one field the skill itself doesn't define: "image_prompt" —
a concrete, literal description of a single scene or moment that illustrates the same signal the post is
grounded in (not an abstract restatement of the post's theme, e.g. not "a graph showing overspend" for a
budget-pacing story — describe the actual physical scene: a specific object, action, or moment). One or two
sentences. Do not describe a screen, dashboard, app UI, spreadsheet, or any surface with text meant to be
read — image models render on-screen text as garbled nonsense, so lean on physical, tangible details instead
(hands, objects, posture, environment) rather than "someone looking at a screen showing X". There is no
visual brand guide for OneOneThree Digital yet (only voice/text has been established) — do not invent brand
colors, logos, or a specific visual style; describe subject matter and mood only, and leave style entirely to
the renderer's own neutral defaults.

Return your final answer as a single JSON object: { "posts": [ ... ] } where each item matches the skill's
Output Schema (SKILL.md section 6) plus the "image_prompt" field described above. If there are fewer than
${count} usable, not-yet-used signals, generate as many as you honestly can and explain why in your final
text — do not invent a signal to hit the count.`;

  const startedAt = Date.now();
  let sessionId: string | null = null;
  let costUsd: number | null = null;
  let durationMs: number | null = null;
  let numTurns: number | null = null;
  let posts: GeneratedPost[] = [];
  let error: string | null = null;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: VAULT_PATH,
        settingSources: ["project"],
        skills: ["social-post"],
        allowedTools: ["Read", "Glob", "Grep"],
        permissionMode: "dontAsk",
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        outputFormat: { type: "json_schema", schema: POSTS_SCHEMA },
      },
    })) {
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
        console.log(`[agent] session ${message.session_id} — skills loaded: ${message.skills.join(", ") || "(none)"}`);
      } else if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            console.log(`[agent] tool_use: ${block.name}`);
          }
        }
      } else if (message.type === "result") {
        sessionId = message.session_id;
        durationMs = message.duration_ms;
        if (message.subtype === "success") {
          costUsd = message.total_cost_usd;
          numTurns = message.num_turns;
          const structured = message.structured_output as { posts?: GeneratedPost[] } | undefined;
          if (structured?.posts?.length) {
            posts = structured.posts;
          } else {
            error = "Agent SDK returned success but no structured_output.posts — check outputFormat handling.";
          }
        } else {
          error = `Agent SDK query failed: subtype=${message.subtype}`;
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  generation?.end({
    output: { posts, error },
    usage: costUsd !== null ? { totalCost: costUsd } : undefined,
    metadata: { sessionId, durationMs, numTurns },
    level: error ? "ERROR" : "DEFAULT",
    statusMessage: error ?? undefined,
  });
  trace?.update({ output: { postCount: posts.length, error } });
  await langfuse?.flushAsync();

  return {
    posts,
    error,
    sessionId,
    costUsd,
    durationMs: durationMs ?? Date.now() - startedAt,
    numTurns,
    traceId: trace?.id ?? null,
  };
}

async function main() {
  if (!CLIENT_ID) throw new Error("ONEONETHREE_CLIENT_ID is not set (check .env.local)");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (check .env.local)");
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (check .env.local)");
  }

  const count = parseCount();
  const startedAt = new Date().toISOString();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const langfuse =
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
      ? new Langfuse({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_HOST,
        })
      : null;
  if (!langfuse) {
    console.log("[langfuse] LANGFUSE_PUBLIC_KEY/SECRET_KEY not set — running without tracing.");
  }

  console.log(`[run] generating ${count} post(s) from ${VAULT_PATH}`);
  const gen = await generatePosts(count, langfuse);

  if (gen.error || gen.posts.length === 0) {
    const log: RunLog = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      vault_path: VAULT_PATH,
      client_id: CLIENT_ID,
      requested_count: count,
      generated_count: 0,
      langfuse_trace_id: gen.traceId,
      agent_sdk: {
        session_id: gen.sessionId,
        cost_usd: gen.costUsd,
        duration_ms: gen.durationMs,
        num_turns: gen.numTurns,
      },
      posts: [],
      generation_error: gen.error ?? "No posts generated.",
    };
    await writeRunLog(VAULT_PATH, log);
    throw new Error(gen.error ?? "No posts generated.");
  }

  console.log(`[run] generated ${gen.posts.length} post(s), cost $${gen.costUsd?.toFixed(4) ?? "?"}`);

  // Client cadence + collision avoidance: pull posting_preferences and any
  // already-scheduled future dates so this batch doesn't double-book a slot.
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("user_id, timezone, posting_preferences")
    .eq("id", CLIENT_ID)
    .single();
  if (clientErr || !client) {
    throw new Error(`Failed to load client ${CLIENT_ID}: ${clientErr?.message}`);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: existing, error: existingErr } = await supabase
    .from("calendar_scheduled_posts")
    .select("scheduled_date")
    .eq("client_id", CLIENT_ID)
    .gte("scheduled_date", todayIso);
  if (existingErr) {
    throw new Error(`Failed to load existing scheduled posts: ${existingErr.message}`);
  }

  const slots = computeSlots({
    count: gen.posts.length,
    timezone: client.timezone || "Pacific/Auckland",
    preferredDays: client.posting_preferences?.preferred_days ?? null,
    preferredTimes: client.posting_preferences?.preferred_times ?? null,
    alreadyScheduledDates: new Set((existing ?? []).map((r) => r.scheduled_date)),
  });

  const postNumberStart = await nextPostNumber(VAULT_PATH);
  const logEntries: RunLogPostEntry[] = [];
  let imageCostTotal = 0;

  for (let i = 0; i < gen.posts.length; i++) {
    const post = gen.posts[i];
    const slot = slots[i];
    const vaultFile = await writeVaultPost(VAULT_PATH, postNumberStart + i, post);
    const postNumber = postNumberStart + i;

    // Image generation/upload/gallery-insert is best-effort and non-fatal —
    // a failure here still leaves a usable text draft, just without an image.
    let imageUrl: string | null = null;
    let mediaGalleryId: string | null = null;
    let imageError: string | null = null;
    try {
      const image = await generateImage(openai, post.image_prompt);
      imageCostTotal += image.costUsd ?? 0;
      const filename = `${String(postNumber).padStart(3, "0")}-${Date.now()}.png`;
      imageUrl = await uploadImageToMediaBucket(supabase, image.buffer, filename);
      if (client.user_id) {
        mediaGalleryId = await insertMediaGalleryRow(supabase, {
          clientId: CLIENT_ID,
          userId: client.user_id,
          mediaUrl: imageUrl,
          fileName: filename,
          imagePrompt: post.image_prompt,
        });
      }
      console.log(`[image] ${vaultFile} -> ${imageUrl}`);
    } catch (err) {
      imageError = err instanceof Error ? err.message : String(err);
      console.error(`[image] failed for ${vaultFile}: ${imageError}`);
    }

    let insertedId: string | null = null;
    let insertError: string | null = null;
    if (slot) {
      const { data: inserted, error: insertErr } = await supabase
        .from("calendar_scheduled_posts")
        .insert({
          client_id: CLIENT_ID,
          caption: post.body,
          image_url: imageUrl,
          media_gallery_id: mediaGalleryId,
          scheduled_date: slot.scheduled_date,
          scheduled_time: slot.scheduled_time,
          post_notes: `[auto-generated] format: ${post.format} | signal: ${post.signal}${
            post.cta ? ` | cta: ${post.cta}` : ""
          }`,
          ai_reasoning: post.why_this_works,
        })
        .select("id")
        .single();
      if (insertErr) {
        insertError = insertErr.message;
        console.error(`[insert] failed for ${vaultFile}: ${insertErr.message}`);
      } else {
        insertedId = inserted.id;
        console.log(`[insert] ${vaultFile} -> calendar_scheduled_posts ${inserted.id} on ${slot.scheduled_date} ${slot.scheduled_time}`);
      }
    } else {
      insertError = "No available slot computed for this post.";
      console.error(`[insert] skipped ${vaultFile}: no slot`);
    }

    logEntries.push({
      vault_file: vaultFile,
      signal: post.signal,
      format: post.format,
      scheduled_date: slot?.scheduled_date ?? "",
      scheduled_time: slot?.scheduled_time ?? "",
      calendar_scheduled_posts_id: insertedId,
      insert_error: insertError,
      image_prompt: post.image_prompt,
      image_url: imageUrl,
      media_gallery_id: mediaGalleryId,
      image_error: imageError,
    });
  }

  console.log(`[run] image generation cost: ~$${imageCostTotal.toFixed(4)} (estimate, not billing-accurate)`);

  const log: RunLog = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    vault_path: VAULT_PATH,
    client_id: CLIENT_ID,
    requested_count: count,
    generated_count: gen.posts.length,
    langfuse_trace_id: gen.traceId,
    agent_sdk: {
      session_id: gen.sessionId,
      cost_usd: gen.costUsd,
      duration_ms: gen.durationMs,
      num_turns: gen.numTurns,
    },
    posts: logEntries,
    generation_error: null,
  };
  const runLogPath = await writeRunLog(VAULT_PATH, log);

  const failures = logEntries.filter((e) => e.insert_error);
  console.log(`[run] done. ${logEntries.length - failures.length}/${logEntries.length} inserted. Log: ${runLogPath}`);
  if (failures.length) {
    console.log(`[run] ${failures.length} post(s) saved to vault but NOT inserted — see run log for errors.`);
  }
}

main().catch((err) => {
  console.error("[run] fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
