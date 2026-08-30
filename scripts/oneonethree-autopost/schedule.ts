import type { ScheduledSlot } from "./types.js";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DEFAULT_PREFERRED_DAYS = ["tuesday", "thursday", "saturday"];
const DEFAULT_PREFERRED_TIMES = ["09:00"];

function todayInTimezone(timezone: string): string {
  // en-CA gives YYYY-MM-DD directly.
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Noon UTC avoids DST-related off-by-one shifts when only the date matters.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(dateStr: string): (typeof WEEKDAYS)[number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return WEEKDAYS[date.getUTCDay()];
}

/**
 * Picks `count` future dates matching the client's preferred posting days,
 * skipping any date that already has a post scheduled for this client.
 * Times cycle through preferred_times in order.
 */
export function computeSlots(params: {
  count: number;
  timezone: string;
  preferredDays?: string[] | null;
  preferredTimes?: string[] | null;
  alreadyScheduledDates: Set<string>;
}): ScheduledSlot[] {
  const preferredDays = (
    params.preferredDays?.length ? params.preferredDays : DEFAULT_PREFERRED_DAYS
  ).map((d) => d.toLowerCase());
  const preferredTimes = params.preferredTimes?.length
    ? params.preferredTimes
    : DEFAULT_PREFERRED_TIMES;

  const usedDates = new Set(params.alreadyScheduledDates);
  const slots: ScheduledSlot[] = [];

  let cursor = addDays(todayInTimezone(params.timezone), 1); // start tomorrow
  let safetyLimit = 365; // never scan more than a year out

  while (slots.length < params.count && safetyLimit-- > 0) {
    if (preferredDays.includes(weekdayOf(cursor)) && !usedDates.has(cursor)) {
      slots.push({
        scheduled_date: cursor,
        scheduled_time: preferredTimes[slots.length % preferredTimes.length],
      });
      usedDates.add(cursor);
    }
    cursor = addDays(cursor, 1);
  }

  return slots;
}
