'use client';

import { useState } from 'react';
import { Instagram, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// Only http(s) links from model or scraper output are rendered as hrefs.
export function httpUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.34-2.48V9.68a5.74 5.74 0 0 0-.75-.05A5.69 5.69 0 0 0 4.17 15.3 5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.28 1.37V7.3a4.28 4.28 0 0 1-3.23-1.48z" />
    </svg>
  );
}

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  return platform === 'tiktok' ? <TikTokIcon className={className} /> : <Instagram className={className} />;
}

export function profileUrl(platform: string, handle: string): string {
  return platform === 'tiktok' ? `https://www.tiktok.com/@${handle}` : `https://www.instagram.com/${handle}/`;
}

export function Avatar({ src, handle, className = 'h-9 w-9' }: { src: string | null; handle: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200/70',
          className
        )}
      >
        {handle.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('flex-shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-gray-200/70', className)}
    />
  );
}

// Same pill treatment as the rest of the app: soft fill + 1px ring
export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', className)}>
      {children}
    </span>
  );
}

export const RELATIONSHIP = {
  competitor: { label: 'Competitor', pill: 'bg-orange-50 text-orange-700 ring-orange-100' },
  inspiration: { label: 'Inspiration', pill: 'bg-sky-50 text-sky-700 ring-sky-100' },
} as const;

// White card with an icon-tile heading, as used across the redesigned pages
export function SectionCard({
  title,
  icon: Icon,
  tone = 'bg-blue-50 text-blue-600 ring-blue-100',
  meta,
  action,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg ring-1', tone)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
          {meta && <span className="text-xs font-normal text-gray-500">{meta}</span>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}
