'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoThumbnail } from '@/components/VideoThumbnail';

export interface CarouselMediaItem {
  url: string;
  isVideo?: boolean;
}

/**
 * Lazy carousel media for the column-view cards.
 *
 * Every image in the carousel is mounted at once (stacked in a single grid
 * cell) as soon as the card scrolls into view, and paging just flips which
 * layer is opaque. Swapping the `src` of one shared <img> instead meant each
 * arrow click kicked off a cold network fetch while the previous frame stayed
 * on screen — the lag this replaces.
 *
 * Videos are only mounted while active, since decoding a poster frame for
 * every slide up front is far more expensive than fetching an image.
 */
export function CarouselMedia({
  items,
  index,
  alt,
  className,
  videoClassName = 'w-full min-h-24',
}: {
  items: CarouselMediaItem[];
  index: number;
  alt: string;
  className?: string;
  videoClassName?: string;
}) {
  const [isInView, setIsInView] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const safeIndex = items.length > 0 ? Math.min(Math.max(index, 0), items.length - 1) : 0;
  const active = items[safeIndex];
  const showPlaceholder = !isInView || !active || (!active.isVideo && !loaded[active.url]);

  return (
    <div ref={containerRef} className={`grid ${className ?? ''}`}>
      {isInView &&
        items.map((item, i) =>
          item.isVideo ? (
            i === safeIndex ? (
              <div key={`${item.url}-${i}`} style={{ gridArea: '1 / 1' }}>
                <VideoThumbnail src={item.url} className={videoClassName} objectFit="cover" />
              </div>
            ) : null
          ) : (
            <img
              key={`${item.url}-${i}`}
              src={item.url}
              alt={i === safeIndex ? alt : ''}
              aria-hidden={i !== safeIndex}
              fetchPriority={i === safeIndex ? 'high' : 'low'}
              onLoad={() => setLoaded(prev => (prev[item.url] ? prev : { ...prev, [item.url]: true }))}
              onError={e => {
                e.currentTarget.src = '/api/placeholder/100/100';
              }}
              style={{ gridArea: '1 / 1' }}
              className={`w-full h-auto object-contain rounded-lg transition-opacity duration-150 ${
                i === safeIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          )
        )}
      {showPlaceholder && (
        <div
          style={{ gridArea: '1 / 1' }}
          className="w-full min-h-32 bg-gray-200 animate-pulse rounded-lg"
        />
      )}
    </div>
  );
}
