'use client'

import { useEffect, useRef, useState } from 'react'

const VIDEO_SRC = '/Content-manager-demo.mp4'
const POSTER_SRC = '/content-manager-demo-poster.webp'

/**
 * The product demo from the home page, loaded only once it scrolls near the
 * viewport. The file is ~25MB, so fetching it up front (as the home page does)
 * would drag down this page's Core Web Vitals. The poster renders immediately
 * and holds the 16:9 space, so there's no layout shift when the video starts.
 */
export function DemoVideo({ title }: { title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | undefined>(undefined)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setSrc(VIDEO_SRC)
        // Respect reduced motion: load the video but let the visitor press play
        if (!reduceMotion) requestAnimationFrame(() => el.play().catch(() => {}))
      },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={POSTER_SRC}
      width={1280}
      height={720}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label={title}
      className="w-full h-auto aspect-video rounded-2xl shadow-2xl bg-muted"
    />
  )
}
