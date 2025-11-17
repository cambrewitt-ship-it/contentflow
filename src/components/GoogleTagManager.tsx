'use client';

import { useEffect } from 'react';
import Script from 'next/script';

interface GoogleTagManagerProps {
  gtmId: string;
}

/**
 * Google Tag Manager Component
 * 
 * This component loads Google Tag Manager (GTM) which can manage:
 * - Google Analytics 4 (GA4)
 * - Facebook Pixel
 * - LinkedIn Insight Tag
 * - Other marketing/analytics tags
 * 
 * @param gtmId - Your GTM Container ID (format: GTM-XXXXXXX)
 */
export function GoogleTagManager({ gtmId }: GoogleTagManagerProps) {
  useEffect(() => {
    // Initialize dataLayer if it doesn't exist
    if (typeof window !== 'undefined' && !window.dataLayer) {
      window.dataLayer = [];
    }
  }, []);

  if (!gtmId || gtmId === '') {
    console.warn('GTM ID not provided. Google Tag Manager will not be loaded.');
    return null;
  }

  return (
    <>
      {/* Google Tag Manager Script */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />
    </>
  );
}

/**
 * Google Tag Manager NoScript Component
 * 
 * This is a fallback for users with JavaScript disabled.
 * Should be placed immediately after the opening <body> tag.
 */
export function GoogleTagManagerNoScript({ gtmId }: GoogleTagManagerProps) {
  if (!gtmId || gtmId === '') {
    return null;
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}

// Extend Window interface to include dataLayer
declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

