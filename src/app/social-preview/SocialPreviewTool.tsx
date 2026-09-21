'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { Menu, X, Upload, ImageIcon, ChevronDown, Share2, Copy, Check, Loader2 } from 'lucide-react'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  TikTokIcon,
  LinkedInIcon,
} from '@/components/social-icons'

// ─── Platform config ──────────────────────────────────────────────────────────
const FEED_PLATFORMS = [
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter',   label: 'Twitter / X' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'tiktok',    label: 'TikTok' },
]
const STORY_PLATFORMS = [
  { id: 'fb-stories', label: 'FB Stories' },
  { id: 'ig-stories', label: 'IG Stories' },
]

const CTA_OPTIONS = [
  'Shop Now', 'Learn More', 'Sign Up', 'Book Now', 'Contact Us',
  'Get Offer', 'Download', 'Watch More', 'Apply Now', 'Subscribe',
]

// ─── Component ────────────────────────────────────────────────────────────────
interface SocialPreviewToolProps {
  /** Platform tab selected on first render (defaults to Facebook feed) */
  initialPlatform?: string
  /** Start in paid-ad mode rather than organic */
  initialIsAdvert?: boolean
  /** Page <h1>. Platform landing pages override this. */
  heading?: React.ReactNode
  /** Sub-heading under the h1 */
  subheading?: React.ReactNode
  /** Breadcrumb trail rendered above the h1 */
  breadcrumb?: React.ReactNode
  /** Server-rendered SEO copy shown below the tool */
  children?: React.ReactNode
}

export default function SocialPreviewTool({
  initialPlatform = 'facebook',
  initialIsAdvert = false,
  heading = 'Free Social Media Post Preview Tool — Facebook, Instagram, TikTok & More',
  subheading = 'See exactly how your post will look on every major platform — as an organic post or a paid ad. No account needed, completely free.',
  breadcrumb,
  children,
}: SocialPreviewToolProps) {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Business profile
  const [businessName, setBusinessName] = useState('')
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)

  // Post content
  const [postImage, setPostImage] = useState<string | null>(null)
  const [caption, setCaption]     = useState('')

  // Ad fields
  const [isAdvert, setIsAdvert]   = useState(initialIsAdvert)
  const [headline, setHeadline]   = useState('')
  const [ctaText, setCtaText]     = useState('Shop Now')
  const [ctaOpen, setCtaOpen]     = useState(false)

  // Preview
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform)

  // Drag state
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  // Share state
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl]         = useState<string | null>(null)
  const [shareCopied, setShareCopied]   = useState(false)
  const [loadingShared, setLoadingShared] = useState(false)

  const logoInputRef  = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Load shared preview on mount.
  // Read ?share= from the URL directly rather than via useSearchParams(), which
  // would opt this page out of static prerendering and leave crawlers an empty
  // shell instead of the SEO copy below.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('share')
    if (!token) return
    setLoadingShared(true)
    fetch(`/api/preview-share?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return
        if (data.businessName) setBusinessName(data.businessName)
        if (data.caption)      setCaption(data.caption)
        if (data.headline)     setHeadline(data.headline)
        if (data.isAdvert != null) setIsAdvert(data.isAdvert)
        if (data.ctaText)      setCtaText(data.ctaText)
        if (data.selectedPlatform) setSelectedPlatform(data.selectedPlatform)
        if (data.imageUrl)     setPostImage(data.imageUrl)
        if (data.logoUrl)      setLogoPreview(data.logoUrl)
      })
      .catch(() => {})
      .finally(() => setLoadingShared(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShare = async () => {
    setShareLoading(true)
    setShareUrl(null)
    setShareCopied(false)
    try {
      const res = await fetch('/api/preview-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          caption,
          headline,
          isAdvert,
          ctaText,
          selectedPlatform,
          postImage,
          logoPreview,
        }),
      })
      const data = await res.json()
      if (data.token) {
        const url = `${window.location.origin}/social-preview?share=${data.token}`
        setShareUrl(url)
      }
    } catch {
      // silent fail
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handlePostImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setPostImage(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingImage(false)
    const file = e.dataTransfer.files[0]
    if (file) handlePostImageUpload(file)
  }, [])

  const isStory = selectedPlatform === 'fb-stories' || selectedPlatform === 'ig-stories'

  // ── Avatar renderer ───────────────────────────────────────────────────────────
  const renderAvatar = (size: 'sm' | 'md' | 'lg', platform?: string) => {
    const p = platform || selectedPlatform
    const sizeClass  = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
    const iconSize   = size === 'lg' ? 20 : size === 'md' ? 18 : 14
    const textClass  = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs'
    const initial    = businessName ? businessName.charAt(0).toUpperCase() : null

    if (logoPreview) {
      const ring = (p === 'instagram' || p === 'ig-stories')
        ? 'ring-2 ring-pink-500 ring-offset-1'
        : (p === 'tiktok' ? 'ring-2 ring-white ring-offset-0' : '')
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${ring}`}>
          <img src={logoPreview} alt={businessName || 'Logo'} className="w-full h-full object-cover" />
        </div>
      )
    }

    const bgMap: Record<string, string> = {
      facebook:     'bg-blue-600',
      'fb-stories': 'bg-blue-600',
      instagram:    'bg-gradient-to-br from-purple-500 to-pink-500',
      'ig-stories': 'bg-gradient-to-br from-purple-500 to-pink-500',
      twitter:      'bg-sky-400',
      linkedin:     'bg-[#0A66C2]',
      tiktok:       'bg-black border-2 border-white',
    }
    const fallbackIcons: Record<string, React.ReactNode> = {
      facebook:     <FacebookIcon  size={iconSize} className="text-white" />,
      'fb-stories': <FacebookIcon  size={iconSize} className="text-white" />,
      instagram:    <InstagramIcon size={iconSize} className="text-white" />,
      'ig-stories': <InstagramIcon size={iconSize} className="text-white" />,
      twitter:      <TwitterIcon   size={iconSize} className="text-white" />,
      linkedin:     <LinkedInIcon  size={iconSize} className="text-white" />,
      tiktok:       <TikTokIcon    size={iconSize} className="text-white" />,
    }

    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${bgMap[p] || 'bg-gray-500'}`}>
        {initial
          ? <span className={`text-white font-semibold ${textClass}`}>{initial}</span>
          : fallbackIcons[p]}
      </div>
    )
  }

  const displayName = businessName || (
    selectedPlatform === 'facebook'    ? 'Your Facebook Page'
    : selectedPlatform === 'instagram' ? 'your_instagram'
    : selectedPlatform === 'twitter'   ? 'Your Twitter'
    : selectedPlatform === 'linkedin'  ? 'Your Company'
    : selectedPlatform === 'tiktok'    ? '@yourtiktok'
    : selectedPlatform === 'fb-stories'? 'Your Facebook Page'
    : 'your_instagram'
  )

  const handle = businessName
    ? '@' + businessName.toLowerCase().replace(/\s+/g, '')
    : '@yourhandle'

  // ── Shared sub-components ─────────────────────────────────────────────────────
  const ImagePlaceholder = ({ height = 'h-40' }: { height?: string }) => (
    <div className={`${height} bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200`}>
      <div className="text-center text-gray-400">
        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
        <p className="text-xs">Image preview</p>
      </div>
    </div>
  )

  const PostImage = ({ maxH = '360px', aspect }: { maxH?: string; aspect?: string }) => {
    if (!postImage) return <ImagePlaceholder height={aspect ? '' : 'h-40'} />
    return (
      <div className={`flex items-center justify-center bg-gray-50 ${aspect || ''}`}
           style={aspect ? undefined : { maxHeight: maxH }}>
        <img src={postImage} alt="Post"
             className={`${aspect ? 'w-full h-full object-cover' : 'w-full object-contain'}`}
             style={aspect ? undefined : { maxHeight: maxH }} />
      </div>
    )
  }

  // Facebook Advert CTA bar
  const FbAdCTA = () => (
    <div className="border-t border-gray-200 bg-[#f0f2f5] px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: '11px', color: '#65676B', lineHeight: '1.3333' }} className="uppercase tracking-wide leading-tight">yourwebsite.com</p>
        {headline ? (
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#050505', lineHeight: '1.3333' }} className="mt-0.5">{headline}</p>
        ) : (
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#65676B', lineHeight: '1.3333' }} className="italic mt-0.5">Your Headline</p>
        )}
      </div>
      <button style={{ color: '#050505', fontSize: '13px', fontWeight: 600 }} className="flex-shrink-0 bg-[#e4e6eb] hover:bg-[#d8dadf] px-3 py-1.5 rounded-[6px] transition-colors whitespace-nowrap">
        {ctaText}
      </button>
    </div>
  )

  // Instagram / Twitter Advert CTA bar
  const AdCTARow = ({ color = 'blue' }: { color?: string }) => (
    <div className="mt-2 flex items-center gap-2">
      {headline && <span className="text-sm font-semibold text-gray-900 flex-1 truncate">{headline}</span>}
      <button className={`flex-shrink-0 bg-${color}-600 text-white text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity`}>
        {ctaText}
      </button>
    </div>
  )

  // ── Facebook preview ──────────────────────────────────────────────────────────
  const FbGlobe = () => (
    <svg viewBox="0 0 16 16" fill="none" stroke="#65676b" strokeWidth="1.2" strokeLinecap="round" className="w-3.5 h-3.5 flex-shrink-0">
      <circle cx="8" cy="8" r="6.5"/>
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5"/>
      <line x1="1.5" y1="8" x2="14.5" y2="8"/>
      <path d="M2.2 5h11.6M2.2 11h11.6" strokeWidth="1"/>
    </svg>
  )

  const renderFacebookPreview = () => (
    <div className="bg-white max-w-sm mx-auto overflow-hidden shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px', lineHeight: '1.3333', color: '#050505' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {renderAvatar('md', 'facebook')}
          <div>
            <div style={{ fontWeight: 600, color: '#050505', fontSize: '15px', lineHeight: '1.3333' }}>{displayName}</div>
            <div className="flex items-center gap-1 leading-tight" style={{ fontSize: '13px', color: '#65676B' }}>
              {isAdvert ? (
                <>
                  <span>Sponsored</span>
                  <span>·</span>
                  <FbGlobe />
                </>
              ) : (
                <>
                  <span>Just now</span>
                  <span>·</span>
                  <FbGlobe />
                </>
              )}
            </div>
          </div>
        </div>
        {/* Three dots */}
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#65676b" className="w-5 h-5">
              <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 pb-3">
          <p style={{ color: '#050505', fontSize: '15px', lineHeight: '1.3333' }} className="whitespace-pre-wrap break-words">{caption}</p>
        </div>
      )}

      {/* Image */}
      {postImage ? (
        <div className="flex items-center justify-center bg-gray-50" style={{ maxHeight: '360px' }}>
          <img src={postImage} alt="Post" className="w-full object-contain" style={{ maxHeight: '360px' }} />
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y-2 border-dashed border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}

      {/* Ad CTA */}
      {isAdvert && <FbAdCTA />}

      {/* Reactions row */}
      <div className="px-4 py-2 border-t border-[#ced0d4]">
        <div className="flex items-center justify-between" style={{ fontSize: '13px', color: '#65676B' }}>
          <div className="flex items-center gap-1.5">
            {/* Reaction bubbles */}
            <div className="flex -space-x-1">
              <div className="w-[18px] h-[18px] rounded-full bg-[#1877f2] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5">
                  <path d="M8 1.5a.5.5 0 01.5.5v1.793l.354-.353a.5.5 0 01.707.707L8 5.707 6.439 4.147a.5.5 0 01.707-.707l.354.353V2a.5.5 0 01.5-.5zM4.864 6.5H3a1.5 1.5 0 000 3h.086l.82 3.276A1 1 0 004.877 14H11a1 1 0 001-1v-2.81l1.243-2.486A1 1 0 0013 7.5h-1.864A2.5 2.5 0 008.5 5h-1a2.5 2.5 0 00-2.636 1.5z"/>
                </svg>
              </div>
              <div className="w-[18px] h-[18px] rounded-full bg-[#f33e58] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5">
                  <path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                </svg>
              </div>
            </div>
            <span>436</span>
          </div>
          <div className="flex items-center gap-3">
            <span>54 Comments</span>
            <span>8 Shares</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-2 py-1 border-t border-[#ced0d4]">
        <div className="flex">
          {/* Like */}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>Like</span>
          </button>
          {/* Comment */}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>Comment</span>
          </button>
          {/* Share */}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>Share</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Instagram preview ─────────────────────────────────────────────────────────
  const renderInstagramPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px', lineHeight: '1.3333', color: '#050505' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center">
          {renderAvatar('sm', 'instagram')}
          <div className="ml-2.5">
            <div className="font-semibold text-gray-900 text-sm leading-tight">{displayName}</div>
            {isAdvert && <div className="text-xs text-gray-400">Sponsored</div>}
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>
      {postImage ? (
        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          <img src={postImage} alt="Post" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center border-y border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </div>
          <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
        </div>
        <div className="mb-1"><span className="font-semibold text-gray-900 text-sm">237 likes</span></div>
        {caption && (
          <div className="text-sm">
            <span className="font-semibold text-gray-900 mr-1">{displayName}</span>
            <span className="text-gray-900 whitespace-pre-wrap break-words">{caption}</span>
          </div>
        )}
        {isAdvert && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {headline
                ? <p className="text-xs font-semibold text-gray-800 truncate">{headline}</p>
                : <p className="text-xs font-semibold text-gray-400 italic">Your Headline</p>}
              <p className="text-xs text-gray-400">yourwebsite.com</p>
            </div>
            <button className="flex-shrink-0 bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors">
              {ctaText}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── Twitter / X preview ───────────────────────────────────────────────────────
  const renderTwitterPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
      <div className="flex items-start p-3 gap-3">
        {renderAvatar('md', 'twitter')}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{displayName}</span>
            <span className="text-xs text-gray-500">{handle}</span>
            {isAdvert && <span className="ml-auto text-xs text-gray-400 flex items-center gap-0.5">Promoted</span>}
          </div>
          {caption && <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words mt-1">{caption}</p>}
          {postImage ? (
            <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200">
              <img src={postImage} alt="Post" className="w-full max-h-52 object-cover" />
            </div>
          ) : (
            <div className="mt-2 rounded-2xl bg-gray-100 flex items-center justify-center border border-dashed border-gray-200" style={{ minHeight: '140px' }}>
              <div className="text-center text-gray-400"><ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
            </div>
          )}
          {isAdvert && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {headline
                  ? <p className="text-xs font-semibold text-gray-800 truncate">{headline}</p>
                  : <p className="text-xs font-semibold text-gray-400 italic">Your Headline</p>}
                <p className="text-xs text-gray-400">yourwebsite.com</p>
              </div>
              <button className="flex-shrink-0 border border-gray-300 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors">
                {ctaText}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-gray-500 max-w-xs">
            {[
              { d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", n: '104' },
              { d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", n: '78' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} /></svg>
                <span>{item.n}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 text-xs text-pink-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              <span>24</span>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          </div>
        </div>
      </div>
    </div>
  )

  // ── TikTok preview ────────────────────────────────────────────────────────────
  const TikTokNav = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-black flex items-end justify-around px-1 pt-1 pb-1">
      {[
        { label: 'Home',     path: <path d="M3 10.6L12 3l9 7.6V21a1 1 0 01-1 1h-4.5v-6h-7v6H4a1 1 0 01-1-1V10.6z" /> },
        { label: 'Discover', path: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.4-4.4" /></g> },
      ].map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-0.5 w-9">
          <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24">{item.path}</svg>
          <span className="text-white text-[7px] font-medium leading-none">{item.label}</span>
        </div>
      ))}
      {/* Create button */}
      <div className="flex flex-col items-center w-9 pb-2.5">
        <div className="relative w-7 h-[18px]">
          <div className="absolute left-0 top-0 w-6 h-[18px] rounded-[5px] bg-[#25F4EE]" />
          <div className="absolute right-0 top-0 w-6 h-[18px] rounded-[5px] bg-[#FE2C55]" />
          <div className="absolute left-[2px] top-0 w-[23px] h-[18px] rounded-[5px] bg-white flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </div>
        </div>
      </div>
      {[
        { label: 'Inbox', path: <path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H9l-4.4 3.3A1 1 0 013 20.5V5a2 2 0 012-2z" /> },
        { label: 'Me',    path: <g><circle cx="12" cy="7.5" r="4" /><path d="M3.8 21c.6-4.3 4.1-6.6 8.2-6.6s7.6 2.3 8.2 6.6H3.8z" /></g> },
      ].map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-0.5 w-9">
          <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24">{item.path}</svg>
          <span className="text-white text-[7px] font-medium leading-none">{item.label}</span>
        </div>
      ))}
    </div>
  )

  const renderTikTokPreview = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '440px' }}>
      {/* Media */}
      {postImage ? (
        <img src={postImage} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[#111111] flex items-center justify-center">
          <div className="w-[84px] h-[68px] rounded-2xl border-2 border-white/10 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-white/10" strokeWidth={1.5} />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/45" />

      {/* Top bar */}
      <div className="absolute top-2.5 left-3 right-3 flex items-center justify-center">
        <span className="text-white/60 text-[11px] font-semibold">Following</span>
        <span className="text-white/30 text-[11px] mx-1.5">|</span>
        <span className="text-white text-[11px] font-bold">For You</span>
        <svg className="absolute right-0 w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.4-4.4" /></svg>
      </div>

      {isAdvert && (
        <div className="absolute top-8 left-3">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/30">Sponsored</span>
        </div>
      )}

      {/* Right action rail */}
      <div className="absolute right-2 bottom-[84px] flex flex-col items-center gap-3.5">
        <div className="flex flex-col items-center gap-0.5">
          <svg className="w-7 h-7 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          <span className="text-white text-[10px] font-semibold drop-shadow">2.5M</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <svg className="w-7 h-7 drop-shadow" viewBox="0 0 24 24">
            <path fill="white" d="M20.5 2.5h-17A1.5 1.5 0 002 4v12.5A1.5 1.5 0 003.5 18H6v3.3c0 .7.8 1.1 1.4.6l4.9-3.9h8.2a1.5 1.5 0 001.5-1.5V4a1.5 1.5 0 00-1.5-1.5z" />
            <circle cx="8" cy="10" r="1.3" fill="black" /><circle cx="12" cy="10" r="1.3" fill="black" /><circle cx="16" cy="10" r="1.3" fill="black" />
          </svg>
          <span className="text-white text-[10px] font-semibold drop-shadow">342</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <svg className="w-7 h-7 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M21.7 11.2L13 3.3c-.5-.5-1.4-.1-1.4.6v3.8C5.9 8.2 2 12.6 2 18.4c0 .9 1.1 1.2 1.6.5 1.9-2.8 4.5-4.3 8-4.4v3.8c0 .7.9 1.1 1.4.6l8.7-7.9c.3-.3.3-.8 0-1.1z" /></svg>
          <span className="text-white text-[10px] font-semibold drop-shadow">13.1K</span>
        </div>
        {/* Record disc */}
        <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#3a3a3a] to-black flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-white" />
          <svg className="absolute -left-1.5 -top-0.5 w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-[42px] left-0 right-12 px-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          {renderAvatar('sm', 'tiktok')}
          <span className="text-white text-xs font-bold drop-shadow">{displayName}</span>
        </div>
        {caption && <p className="text-white text-[11px] font-semibold leading-snug line-clamp-3 drop-shadow">{caption}</p>}
        {isAdvert && (
          <div className="flex items-center gap-2 pt-0.5">
            {headline && <p className="text-white/80 text-[11px] font-medium truncate flex-1">{headline}</p>}
            <button className="flex-shrink-0 bg-[#FE2C55] text-white text-[11px] font-bold px-3 py-1.5 rounded-md">{ctaText}</button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          <div className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden"><div className="h-full w-2/3 bg-white/60 rounded-full" /></div>
        </div>
      </div>

      <TikTokNav />
    </div>
  )

  // ── LinkedIn preview ──────────────────────────────────────────────────────────
  // LinkedIn pages use a square logo rather than a circular avatar
  const renderLinkedInLogo = () => {
    const initial = businessName ? businessName.charAt(0).toUpperCase() : null
    if (logoPreview) {
      return (
        <div className="w-12 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-white">
          <img src={logoPreview} alt={businessName || 'Logo'} className="w-full h-full object-cover" />
        </div>
      )
    }
    return (
      <div className="w-12 h-12 rounded-[4px] flex-shrink-0 bg-[#0A66C2] flex items-center justify-center">
        {initial
          ? <span className="text-white font-semibold text-lg">{initial}</span>
          : <LinkedInIcon size={24} className="text-white" />}
      </div>
    )
  }

  const LinkedInReactions = () => (
    <div className="flex -space-x-1">
      <div className="w-[18px] h-[18px] rounded-full bg-[#378FE9] flex items-center justify-center ring-1 ring-white">
        <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><path d="M9.5 21H6a1 1 0 01-1-1v-9a1 1 0 011-1h3.5v11zM20.9 11.4l-1.5 8A2 2 0 0117.4 21H11V9.6l3.2-6.4a1 1 0 011.8.1c.5 1.2.7 2.6.4 4L15.9 9h3.2a2 2 0 011.8 2.4z"/></svg>
      </div>
      <div className="w-[18px] h-[18px] rounded-full bg-[#DF704D] flex items-center justify-center ring-1 ring-white">
        <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>
      </div>
      <div className="w-[18px] h-[18px] rounded-full bg-[#F5BB5C] flex items-center justify-center ring-1 ring-white">
        <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><path d="M9 21h6v-1H9v1zm3-20a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-3.3A7 7 0 0012 1z"/></svg>
      </div>
    </div>
  )

  const LinkedInActionIcon = ({ kind }: { kind: 'like' | 'comment' | 'repost' | 'share' }) => {
    const common = { className: 'w-[18px] h-[18px]', fill: 'none', stroke: '#00000099', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
    if (kind === 'like')    return <svg {...common}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
    if (kind === 'comment') return <svg {...common}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
    if (kind === 'repost')  return <svg {...common}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
    return <svg {...common}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
  }

  const renderLinkedInPreview = () => (
    <div className="bg-white max-w-sm mx-auto overflow-hidden rounded-lg border border-[#e0dfdc] shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: 'rgba(0,0,0,0.9)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-start gap-2 min-w-0">
          {renderLinkedInLogo()}
          <div className="min-w-0 pt-0.5">
            <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.3' }} className="truncate">{displayName}</div>
            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="truncate">
              {isAdvert ? 'Promoted · Your industry' : 'Your industry'}
            </div>
            {!isAdvert && (
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="flex items-center gap-1">
                <span>1h</span>
                <span>·</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" className="w-3 h-3">
                  <circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="2.8" ry="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/>
                </svg>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <svg viewBox="0 0 20 20" fill="rgba(0,0,0,0.6)" className="w-5 h-5"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>
          <X className="w-4 h-4" style={{ color: 'rgba(0,0,0,0.6)' }} />
        </div>
      </div>

      {/* Caption */}
      <div className="px-3 pb-2">
        {caption ? (
          <p style={{ fontSize: '14px', lineHeight: '1.42857', color: 'rgba(0,0,0,0.9)' }} className="whitespace-pre-wrap break-words line-clamp-3">
            {caption}
            <span style={{ color: 'rgba(0,0,0,0.6)' }}> …see more</span>
          </p>
        ) : (
          <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.45)' }} className="italic">Your post text appears here…</p>
        )}
      </div>

      {/* Image */}
      {postImage ? (
        <div className="bg-gray-50 flex items-center justify-center" style={{ maxHeight: '300px' }}>
          <img src={postImage} alt="Post" className="w-full object-cover" style={{ maxHeight: '300px' }} />
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y border-dashed border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}

      {/* Link / CTA card — LinkedIn single-image ad unit */}
      {isAdvert && (
        <div className="bg-[#F4F2EE] px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {headline
              ? <p style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.3', color: 'rgba(0,0,0,0.9)' }}>{headline}</p>
              : <p style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.3', color: 'rgba(0,0,0,0.45)' }} className="italic">Your Headline</p>}
            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }} className="mt-0.5">yourwebsite.com</p>
          </div>
          <button className="flex-shrink-0 border border-[#0A66C2] text-[#0A66C2] text-[13px] font-semibold px-3 py-1 rounded-full hover:bg-[#0A66C2]/5 transition-colors whitespace-nowrap">
            {ctaText}
          </button>
        </div>
      )}

      {/* Social counts */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-1.5">
          <LinkedInReactions />
          <span>139K</span>
        </div>
        <div className="flex items-center gap-2">
          <span>12K comments</span>
          <span>·</span>
          <span>{isAdvert ? '108K reposts' : '6K reposts'}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-1 py-0.5 border-t border-[#e0dfdc]">
        <div className="flex">
          {(['like', 'comment', 'repost', 'share'] as const).map((kind) => (
            <button key={kind} className="flex-1 flex items-center justify-center gap-1 py-2 hover:bg-[#f3f2ef] rounded transition-colors">
              <LinkedInActionIcon kind={kind} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.6)' }} className="capitalize">{kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Facebook Stories preview ──────────────────────────────────────────────────
  const renderFBStoriesPreview = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {postImage ? (
        <img src={postImage} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center">
          <div className="text-center text-white/40"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50" />
      <div className="absolute top-3 left-3 right-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
            <div className={`h-full bg-white rounded-full ${i === 0 ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <div className="absolute top-8 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {renderAvatar('sm', 'fb-stories')}
          <div>
            <p className="text-white text-xs font-semibold leading-tight">{displayName}</p>
            {isAdvert ? <p className="text-white/70 text-[10px]">Sponsored</p> : <p className="text-white/70 text-[10px]">Just now</p>}
          </div>
        </div>
        <X className="w-4 h-4 text-white/80" />
      </div>
      {caption && (
        <div className="absolute bottom-20 left-3 right-3">
          <p className="text-white text-xs leading-relaxed text-center drop-shadow-lg">{caption}</p>
        </div>
      )}
      {isAdvert && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          {headline && <p className="text-white text-xs font-semibold text-center">{headline}</p>}
          <button className="bg-white text-gray-900 text-xs font-bold px-5 py-2 rounded-full shadow-lg">{ctaText}</button>
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
        <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-2">
          <p className="text-white/60 text-[10px]">Send message...</p>
        </div>
        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
      </div>
    </div>
  )

  // ── Instagram Stories preview ─────────────────────────────────────────────────
  const renderIGStoriesPreview = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {postImage ? (
        <img src={postImage} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-700 to-orange-500 flex items-center justify-center">
          <div className="text-center text-white/40"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50" />
      <div className="absolute top-3 left-3 right-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${i === 0 ? 'w-full bg-white' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <div className="absolute top-8 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {renderAvatar('sm', 'ig-stories')}
          <div>
            <p className="text-white text-xs font-semibold leading-tight">{displayName}</p>
            {isAdvert ? <p className="text-white/70 text-[10px]">Sponsored</p> : <p className="text-white/70 text-[10px]">Just now</p>}
          </div>
        </div>
        <X className="w-4 h-4 text-white/80" />
      </div>
      {caption && (
        <div className="absolute bottom-24 left-3 right-3">
          <p className="text-white text-xs leading-relaxed text-center drop-shadow-lg">{caption}</p>
        </div>
      )}
      {isAdvert ? (
        <div className="absolute bottom-3 left-3 right-3 flex flex-col items-center gap-1.5">
          {headline && <p className="text-white text-xs font-semibold text-center">{headline}</p>}
          <button className="w-full bg-white text-gray-900 text-xs font-bold py-2.5 rounded-xl shadow-lg">{ctaText}</button>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <div className="flex-1 border border-white/50 rounded-full px-3 py-2">
            <p className="text-white/60 text-[10px]">Send message</p>
          </div>
          <div className="flex gap-1">
            {['❤️', '😂', '😮'].map((e) => <span key={e} className="text-base">{e}</span>)}
          </div>
        </div>
      )}
    </div>
  )

  // ── Master renderer ───────────────────────────────────────────────────────────
  const renderPreview = () => {
    switch (selectedPlatform) {
      case 'facebook':   return renderFacebookPreview()
      case 'instagram':  return renderInstagramPreview()
      case 'twitter':    return renderTwitterPreview()
      case 'linkedin':   return renderLinkedInPreview()
      case 'tiktok':     return renderTikTokPreview()
      case 'fb-stories': return renderFBStoriesPreview()
      case 'ig-stories': return renderIGStoriesPreview()
      default:           return renderFacebookPreview()
    }
  }

  // ── Page ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Navigation ── */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center">
              <Link href="/"><img src="/cm-logo.png" alt="CM Logo" className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" /></Link>
              <img src="/oot-product-silver-1.png" alt="OOT Digital Product" className="hidden md:block h-6 w-auto ml-4 object-contain rounded-[4px]" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="/features"       className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="/pricing"        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <Link href="/contact"     className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
              <Link href="/blog"        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
              <Link href="/social-preview" className="text-sm font-semibold text-foreground border-b-2 border-primary">Free Preview Tool</Link>
              {user ? (
                <Link href="/dashboard"><Button size="sm">Dashboard</Button></Link>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link href="/auth/login"><Button variant="outline" size="sm" className="bg-white text-gray-900 hover:bg-gray-50 border-gray-300">Sign In</Button></Link>
                  <Link href="/auth/signup"><Button size="sm">Start 14-Day Free Trial</Button></Link>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="bg-background/80 backdrop-blur-sm">
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {[
                  { href: '/features',       label: 'Features' },
                  { href: '/pricing',        label: 'Pricing' },
                  { href: '/contact',        label: 'Contact' },
                  { href: '/blog',           label: 'Blog' },
                  { href: '/social-preview', label: 'Free Preview Tool' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" onClick={() => setMobileMenuOpen(false)}>{label}</Link>
                ))}
                <div className="pt-4 pb-3 border-t border-border/40 space-y-2">
                  {user ? (
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}><Button size="sm" className="w-full">Dashboard</Button></Link>
                  ) : (
                    <>
                      <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}><Button variant="outline" size="sm" className="w-full">Sign In</Button></Link>
                      <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}><Button size="sm" className="w-full">Start 14-Day Free Trial</Button></Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Page header ── */}
      <div className="border-b border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {breadcrumb}
          <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
          <p className="mt-2 text-muted-foreground">{subheading}</p>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── LEFT — Business Profile ── */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-base">Business Profile</h2>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Business Name</label>
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Acme Coffee Co."
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Business Logo</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img src={logoPreview} alt="Logo" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                    <button onClick={() => { setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = '' }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:opacity-90">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-5 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload logo</span>
                    <span className="text-xs text-muted-foreground/70">PNG, JPG, SVG</span>
                  </button>
                )}
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
              <p className="text-sm font-medium">Want AI-generated captions too?</p>
              <p className="text-xs text-muted-foreground">Content Manager generates platform-ready captions for every post, plus scheduling across all major platforms.</p>
              <Link href="/auth/signup"><Button size="sm" className="w-full mt-1">Start Free Trial</Button></Link>
            </div>
          </div>

          {/* ── MIDDLE — Post Content ── */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-base">Post Content</h2>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Upload Image</label>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePostImageUpload(f) }} />
                {postImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                    <img src={postImage} alt="Post" className="w-full max-h-64 object-contain" />
                    <button onClick={() => { setPostImage(null); if (imageInputRef.current) imageInputRef.current.value = '' }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => imageInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg hover:bg-black/80 transition-colors">Change</button>
                  </div>
                ) : (
                  <div onClick={() => imageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true) }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={handleImageDrop}
                    className={`flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDraggingImage ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-medium">Click or drag to upload</span>
                    <span className="text-xs text-muted-foreground/70">PNG, JPG, WEBP</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Caption</label>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write your caption here..." rows={4}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none" />
                <p className="text-xs text-muted-foreground text-right">{caption.length} characters</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-base">Post Type</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Switch between an organic post or a paid ad</p>
                </div>
                <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                  <button onClick={() => setIsAdvert(false)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${!isAdvert ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    Organic
                  </button>
                  <button onClick={() => setIsAdvert(true)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isAdvert ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    Advert
                  </button>
                </div>
              </div>
              {isAdvert && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Headline</label>
                    <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Try Our New Summer Blend"
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Call to Action</label>
                    <div className="relative">
                      <button onClick={() => setCtaOpen(!ctaOpen)}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-left flex items-center justify-between">
                        <span>{ctaText}</span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${ctaOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {ctaOpen && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {CTA_OPTIONS.map((opt) => (
                            <button key={opt} onClick={() => { setCtaText(opt); setCtaOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${opt === ctaText ? 'bg-muted font-medium' : ''}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT — Social Preview ── */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Preview</h2>
                <div className="flex items-center gap-2">
                  {isAdvert && (
                    <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Ad format</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleShare}
                    disabled={shareLoading || loadingShared}
                    className="gap-1.5 text-xs h-7 px-2.5"
                  >
                    {shareLoading
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Share2 className="w-3 h-3" />}
                    Share
                  </Button>
                </div>
              </div>

              {/* Share link box */}
              {shareUrl && (
                <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
                  <p className="flex-1 text-xs text-muted-foreground truncate">{shareUrl}</p>
                  <button
                    onClick={handleCopyLink}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {shareCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {shareCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {loadingShared && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading shared preview…
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Feed</p>
                <div className="grid grid-cols-5 rounded-lg border border-border overflow-hidden">
                  {FEED_PLATFORMS.map((p) => (
                    <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                      className={`py-2 text-[11px] font-medium transition-colors leading-tight px-1 ${selectedPlatform === p.id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Stories</p>
                <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden">
                  {STORY_PLATFORMS.map((p) => (
                    <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                      className={`py-2 text-xs font-medium transition-colors ${selectedPlatform === p.id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`rounded-lg overflow-hidden ${isStory ? 'bg-gray-900 p-3' : 'bg-gray-50 p-3'}`}>
                {renderPreview()}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── SEO copy (supplied per-page by the server component) ── */}
      {children}

    </div>
  )
}
