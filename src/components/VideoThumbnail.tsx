'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  // True once a frame has been decoded and is safe to reveal (either as a
  // captured poster image or, if the snapshot below fails, the paused
  // <video> element itself). Drives hiding the loading placeholder — this
  // must NOT depend on the canvas snapshot succeeding, or a cross-origin
  // video without CORS headers taints the canvas and the placeholder pulses
  // forever instead of settling on the first frame.
  const [isReady, setIsReady] = useState(false);

  // Reset state whenever the underlying source changes so a stale
  // error/poster from a previous card doesn't stick around.
  useEffect(() => {
    setHasError(false);
    setPosterUrl(null);
    setIsReady(false);
  }, [src]);

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
    try {
      v.currentTime = 0.001;
    } catch {
      // Some browsers throw if the media isn't seekable yet; leave it to onError/onLoadedData.
    }
  };

  const handleSeeked = useCallback(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v) return;
    v.pause();
    // Reveal the frame now, regardless of whether the canvas snapshot below
    // succeeds — a cross-origin video without CORS headers taints the canvas,
    // and we'd rather show the paused <video> as-is than pulse forever.
    setIsReady(true);
    if (!canvas) return;
    // Snapshot the decoded frame into a static image. Once captured, the
    // thumbnail no longer depends on the <video> element staying healthy —
    // if it errors out afterward (buffering, network hiccups), the poster
    // we already grabbed keeps showing instead of vanishing.
    try {
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      setPosterUrl(canvas.toDataURL('image/jpeg', 0.8));
    } catch {
      // Cross-origin video without CORS headers taints the canvas — fall back
      // to just showing the paused live video element instead of a static snapshot.
    }
  }, []);

  const handleError = () => {
    // Ignore late errors once we already have a usable frame.
    if (!isReady) setHasError(true);
  };

  // Safety net: some hosts/formats never fire onSeeked for a metadata-only
  // preload (e.g. no byte-range support), which would otherwise leave the
  // loading placeholder pulsing indefinitely. Give up waiting after a beat.
  useEffect(() => {
    if (!isInView || isReady || hasError) return;
    const timer = setTimeout(() => setIsReady(true), 2500);
    return () => clearTimeout(timer);
  }, [isInView, isReady, hasError]);

  // Still need the live <video> mounted while decoding, and afterward only if
  // the canvas snapshot didn't produce a poster (fallback: show the paused
  // video itself as the first-frame thumbnail).
  const showVideoEl = isInView && !hasError && !posterUrl;
  const showPoster = isInView && !hasError && !!posterUrl;
  const showError = hasError && !posterUrl;
  const showLoading = isInView && !hasError && !isReady;
  const hasFrame = showPoster || (showVideoEl && isReady);

  return (
    <div ref={containerRef} className={`relative bg-gray-200 overflow-hidden ${className ?? ''}`}>
      <canvas ref={canvasRef} className="hidden" />
      {showPoster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt="Video thumbnail"
          className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
        />
      )}
      {showVideoEl && (
        <video
          ref={videoRef}
          src={src}
          crossOrigin="anonymous"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onError={handleError}
          className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} ${isReady ? '' : 'hidden'}`}
        />
      )}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-gray-200">
          <Film className="w-5 h-5 text-gray-300" />
        </div>
      )}
      {showError && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 min-h-16">
          <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center">
            <Play className="w-4 h-4 text-gray-400 ml-0.5" fill="currentColor" />
          </div>
          <span className="text-xs">Tap to view video</span>
        </div>
      )}
      {!isInView && !showError && (
        /* Not yet in view — placeholder matching the container's size */
        <div className="w-full h-full flex items-center justify-center min-h-16 animate-pulse bg-gray-200">
          <Film className="w-5 h-5 text-gray-300" />
        </div>
      )}
      {showPlayOverlay && hasFrame && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
}
