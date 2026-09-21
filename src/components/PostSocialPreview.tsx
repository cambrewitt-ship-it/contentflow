'use client';

import { useState } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  TikTokIcon,
  LinkedInIcon,
} from '@/components/social-icons';

const FEED_PLATFORMS = [
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter',   label: 'Twitter / X' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'tiktok',    label: 'TikTok' },
];
const STORY_PLATFORMS = [
  { id: 'fb-stories', label: 'FB Stories' },
  { id: 'ig-stories', label: 'IG Stories' },
];

interface PostSocialPreviewProps {
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  caption: string;
  businessName?: string;
  logoUrl?: string | null;
  mediaUrls?: string[] | null;
}

export function PostSocialPreview({ imageUrl, fileUrl, fileType, caption, businessName = '', logoUrl, mediaUrls }: PostSocialPreviewProps) {
  const isVideo = fileType?.startsWith('video/') && !!fileUrl;
  const mediaUrl = isVideo ? fileUrl! : (imageUrl || null);
  const [platform, setPlatform] = useState('facebook');

  // Carousel state
  const allMedia = mediaUrls && mediaUrls.length > 1 ? mediaUrls : null;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const activeMediaUrl = allMedia ? allMedia[carouselIndex] : mediaUrl;

  const isStory = platform === 'fb-stories' || platform === 'ig-stories';

  const displayName = businessName || (
    platform === 'facebook'     ? 'Your Facebook Page'
    : platform === 'instagram'  ? 'your_instagram'
    : platform === 'twitter'    ? 'Your Twitter'
    : platform === 'linkedin'   ? 'Your Company'
    : platform === 'tiktok'     ? '@yourtiktok'
    : platform === 'fb-stories' ? 'Your Facebook Page'
    : 'your_instagram'
  );

  const handle = businessName
    ? '@' + businessName.toLowerCase().replace(/\s+/g, '')
    : '@yourhandle';

  // ── Avatar ───────────────────────────────────────────────────────────────────
  const renderAvatar = (size: 'sm' | 'md', p?: string) => {
    const plat = p || platform;
    const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
    const iconSize  = size === 'md' ? 18 : 14;
    const textClass = size === 'md' ? 'text-sm' : 'text-xs';
    const initial   = businessName ? businessName.charAt(0).toUpperCase() : null;

    const bgMap: Record<string, string> = {
      facebook:     'bg-blue-600',
      'fb-stories': 'bg-blue-600',
      instagram:    'bg-gradient-to-br from-purple-500 to-pink-500',
      'ig-stories': 'bg-gradient-to-br from-purple-500 to-pink-500',
      twitter:      'bg-sky-400',
      linkedin:     'bg-[#0A66C2]',
      tiktok:       'bg-black border-2 border-white',
    };
    const fallbackIcons: Record<string, React.ReactNode> = {
      facebook:     <FacebookIcon  size={iconSize} className="text-white" />,
      'fb-stories': <FacebookIcon  size={iconSize} className="text-white" />,
      instagram:    <InstagramIcon size={iconSize} className="text-white" />,
      'ig-stories': <InstagramIcon size={iconSize} className="text-white" />,
      twitter:      <TwitterIcon   size={iconSize} className="text-white" />,
      linkedin:     <LinkedInIcon  size={iconSize} className="text-white" />,
      tiktok:       <TikTokIcon    size={iconSize} className="text-white" />,
    };

    if (logoUrl) {
      return (
        <div className={`${sizeClass} rounded-full flex-shrink-0 overflow-hidden bg-gray-100`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={businessName || 'Brand logo'} className="w-full h-full object-cover" />
        </div>
      );
    }

    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${bgMap[plat] || 'bg-gray-500'}`}>
        {initial
          ? <span className={`text-white font-semibold ${textClass}`}>{initial}</span>
          : fallbackIcons[plat]}
      </div>
    );
  };

  // ── Facebook ─────────────────────────────────────────────────────────────────
  const FbGlobe = () => (
    <svg viewBox="0 0 16 16" fill="none" stroke="#65676b" strokeWidth="1.2" strokeLinecap="round" className="w-3.5 h-3.5 flex-shrink-0">
      <circle cx="8" cy="8" r="6.5"/>
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5"/>
      <line x1="1.5" y1="8" x2="14.5" y2="8"/>
      <path d="M2.2 5h11.6M2.2 11h11.6" strokeWidth="1"/>
    </svg>
  );

  const renderFacebook = () => (
    <div className="bg-white max-w-sm mx-auto overflow-hidden shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px', lineHeight: '1.3333', color: '#050505' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {renderAvatar('md', 'facebook')}
          <div>
            <div style={{ fontWeight: 600, color: '#050505', fontSize: '15px' }}>{displayName}</div>
            <div className="flex items-center gap-1" style={{ fontSize: '13px', color: '#65676B' }}>
              <><span>Just now</span><span>·</span><FbGlobe /></>
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="#65676b" className="w-5 h-5"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
        </div>
      </div>
      {caption && <div className="px-4 pb-3"><p style={{ color: '#050505', fontSize: '15px' }} className="whitespace-pre-wrap break-words">{caption}</p></div>}
      {activeMediaUrl ? (
        <div className="relative flex items-center justify-center bg-gray-50" style={{ maxHeight: '360px' }}>
          {isVideo
            ? <video src={activeMediaUrl} controls className="w-full object-contain bg-black" style={{ maxHeight: '360px' }} />
            : /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeMediaUrl} alt="Post" className="w-full object-contain" style={{ maxHeight: '360px' }} />}
          {allMedia && allMedia.length > 1 && (
            <>
              <button onClick={() => setCarouselIndex(i => (i - 1 + allMedia.length) % allMedia.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCarouselIndex(i => (i + 1) % allMedia.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                {allMedia.map((_, i) => (
                  <button key={i} onClick={() => setCarouselIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full ${i === carouselIndex ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y-2 border-dashed border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}
      <div className="px-4 py-2 border-t border-[#ced0d4]">
        <div className="flex items-center justify-between" style={{ fontSize: '13px', color: '#65676B' }}>
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              <div className="w-[18px] h-[18px] rounded-full bg-[#1877f2] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5"><path d="M8 1.5a.5.5 0 01.5.5v1.793l.354-.353a.5.5 0 01.707.707L8 5.707 6.439 4.147a.5.5 0 01.707-.707l.354.353V2a.5.5 0 01.5-.5zM4.864 6.5H3a1.5 1.5 0 000 3h.086l.82 3.276A1 1 0 004.877 14H11a1 1 0 001-1v-2.81l1.243-2.486A1 1 0 0013 7.5h-1.864A2.5 2.5 0 008.5 5h-1a2.5 2.5 0 00-2.636 1.5z"/></svg>
              </div>
              <div className="w-[18px] h-[18px] rounded-full bg-[#f33e58] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>
              </div>
            </div>
            <span>436</span>
          </div>
          <div className="flex items-center gap-3"><span>54 Comments</span><span>8 Shares</span></div>
        </div>
      </div>
      <div className="px-2 py-1 border-t border-[#ced0d4]">
        <div className="flex">
          {[
            { label: 'Like', path: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3' },
            { label: 'Comment', path: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
            { label: 'Share', path: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13' },
          ].map(({ label, path }) => (
            <button key={label} className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-[#f2f2f2] rounded-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="#65676B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><path d={path}/></svg>
              <span style={{ color: '#65676B', fontSize: '13px', fontWeight: 600 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Instagram ─────────────────────────────────────────────────────────────────
  const renderInstagram = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center">
          {renderAvatar('sm', 'instagram')}
          <div className="ml-2.5">
            <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>
      {activeMediaUrl ? (
        <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          {isVideo
            ? <video src={activeMediaUrl} controls className="w-full h-full object-contain bg-black" />
            : /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeMediaUrl} alt="Post" className="w-full h-full object-cover" />}
          {allMedia && allMedia.length > 1 && (
            <>
              <button onClick={() => setCarouselIndex(i => (i - 1 + allMedia.length) % allMedia.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCarouselIndex(i => (i + 1) % allMedia.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                {allMedia.map((_, i) => (
                  <button key={i} onClick={() => setCarouselIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full ${i === carouselIndex ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
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
        {caption && <div className="text-sm"><span className="font-semibold text-gray-900 mr-1">{displayName}</span><span className="text-gray-900 whitespace-pre-wrap break-words">{caption}</span></div>}
      </div>
    </div>
  );

  // ── Twitter ───────────────────────────────────────────────────────────────────
  const renderTwitter = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
      <div className="flex items-start p-3 gap-3">
        {renderAvatar('md', 'twitter')}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{displayName}</span>
            <span className="text-xs text-gray-500">{handle}</span>
          </div>
          {caption && <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words mt-1">{caption}</p>}
          {activeMediaUrl ? (
            <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200 relative">
              {isVideo
                ? <video src={activeMediaUrl} controls className="w-full max-h-52 object-contain bg-black" />
                : /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeMediaUrl} alt="Post" className="w-full max-h-52 object-cover" />}
              {allMedia && allMedia.length > 1 && (
                <>
                  <button onClick={() => setCarouselIndex(i => (i - 1 + allMedia.length) % allMedia.length)}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setCarouselIndex(i => (i + 1) % allMedia.length)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-2 rounded-2xl bg-gray-100 flex items-center justify-center border border-dashed border-gray-200" style={{ minHeight: '140px' }}>
              <div className="text-center text-gray-400"><ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-gray-500 max-w-xs">
            {[
              { d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', n: '104' },
              { d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', n: '78' },
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
  );

  // ── TikTok ────────────────────────────────────────────────────────────
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
  );

  const renderTikTok = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '440px' }}>
      {/* Media */}
      {activeMediaUrl ? (
        isVideo
          ? <video src={activeMediaUrl} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          : /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeMediaUrl} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
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
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          <div className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden"><div className="h-full w-2/3 bg-white/60 rounded-full" /></div>
        </div>
      </div>

      <TikTokNav />
    </div>
  );

  // ── LinkedIn ──────────────────────────────────────────────────────────
  // LinkedIn pages use a square logo rather than a circular avatar
  const renderLinkedInLogo = () => {
    const initial = businessName ? businessName.charAt(0).toUpperCase() : null
    if (logoUrl) {
      return (
        <div className="w-12 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={businessName || 'Logo'} className="w-full h-full object-cover" />
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
  );

  const LinkedInActionIcon = ({ kind }: { kind: 'like' | 'comment' | 'repost' | 'share' }) => {
    const common = { className: 'w-[18px] h-[18px]', fill: 'none', stroke: '#00000099', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
    if (kind === 'like')    return <svg {...common}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
    if (kind === 'comment') return <svg {...common}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
    if (kind === 'repost')  return <svg {...common}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
    return <svg {...common}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
  }

  const renderLinkedIn = () => (
    <div className="bg-white max-w-sm mx-auto overflow-hidden rounded-lg border border-[#e0dfdc] shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: 'rgba(0,0,0,0.9)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-start gap-2 min-w-0">
          {renderLinkedInLogo()}
          <div className="min-w-0 pt-0.5">
            <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.3' }} className="truncate">{displayName}</div>
            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="truncate">
              Your industry
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="flex items-center gap-1">
                <span>1h</span>
                <span>·</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" className="w-3 h-3">
                  <circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="2.8" ry="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/>
                </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <svg viewBox="0 0 20 20" fill="rgba(0,0,0,0.6)" className="w-5 h-5"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" /></svg>
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
      {activeMediaUrl ? (
        <div className="bg-gray-50 flex items-center justify-center" style={{ maxHeight: '300px' }}>
          {isVideo
            ? <video src={activeMediaUrl} controls className="w-full object-contain" style={{ maxHeight: '300px' }} />
            : /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeMediaUrl} alt="Post" className="w-full object-cover" style={{ maxHeight: '300px' }} />}
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y border-dashed border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}

      {/* Link / CTA card — LinkedIn single-image ad unit */}
      
      {/* Social counts */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-1.5">
          <LinkedInReactions />
          <span>139K</span>
        </div>
        <div className="flex items-center gap-2">
          <span>12K comments</span>
          <span>·</span>
          <span></span>
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
  );

  // ── FB Stories ────────────────────────────────────────────────────────────────
  const renderFBStories = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {mediaUrl ? (
        isVideo
          ? <video src={mediaUrl} controls className="absolute inset-0 w-full h-full object-contain" />
          : <img src={mediaUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
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
            <p className="text-white text-xs font-semibold">{displayName}</p>
            <p className="text-white/70 text-[10px]">Just now</p>
          </div>
        </div>
        <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </div>
      {caption && (
        <div className="absolute bottom-20 left-3 right-3">
          <p className="text-white text-xs leading-relaxed text-center drop-shadow-lg">{caption}</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
        <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-2">
          <p className="text-white/60 text-[10px]">Send message...</p>
        </div>
        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
      </div>
    </div>
  );

  // ── IG Stories ────────────────────────────────────────────────────────────────
  const renderIGStories = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {mediaUrl ? (
        isVideo
          ? <video src={mediaUrl} controls className="absolute inset-0 w-full h-full object-contain" />
          : <img src={mediaUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
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
            <p className="text-white text-xs font-semibold">{displayName}</p>
            <p className="text-white/70 text-[10px]">Just now</p>
          </div>
        </div>
        <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </div>
      {caption && (
        <div className="absolute bottom-24 left-3 right-3">
          <p className="text-white text-xs leading-relaxed text-center drop-shadow-lg">{caption}</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
        <div className="flex-1 border border-white/50 rounded-full px-3 py-2">
          <p className="text-white/60 text-[10px]">Send message</p>
        </div>
        <div className="flex gap-1">{['❤️', '😂', '😮'].map((e) => <span key={e} className="text-base">{e}</span>)}</div>
      </div>
    </div>
  );

  const renderPreview = () => {
    switch (platform) {
      case 'facebook':   return renderFacebook();
      case 'instagram':  return renderInstagram();
      case 'twitter':    return renderTwitter();
      case 'linkedin':   return renderLinkedIn();
      case 'tiktok':     return renderTikTok();
      case 'fb-stories': return renderFBStories();
      case 'ig-stories': return renderIGStories();
      default:           return renderFacebook();
    }
  };

  return (
    <div className="space-y-3">
      {/* Platform selector */}
      <div className="space-y-2">
        {/* Feed platforms */}
        <div className="flex flex-wrap gap-1.5">
          {FEED_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                platform === p.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Story platforms */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Stories:</span>
          {STORY_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                platform === p.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className={`${isStory ? '' : 'max-w-sm'} mx-auto`}>
        {renderPreview()}
      </div>
    </div>
  );
}
