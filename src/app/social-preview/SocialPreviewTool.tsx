'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { Menu, X, Upload, ImageIcon, ChevronDown } from 'lucide-react'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  TikTokIcon,
} from '@/components/social-icons'

// ─── Platform config ──────────────────────────────────────────────────────────
const FEED_PLATFORMS = [
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter',   label: 'Twitter / X' },
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
export default function SocialPreviewTool() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Business profile
  const [businessName, setBusinessName] = useState('')
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)

  // Post content
  const [postImage, setPostImage] = useState<string | null>(null)
  const [caption, setCaption]     = useState('')

  // Ad fields
  const [isAdvert, setIsAdvert]   = useState(false)
  const [headline, setHeadline]   = useState('')
  const [ctaText, setCtaText]     = useState('Shop Now')
  const [ctaOpen, setCtaOpen]     = useState(false)

  // Preview
  const [selectedPlatform, setSelectedPlatform] = useState('facebook')

  // Drag state
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  const logoInputRef  = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

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
      tiktok:       'bg-black border-2 border-white',
    }
    const fallbackIcons: Record<string, React.ReactNode> = {
      facebook:     <FacebookIcon  size={iconSize} className="text-white" />,
      'fb-stories': <FacebookIcon  size={iconSize} className="text-white" />,
      instagram:    <InstagramIcon size={iconSize} className="text-white" />,
      'ig-stories': <InstagramIcon size={iconSize} className="text-white" />,
      twitter:      <TwitterIcon   size={iconSize} className="text-white" />,
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
        <p className="text-[11px] text-gray-500 uppercase tracking-wide leading-tight">yourwebsite.com</p>
        {headline ? (
          <p className="text-[13px] font-semibold text-gray-900 leading-snug mt-0.5">{headline}</p>
        ) : (
          <p className="text-[13px] font-semibold text-gray-400 italic leading-snug mt-0.5">Your Headline</p>
        )}
      </div>
      <button className="flex-shrink-0 bg-[#e4e6eb] hover:bg-[#d8dadf] text-[#050505] text-[13px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors whitespace-nowrap">
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
    <div className="bg-white max-w-sm mx-auto overflow-hidden shadow-sm" style={{ fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {renderAvatar('md', 'facebook')}
          <div>
            <div className="font-semibold text-[#050505] text-[15px] leading-tight">{displayName}</div>
            <div className="flex items-center gap-1 text-[13px] text-[#65676b] leading-tight">
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
          <p className="text-[#050505] text-[15px] leading-[1.34] whitespace-pre-wrap break-words">{caption}</p>
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
        <div className="flex items-center justify-between text-[13px] text-[#65676b]">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span className="text-[#65676b] text-[13px] font-semibold">Like</span>
          </button>
          {/* Comment */}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[#65676b] text-[13px] font-semibold">Comment</span>
          </button>
          {/* Share */}
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span className="text-[#65676b] text-[13px] font-semibold">Share</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Instagram preview ─────────────────────────────────────────────────────────
  const renderInstagramPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
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
  const renderTikTokPreview = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {postImage ? (
        <img src={postImage} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center text-gray-500"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-xs opacity-50">Image preview</p></div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
      <div className="absolute top-3 left-0 right-0 flex items-center justify-center">
        <span className="text-white text-xs font-semibold opacity-80">Following</span>
        <span className="text-white/40 text-xs mx-2">|</span>
        <span className="text-white text-xs font-bold">For You</span>
      </div>
      {isAdvert && (
        <div className="absolute top-9 left-3">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/30">Sponsored</span>
        </div>
      )}
      <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-5">
        {renderAvatar('sm', 'tiktok')}
        {[
          { icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', label: '14.2K', filled: true },
          { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', label: '342', filled: false },
          { icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', label: 'Share', filled: false },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill={item.filled ? 'currentColor' : 'none'} stroke={item.filled ? 'none' : 'currentColor'} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
            </div>
            <span className="text-white text-[10px] font-medium">{item.label}</span>
          </div>
        ))}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 border-2 border-white/40 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-black/60" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-12 p-3 space-y-1.5">
        <p className="text-white text-sm font-bold">{displayName}</p>
        {caption && <p className="text-white/90 text-xs leading-relaxed line-clamp-2">{caption}</p>}
        {isAdvert && (
          <div className="flex items-center gap-2 pt-1">
            {headline && <p className="text-white/80 text-xs font-medium truncate flex-1">{headline}</p>}
            <button className="flex-shrink-0 bg-[#FE2C55] text-white text-xs font-bold px-3 py-1.5 rounded-md">{ctaText}</button>
          </div>
        )}
        <div className="flex items-center gap-1 pt-0.5">
          <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          <p className="text-white/70 text-[10px] truncate">Original Sound · {displayName}</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Free Social Media Post Preview Tool — Facebook, Instagram, TikTok &amp; More</h1>
          <p className="mt-2 text-muted-foreground">See exactly how your post will look on every major platform — as an organic post or a paid ad. No account needed, completely free.</p>
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
                {isAdvert && (
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Ad format</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Feed</p>
                <div className="grid grid-cols-4 rounded-lg border border-border overflow-hidden">
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

      {/* ── SEO Content Section ── */}
      <div className="border-t border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-4xl">
          <div className="space-y-12">

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">How to Preview Your Social Media Posts</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Uploading an image and writing a caption only to find it looks nothing like you expected on the actual platform is one of the most common frustrations in social media marketing. Our free social media preview tool lets you see exactly how your post will render — including profile picture, caption layout, image cropping, and engagement buttons — before you hit publish. Simply enter your business name, upload your logo, add your image and caption, then switch between platforms instantly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Supported Platforms — Facebook, Instagram, TikTok, Twitter/X &amp; More</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Each social media platform renders posts differently. Image ratios, caption positioning, font sizes, and engagement UI all vary significantly. Our tool supports live previews for:
              </p>
              <ul className="space-y-2 text-base text-muted-foreground">
                <li><strong className="text-foreground">Facebook Feed</strong> — See your post as it appears in the Facebook news feed, including the engagement bar and share options.</li>
                <li><strong className="text-foreground">Instagram Feed</strong> — Preview square-cropped images, caption placement, and like counts as they appear on Instagram.</li>
                <li><strong className="text-foreground">Twitter / X Feed</strong> — Check how your tweet renders with attached image, handle, and engagement row.</li>
                <li><strong className="text-foreground">TikTok Feed</strong> — Visualise your content in TikTok&apos;s full-screen vertical format with overlaid caption and action buttons.</li>
                <li><strong className="text-foreground">Facebook Stories</strong> — Preview the full-screen story format with progress bars and reply bar.</li>
                <li><strong className="text-foreground">Instagram Stories</strong> — See your story as it appears with the Instagram gradient header and swipe-up CTA.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Preview Organic Posts and Paid Social Media Ads</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Most social media preview tools only show organic posts. Ours lets you toggle between organic and paid ad formats so you can check how your ad creative will render — including the &ldquo;Sponsored&rdquo; label, headline text, call-to-action button, and destination URL. This is especially useful for agencies and media buyers who need to present realistic ad mockups to clients before spending any budget.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Want to Generate and Schedule Content Too?</h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                This preview tool is a free standalone feature of <strong className="text-foreground">Content Manager</strong> — an AI-powered platform built for marketing agencies. With a full account you can generate brand-trained captions using AI, schedule posts across every platform, manage multiple clients from a shared workspace, and get content approved through a built-in client portal. No more copy-pasting between tools.
              </p>
              <Link href="/auth/signup">
                <Button size="lg">Start Your Free 14-Day Trial</Button>
              </Link>
            </section>

          </div>
        </div>
      </div>

    </div>
  )
}
