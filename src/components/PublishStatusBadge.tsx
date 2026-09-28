import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { PlatformLogo } from '@/components/PlatformBadges';
import { TARGET_PLATFORM_IDS, TARGET_PLATFORM_LABELS, type TargetPlatform } from '@/lib/targetPlatforms';

export interface PublishStatusPost {
  platforms_scheduled?: string[] | null;
  late_status?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

const EXTRA_LABELS: Record<string, string> = { threads: 'Threads', youtube: 'YouTube', x: 'Twitter/X' };

const isKnownPlatform = (p: string): p is TargetPlatform =>
  (TARGET_PLATFORM_IDS as readonly string[]).includes(p);

const platformLabel = (p: string) =>
  isKnownPlatform(p) ? TARGET_PLATFORM_LABELS[p] : EXTRA_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);

/**
 * Where and when a post was sent to social platforms via LATE.
 * Returns null when the post hasn't been scheduled to any platform.
 * "when" is the post's scheduled date/time, which is what LATE publishes at.
 */
export function getPublishStatus(post: PublishStatusPost) {
  const platforms = Array.from(new Set((post.platforms_scheduled ?? []).map((p) => p.toLowerCase())));
  if (platforms.length === 0) return null;

  const when = post.scheduled_date
    ? new Date(`${post.scheduled_date}T${(post.scheduled_time || '12:00').slice(0, 5)}:00`)
    : null;
  const validWhen = when && !isNaN(when.getTime()) ? when : null;
  const isPosted = post.late_status === 'published' || (!!validWhen && validWhen.getTime() <= Date.now());

  return { platforms, when: validWhen, isPosted };
}

function formatWhen(when: Date, withYear = false) {
  const date = when.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
  const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

function PlatformIcons({ platforms, size }: { platforms: string[]; size: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {platforms.map((p) =>
        isKnownPlatform(p) ? (
          <PlatformLogo key={p} platform={p} size={size} />
        ) : (
          <span key={p} className="px-1.5 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold text-gray-700">
            {platformLabel(p)}
          </span>
        )
      )}
    </span>
  );
}

/**
 * Shows which platforms a post was scheduled/posted to and when.
 * - "bar": compact strip for the top of a calendar card
 * - "panel": fuller block for a post detail modal
 */
export function PublishStatusBadge({ post, variant = 'bar' }: { post: PublishStatusPost; variant?: 'bar' | 'panel' }) {
  const status = getPublishStatus(post);
  if (!status) return null;
  const { platforms, when, isPosted } = status;
  const names = platforms.map(platformLabel).join(', ');

  if (variant === 'bar') {
    return (
      <div
        className={`px-3 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-white ${isPosted ? 'bg-green-500' : 'bg-indigo-500'}`}
        title={`${isPosted ? 'Posted' : 'Scheduled'} to ${names}${when ? ` · ${formatWhen(when, true)}` : ''}`}
      >
        <span className="text-xs font-bold tracking-wide">{isPosted ? 'POSTED' : 'SCHEDULED'}</span>
        <PlatformIcons platforms={platforms} size={16} />
        {when && <span className="text-[11px] font-medium opacity-95">{formatWhen(when)}</span>}
      </div>
    );
  }

  const Icon = isPosted ? CheckCircle2 : CalendarClock;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
        isPosted ? 'border-green-200 bg-green-50' : 'border-indigo-200 bg-indigo-50'
      }`}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isPosted ? 'text-green-600' : 'text-indigo-600'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${isPosted ? 'text-green-800' : 'text-indigo-800'}`}>
          {isPosted ? 'Posted to' : 'Scheduled to post to'} {names}
        </p>
        {when && (
          <p className={`text-xs mt-0.5 ${isPosted ? 'text-green-700' : 'text-indigo-700'}`}>{formatWhen(when, true)}</p>
        )}
      </div>
      <PlatformIcons platforms={platforms} size={22} />
    </div>
  );
}
