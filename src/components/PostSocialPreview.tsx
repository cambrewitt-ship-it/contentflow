'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  TikTokIcon,
} from '@/components/social-icons';

const FEED_PLATFORMS = [
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter',   label: 'Twitter / X' },
  { id: 'tiktok',    label: 'TikTok' },
];
const STORY_PLATFORMS = [
  { id: 'fb-stories', label: 'FB Stories' },
  { id: 'ig-stories', label: 'IG Stories' },
];

interface PostSocialPreviewProps {
  imageUrl?: string | null;
  caption: string;
  businessName?: string;
  logoUrl?: string | null;
}

export function PostSocialPreview({ imageUrl, caption, businessName = '', logoUrl }: PostSocialPreviewProps) {
  const [platform, setPlatform] = useState('facebook');
  const [isAdvert, setIsAdvert] = useState(false);

  const isStory = platform === 'fb-stories' || platform === 'ig-stories';

  const displayName = businessName || (
    platform === 'facebook'     ? 'Your Facebook Page'
    : platform === 'instagram'  ? 'your_instagram'
    : platform === 'twitter'    ? 'Your Twitter'
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
      tiktok:       'bg-black border-2 border-white',
    };
    const fallbackIcons: Record<string, React.ReactNode> = {
      facebook:     <FacebookIcon  size={iconSize} className="text-white" />,
      'fb-stories': <FacebookIcon  size={iconSize} className="text-white" />,
      instagram:    <InstagramIcon size={iconSize} className="text-white" />,
      'ig-stories': <InstagramIcon size={iconSize} className="text-white" />,
      twitter:      <TwitterIcon   size={iconSize} className="text-white" />,
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
              {isAdvert ? <><span>Sponsored</span><span>·</span><FbGlobe /></> : <><span>Just now</span><span>·</span><FbGlobe /></>}
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="#65676b" className="w-5 h-5"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
        </div>
      </div>
      {caption && <div className="px-4 pb-3"><p style={{ color: '#050505', fontSize: '15px' }} className="whitespace-pre-wrap break-words">{caption}</p></div>}
      {imageUrl ? (
        <div className="flex items-center justify-center bg-gray-50" style={{ maxHeight: '360px' }}>
          <img src={imageUrl} alt="Post" className="w-full object-contain" style={{ maxHeight: '360px' }} />
        </div>
      ) : (
        <div className="h-44 bg-gray-100 flex items-center justify-center border-y-2 border-dashed border-gray-200">
          <div className="text-center text-gray-400"><ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" /><p className="text-xs">Image preview</p></div>
        </div>
      )}
      {isAdvert && (
        <div className="border-t border-gray-200 bg-[#f0f2f5] px-3 py-2.5 flex items-center justify-between gap-3">
          <div><p style={{ fontSize: '11px', color: '#65676B' }} className="uppercase tracking-wide">yourwebsite.com</p></div>
          <button style={{ color: '#050505', fontSize: '13px', fontWeight: 600 }} className="bg-[#e4e6eb] px-3 py-1.5 rounded-[6px]">Learn More</button>
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
            {isAdvert && <div className="text-xs text-gray-400">Sponsored</div>}
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>
      {imageUrl ? (
        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
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
            {isAdvert && <span className="ml-auto text-xs text-gray-400">Promoted</span>}
          </div>
          {caption && <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words mt-1">{caption}</p>}
          {imageUrl ? (
            <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200">
              <img src={imageUrl} alt="Post" className="w-full max-h-52 object-cover" />
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

  // ── TikTok ────────────────────────────────────────────────────────────────────
  const renderTikTok = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {imageUrl ? (
        <img src={imageUrl} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
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
      {isAdvert && <div className="absolute top-9 left-3"><span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/30">Sponsored</span></div>}
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
      </div>
      <div className="absolute bottom-0 left-0 right-12 p-3 space-y-1.5">
        <p className="text-white text-sm font-bold">{displayName}</p>
        {caption && <p className="text-white/90 text-xs leading-relaxed line-clamp-2">{caption}</p>}
        <div className="flex items-center gap-1 pt-0.5">
          <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          <p className="text-white/70 text-[10px] truncate">Original Sound · {displayName}</p>
        </div>
      </div>
    </div>
  );

  // ── FB Stories ────────────────────────────────────────────────────────────────
  const renderFBStories = () => (
    <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '420px' }}>
      {imageUrl ? (
        <img src={imageUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
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
            {isAdvert ? <p className="text-white/70 text-[10px]">Sponsored</p> : <p className="text-white/70 text-[10px]">Just now</p>}
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
      {imageUrl ? (
        <img src={imageUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
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
            {isAdvert ? <p className="text-white/70 text-[10px]">Sponsored</p> : <p className="text-white/70 text-[10px]">Just now</p>}
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
        {/* Organic / Paid toggle */}
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Type:</span>
          <button
            type="button"
            onClick={() => setIsAdvert(false)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              !isAdvert ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Organic
          </button>
          <button
            type="button"
            onClick={() => setIsAdvert(true)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              isAdvert ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Paid / Ad
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className={`${isStory ? '' : 'max-w-sm'} mx-auto`}>
        {renderPreview()}
      </div>
    </div>
  );
}
