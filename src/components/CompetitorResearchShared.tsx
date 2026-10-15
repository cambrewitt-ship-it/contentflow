'use client';

import { useState } from 'react';
import { Instagram } from 'lucide-react';

export function formatCount(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
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

export function Avatar({ src, handle, size = 'h-9 w-9' }: { src: string | null; handle: string; size?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${size} rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${size} rounded-full object-cover flex-shrink-0 bg-gray-100`}
    />
  );
}

// Only http(s) links from model or scraper output are rendered as hrefs.
export function httpUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
