'use client';

import { useRef, useState, useEffect } from 'react';
import { Play, Film } from 'lucide-react';

interface VideoThumbnailProps {
  src: string;
  className?: string;
  showPlayOverlay?: boolean;
  objectFit?: 'cover' | 'contain';
}

export function VideoThumbnail({
  src,
  className,
  showPlayOverlay = true,
  objectFit = 'cover',
}: VideoThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  // Lazy: only start loading the video once it scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { root: null, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    // Seeking slightly past 0 forces the browser to decode and paint the first frame.
    // currentTime = 0 is a no-op in many browsers; 0.001 reliably triggers a seek.
    v.currentTime = 0.001;
  };

  const handleSeeked = () => {
    setFrameReady(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={containerRef} className={`relative bg-gray-200 overflow-hidden ${className ?? ''}`}>
      {isInView && !hasError ? (
        <>
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onSeeked={handleSeeked}
            onError={handleError}
            className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} transition-opacity duration-200 ${frameReady ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* Loading shimmer shown until first frame is painted */}
          {!frameReady && (
            <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-gray-200">
              <Film className="w-5 h-5 text-gray-300" />
            </div>
          )}
          {showPlayOverlay && frameReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}
        </>
      ) : hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 min-h-16">
          <Film className="w-6 h-6" />
          <span className="text-xs">Video</span>
        </div>
      ) : (
        /* Not yet in view — placeholder matching the container's size */
        <div className="w-full h-full flex items-center justify-center min-h-16 animate-pulse bg-gray-200">
          <Film className="w-5 h-5 text-gray-300" />
        </div>
      )}
    </div>
  );
}
