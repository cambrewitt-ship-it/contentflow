import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

/**
 * UTC epoch ms for a wall-clock "YYYY-MM-DDTHH:mm:ss" in an IANA timezone, or NaN if
 * either can't be parsed.
 */
export function zonedLocalToUtcMs(localDateTime: string, timeZone: string): number {
  const asUtc = Date.parse(`${localDateTime}Z`);
  if (Number.isNaN(asUtc)) return NaN;
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(ms).map((p) => [p.type, Number(p.value)])
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - ms;
  };
  try {
    const guess = asUtc - offsetAt(asUtc);
    return asUtc - offsetAt(guess); // second pass settles DST boundaries
  } catch {
    return NaN; // unknown timezone
  }
}

/** "9:05", "09:05" or "09:05:00" → "09:05:00"; null if it isn't a valid time. */
export function normalizeTimeOfDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [hours, minutes, seconds = '00'] = [Number(match[1]), match[2], match[3]];
  if (hours > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
}

export type LateRescheduleResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * When a post's day or time changes, move it in LATE too if it is already scheduled
 * there; otherwise it would still publish at the old time. Call before saving the
 * change, and only save if this returns ok. Posts not scheduled in LATE are a no-op.
 */
export async function syncLateSchedule(
  supabase: SupabaseClient,
  postId: string,
  next: { scheduled_date?: string; scheduled_time?: string }
): Promise<LateRescheduleResult> {
  if (next.scheduled_date === undefined && next.scheduled_time === undefined) return { ok: true };

  const { data: post, error } = await supabase
    .from('calendar_scheduled_posts')
    .select('client_id, scheduled_date, scheduled_time, late_post_id, late_status')
    .eq('id', postId)
    .single();

  if (error || !post) {
    return { ok: false, status: 404, error: 'Post not found' };
  }
  if (!post.late_post_id || post.late_status !== 'scheduled') return { ok: true };

  const date = next.scheduled_date ?? post.scheduled_date;
  const time = next.scheduled_time ?? post.scheduled_time;
  if (!date || !time) return { ok: true };

  const { data: client } = await supabase
    .from('clients')
    .select('timezone')
    .eq('id', post.client_id)
    .single();
  const timezone = client?.timezone || 'Pacific/Auckland';

  // late_status never moves past 'scheduled', so a post whose time has passed has most
  // likely gone out already; leave LATE alone and just update our record as before.
  if (post.scheduled_date && post.scheduled_time) {
    const currentUtcMs = zonedLocalToUtcMs(
      `${post.scheduled_date}T${normalizeTimeOfDay(post.scheduled_time) ?? post.scheduled_time}`,
      timezone
    );
    if (!Number.isNaN(currentUtcMs) && currentUtcMs <= Date.now()) return { ok: true };
  }

  const localDateTime = `${date}T${normalizeTimeOfDay(time) ?? time}`;
  const utcMs = zonedLocalToUtcMs(localDateTime, timezone);
  if (!Number.isNaN(utcMs) && utcMs < Date.now()) {
    return { ok: false, status: 400, error: 'This post is already scheduled. Pick a time in the future.' };
  }

  const response = await fetch(`https://getlate.dev/api/v1/posts/${post.late_post_id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduledFor: localDateTime, timezone }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    logger.error('Failed to reschedule post in LATE', { postId, status: response.status, details });
    return { ok: false, status: 502, error: 'Could not move the scheduled post in the social scheduler. Please try again.' };
  }

  return { ok: true };
}
