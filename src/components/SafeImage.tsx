'use client'

import { useState } from 'react'

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  placeholderBgColor?: string;
  placeholderIconColor?: string;
}

export function SafeImage({ 
  src, 
  alt, 
  className = '', 
  placeholderBgColor = 'bg-gray-200',
  placeholderIconColor = 'text-gray-400'
}: SafeImageProps) {
  const [imageError, setImageError] = useState(false);

  // If no src or image failed to load, show placeholder
  if (!src || imageError) {
    return (
      <div className={`w-full h-full ${placeholderBgColor} flex items-center justify-center`}>
        <svg className={`w-3 h-3 ${placeholderIconColor}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImageError(true)}
    />
  );
}

