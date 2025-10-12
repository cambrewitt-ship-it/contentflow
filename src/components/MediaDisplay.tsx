'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

interface MediaDisplayProps {
  src: string
  alt?: string
  mediaType?: 'image' | 'video' | 'unknown'
  className?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
  playsInline?: boolean
  preload?: 'auto' | 'metadata' | 'none'
}

/**
 * Unified media display component that handles both images and videos
 * Automatically detects media type from URL if not specified
 */
export function MediaDisplay({
  src,
  alt = 'Media content',
  mediaType = 'unknown',
  className = '',
  controls = true,
  autoPlay = false,
  muted = true,
  playsInline = true,
  preload = 'metadata'
}: MediaDisplayProps) {
  const [hasError, setHasError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Auto-detect media type if not specified
  const detectedMediaType = mediaType === 'unknown' 
    ? (src.match(/\.(mp4|mov|avi|webm|mpeg)(\?|$)/i) || src.startsWith('data:video/') ? 'video' : 'image')
    : mediaType

  const isVideo = detectedMediaType === 'video'

  // Handle errors gracefully
  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <p className="text-sm text-gray-500">Failed to load {isVideo ? 'video' : 'image'}</p>
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="relative group">
        <video
          src={src}
          className={className}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          playsInline={playsInline}
          preload={preload}
          onError={() => setHasError(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        >
          <p>Your browser doesn&apos;t support HTML5 video.</p>
        </video>
        
        {/* Play indicator overlay when not playing */}
        {!isPlaying && !controls && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none">
            <div className="bg-white/90 rounded-full p-3">
              <Play className="w-6 h-6 text-gray-800" fill="currentColor" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  )
}

/**
 * Lazy loading version for better performance in lists
 */
export function LazyMediaDisplay(props: MediaDisplayProps) {
  return <MediaDisplay {...props} preload="metadata" />
}

