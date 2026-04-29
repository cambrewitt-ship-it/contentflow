'use client'

import { ImageIcon } from 'lucide-react'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  ThreadsIcon,
} from '@/components/social-icons'

interface SocialPreviewCardProps {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'threads'
  accountName: string
  accountAvatarUrl?: string
  username?: string
  caption: string
  imageUrl?: string
  scheduledDate?: string
  scheduledTime?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  clientComments?: string
  showApprovalInfo?: boolean
}

export function SocialPreviewCard({
  platform,
  accountName,
  accountAvatarUrl,
  username,
  caption,
  imageUrl,
  scheduledDate,
  scheduledTime,
  approvalStatus,
  clientComments,
  showApprovalInfo = false,
}: SocialPreviewCardProps) {

  const displayName = accountName || (
    platform === 'facebook'  ? 'Your Facebook Page'
    : platform === 'instagram' ? 'your_instagram'
    : platform === 'twitter'   ? 'Your Twitter'
    : 'Your Account'
  )

  const handle = username
    ? `@${username}`
    : accountName
    ? '@' + accountName.toLowerCase().replace(/\s+/g, '')
    : '@yourhandle'

  // ── Avatar ────────────────────────────────────────────────────────────────────

  const renderAvatar = (size: 'sm' | 'md') => {
    const sizeClass  = size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
    const iconSize   = size === 'md' ? 18 : 14
    const textClass  = size === 'md' ? 'text-sm' : 'text-xs'
    const initial    = accountName ? accountName.charAt(0).toUpperCase() : null

    if (accountAvatarUrl) {
      const ring =
        platform === 'instagram'
          ? 'ring-2 ring-pink-500 ring-offset-1'
          : ''
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${ring}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={accountAvatarUrl} alt={accountName || 'Avatar'} className="w-full h-full object-cover" />
        </div>
      )
    }

    const bgMap: Record<string, string> = {
      facebook:  'bg-blue-600',
      instagram: 'bg-gradient-to-br from-purple-500 to-pink-500',
      twitter:   'bg-sky-400',
      linkedin:  'bg-blue-700',
      tiktok:    'bg-black border-2 border-white',
      youtube:   'bg-red-600',
      threads:   'bg-black',
    }
    const fallbackIcons: Record<string, React.ReactNode> = {
      facebook:  <FacebookIcon  size={iconSize} className="text-white" />,
      instagram: <InstagramIcon size={iconSize} className="text-white" />,
      twitter:   <TwitterIcon   size={iconSize} className="text-white" />,
      linkedin:  <LinkedInIcon  size={iconSize} className="text-white" />,
      tiktok:    <TikTokIcon    size={iconSize} className="text-white" />,
      youtube:   <YouTubeIcon   size={iconSize} className="text-white" />,
      threads:   <ThreadsIcon   size={iconSize} className="text-white" />,
    }

    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${bgMap[platform] || 'bg-gray-500'}`}>
        {initial
          ? <span className={`text-white font-semibold ${textClass}`}>{initial}</span>
          : fallbackIcons[platform]}
      </div>
    )
  }

  // ── Facebook ──────────────────────────────────────────────────────────────────

  const FbGlobe = () => (
    <svg viewBox="0 0 16 16" fill="none" stroke="#65676b" strokeWidth="1.2" strokeLinecap="round" className="w-3.5 h-3.5 flex-shrink-0">
      <circle cx="8" cy="8" r="6.5"/>
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5"/>
      <line x1="1.5" y1="8" x2="14.5" y2="8"/>
      <path d="M2.2 5h11.6M2.2 11h11.6" strokeWidth="1"/>
    </svg>
  )

  const renderFacebookPreview = () => (
    <div
      className="bg-white max-w-sm mx-auto overflow-hidden shadow-sm"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px', lineHeight: '1.3333', color: '#050505' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {renderAvatar('md')}
          <div>
            <div style={{ fontWeight: 600, color: '#050505', fontSize: '15px', lineHeight: '1.3333' }}>{displayName}</div>
            <div className="flex items-center gap-1 leading-tight" style={{ fontSize: '13px', color: '#65676B' }}>
              <span>Just now</span>
              <span>·</span>
              <FbGlobe />
            </div>
          </div>
        </div>
        <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#65676b" className="w-5 h-5">
            <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
          </svg>
        </button>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 pb-3">
          <p style={{ color: '#050505', fontSize: '15px', lineHeight: '1.3333' }} className="whitespace-pre-wrap break-words">{caption}</p>
        </div>
      )}

      {/* Image */}
      {imageUrl ? (
        <div className="flex items-center justify-center bg-gray-50" style={{ maxHeight: '360px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Post" className="w-full object-contain" style={{ maxHeight: '360px' }} />
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y-2 border-dashed border-gray-200">
          <div className="text-center text-gray-400">
            <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
            <p className="text-xs">Image preview</p>
          </div>
        </div>
      )}

      {/* Reactions row */}
      <div className="px-4 py-2 border-t border-[#ced0d4]">
        <div className="flex items-center justify-between" style={{ fontSize: '13px', color: '#65676B' }}>
          <div className="flex items-center gap-1.5">
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
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>Like</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>Comment</span>
          </button>
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

  // ── Instagram ─────────────────────────────────────────────────────────────────

  const renderInstagramPreview = () => (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px', lineHeight: '1.3333', color: '#050505' }}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center">
          {renderAvatar('sm')}
          <div className="ml-2.5">
            <div className="font-semibold text-gray-900 text-sm leading-tight">{displayName}</div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>

      {imageUrl ? (
        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center border-y border-gray-200">
          <div className="text-center text-gray-400">
            <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-40" />
            <p className="text-xs">Image preview</p>
          </div>
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
      </div>
    </div>
  )

  // ── Twitter / X ───────────────────────────────────────────────────────────────

  const renderTwitterPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
      <div className="flex items-start p-3 gap-3">
        {renderAvatar('md')}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{displayName}</span>
            <span className="text-xs text-gray-500">{handle}</span>
          </div>
          {caption && (
            <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words mt-1">{caption}</p>
          )}
          {imageUrl ? (
            <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Post" className="w-full max-h-52 object-cover" />
            </div>
          ) : (
            <div className="mt-2 rounded-2xl bg-gray-100 flex items-center justify-center border border-dashed border-gray-200" style={{ minHeight: '140px' }}>
              <div className="text-center text-gray-400">
                <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Image preview</p>
              </div>
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

  // ── Master renderer ───────────────────────────────────────────────────────────

  const renderPreview = () => {
    switch (platform) {
      case 'facebook':  return renderFacebookPreview()
      case 'instagram': return renderInstagramPreview()
      case 'twitter':   return renderTwitterPreview()
      default:          return renderFacebookPreview()
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-lg">
        {renderPreview()}
      </div>

      {showApprovalInfo && (
        <div className="space-y-2">
          {(scheduledDate || scheduledTime) && (
            <div className="text-xs text-gray-500">
              {scheduledDate && new Date(scheduledDate).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              {scheduledTime && <span> at {scheduledTime.slice(0, 5)}</span>}
            </div>
          )}
          {approvalStatus && (
            <div className={`text-xs px-2 py-1 rounded inline-block ${
              approvalStatus === 'approved'
                ? 'bg-green-100 text-green-700'
                : approvalStatus === 'rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {approvalStatus}
            </div>
          )}
          {clientComments && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <span className="font-medium">Client:</span> {clientComments}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
