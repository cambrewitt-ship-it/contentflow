/**
 * Email-safe preview images for post media (server only).
 *
 * Email clients can't play video or show data: URLs, and many (Gmail) ignore
 * object-fit, so a tall image gets squashed. So we make a square JPEG for every
 * post: a frame grabbed with ffmpeg (with a play button) for videos, a resized
 * copy for photos. It's stored in the Supabase `media` bucket under a path
 * derived from the source URL, so each file is only processed once.
 */
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import logger from '@/lib/logger';
import { isVideoUrl } from '@/lib/videoUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const BUCKET = 'media';
const THUMB_SIZE = 600; // square, px
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const FFMPEG_TIMEOUT_MS = 20_000;

export interface EmailMediaPreview {
  /** Public https image URL safe to put in an <img>, or null if none could be made. */
  imageUrl: string | null;
  isVideo: boolean;
}

/** Grab one JPEG frame from a (remote) video at `seconds` in. */
function extractFrame(videoUrl: string, seconds: number): Promise<Buffer | null> {
  return new Promise(resolve => {
    if (!ffmpegPath) return resolve(null);

    const proc = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', String(seconds),
      '-i', videoUrl,
      '-frames:v', '1',
      '-vf', `scale=${THUMB_SIZE * 2}:-2`,
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let stderr = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), FFMPEG_TIMEOUT_MS);

    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    proc.on('error', err => {
      clearTimeout(timer);
      logger.warn('ffmpeg failed to start', { message: err.message });
      resolve(null);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      if (code !== 0 || out.length === 0) {
        if (stderr) logger.warn('ffmpeg frame extraction failed', { code, stderr: stderr.slice(0, 500) });
        return resolve(null);
      }
      resolve(out);
    });
  });
}

/** Square crop, plus a centred play button for videos. */
async function toEmailThumbnail(source: Buffer, isVideo: boolean): Promise<Buffer> {
  const square = sharp(source).rotate().resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'attention' });
  if (!isVideo) return square.jpeg({ quality: 80 }).toBuffer();

  const c = THUMB_SIZE / 2;
  const r = Math.round(THUMB_SIZE * 0.12);
  const t = r * 0.45;
  const svg = `
<svg width="${THUMB_SIZE}" height="${THUMB_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${c}" cy="${c}" r="${r}" fill="rgba(0,0,0,0.55)" />
  <polygon points="${c - t * 0.6},${c - t} ${c - t * 0.6},${c + t} ${c + t},${c}" fill="#ffffff" />
</svg>`;
  const base = await square.jpeg().toBuffer();
  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FFMPEG_TIMEOUT_MS) });
  if (!res.ok) return null;
  const size = Number(res.headers.get('content-length') ?? 0);
  if (size > MAX_SOURCE_IMAGE_BYTES) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function getEmailThumbnailUrl(mediaUrl: string, isVideo: boolean): Promise<string | null> {
  const path = `email-thumbnails/${createHash('sha1').update(mediaUrl).digest('hex')}.jpg`;
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Already made for an earlier email?
  try {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) return publicUrl;
  } catch {
    // fall through and generate it
  }

  // For video, 1s in skips black fade-ins; very short clips fall back to the first frame
  const source = isVideo
    ? (await extractFrame(mediaUrl, 1)) ?? (await extractFrame(mediaUrl, 0))
    : await fetchImage(mediaUrl);
  if (!source) return null;

  const thumbnail = await toEmailThumbnail(source, isVideo);
  const { error } = await supabase.storage.from(BUCKET).upload(path, thumbnail, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    logger.warn('Failed to store email thumbnail', { message: error.message });
    return null;
  }
  return publicUrl;
}

/** Turn a post's media URL into something an email client can display. */
export async function getEmailMediaPreview(
  mediaUrl: string | null | undefined,
  mimeType?: string | null
): Promise<EmailMediaPreview> {
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    // Missing, or a base64 data: URL — most email clients strip those
    return { imageUrl: null, isVideo: false };
  }

  const isVideo = mimeType ? mimeType.startsWith('video/') : isVideoUrl(mediaUrl);

  try {
    const thumbnailUrl = await getEmailThumbnailUrl(mediaUrl, isVideo);
    // A photo we couldn't process is still worth showing as-is
    return { imageUrl: thumbnailUrl ?? (isVideo ? null : mediaUrl), isVideo };
  } catch (err) {
    logger.warn('Email thumbnail generation failed', { message: err instanceof Error ? err.message : String(err) });
    return { imageUrl: isVideo ? null : mediaUrl, isVideo };
  }
}
