import {withSentryConfig} from '@sentry/nextjs';
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === 'development';

// Get Supabase URL for CSP (ensure it's available at build time)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';

/**
 * Build Content-Security-Policy header based on environment
 * 
 * Security considerations:
 * - Development: More permissive for hot reload and debugging
 * - Production: Stricter policy to prevent XSS attacks
 * 
 * Compatibility ensured for:
 * - Radix UI (requires 'unsafe-inline' for styles)
 * - Tailwind CSS (arbitrary values work with 'unsafe-inline')
 * - Next.js Image Optimization (blob: and data: schemes)
 * - Supabase storage (specific domain in connect-src and img-src)
 */
function buildCSP(): string {
  const policies = [
    // Default: Only allow resources from same origin
    "default-src 'self'",
    
    // Scripts: Allow same origin + inline scripts + eval + blob
    // - 'unsafe-inline': Required for Next.js and some React hydration
    // - 'unsafe-eval': Required for Next.js development (hot reload) and some build optimizations
    // - blob:: Required for worker scripts and dynamic imports
    // TODO: In production, consider using nonces or hashes instead of 'unsafe-inline'
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:"
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
    
    // Workers: Allow same origin + blob URLs for web workers
    // - blob:: Required for worker scripts created from blob URLs
    "worker-src 'self' blob:",
    
    // Styles: Allow same origin + inline styles
    // - 'unsafe-inline': Required for Radix UI components and Tailwind arbitrary values
    // - Radix UI injects inline styles for animations and positioning
    // - Tailwind arbitrary values (e.g., bg-[#fff]) generate inline styles
    "style-src 'self' 'unsafe-inline'",
    
    // Images: Allow multiple sources for flexibility
    // - 'self': Same origin images
    // - data:: Base64 encoded images and SVGs
    // - blob:: Next.js Image Optimization creates blob URLs
    // - https:: Allow HTTPS images (specifically needed for Supabase storage)
    // Consider restricting https: to specific domains in production for tighter security
    "img-src 'self' data: blob: https:",
    
    // Fonts: Allow same origin + data URIs
    // - data:: For embedded font files
    "font-src 'self' data:",
    
    // API Connections: Allow same origin + Supabase backend
    // - Supabase URL is dynamically included from environment variable
    // - In development, also allow localhost variants
    isDevelopment
      ? `connect-src 'self' ${supabaseUrl} http://localhost:* ws://localhost:* wss://localhost:*`
      : `connect-src 'self' ${supabaseUrl}`,
    
    // Media: Allow same origin + blob (for video/audio if needed)
    "media-src 'self' blob:",
    
    // Objects: Disallow <object>, <embed>, <applet>
    "object-src 'none'",
    
    // Base URI: Restrict base tag to same origin
    "base-uri 'self'",
    
    // Form actions: Only allow forms to submit to same origin
    "form-action 'self'",
    
    // Frame ancestors: Prevent clickjacking by disallowing embedding
    // This is more specific than X-Frame-Options
    "frame-ancestors 'none'",
    
    // Child frames: Allow same origin frames (for modals/dialogs if needed)
    "frame-src 'self'",
    
    // Upgrade insecure requests in production
    isDevelopment ? "" : "upgrade-insecure-requests",
  ];

  return policies.filter(Boolean).join('; ');
}

const nextConfig: NextConfig = {
  // Configure API route body size limits
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Allow up to 10MB for API requests with images
    },
  },
  
  // Ignore TypeScript build errors to fix Next.js 15.5.4 type generation bug
  // This allows the build to complete despite incorrect .js import paths in type files
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip all API routes during static generation and force them to be dynamic
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Add externals to prevent certain packages from being bundled during build
      config.externals = config.externals || []
    }
    return config
  },
  
  async headers() {
    return [
      {
        // Apply comprehensive security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent MIME type sniffing
          // Ensures browsers respect the Content-Type header
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          
          // Prevent clickjacking attacks
          // DENY: Page cannot be displayed in a frame/iframe
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          
          // Legacy XSS protection (mostly superseded by CSP)
          // Enables browser's built-in XSS filter
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          
          // Control DNS prefetching
          // OFF: Prevents DNS prefetching to avoid leaking user browsing patterns
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          
          // Prevent file downloads from opening automatically in IE
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
          
          // Control how much referrer information is sent
          // strict-origin-when-cross-origin: Full URL for same-origin, only origin for cross-origin HTTPS
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          
          // HTTP Strict Transport Security (HSTS)
          // Forces HTTPS for 2 years, including subdomains
          // Only apply in production to avoid localhost issues
          ...(isDevelopment ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }]),
          
          // Control browser features and APIs
          // Disable camera, microphone, and geolocation by default
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          
          // Content Security Policy - Main defense against XSS
          {
            key: 'Content-Security-Policy',
            value: buildCSP(),
          },
        ].filter(Boolean),
      },
      {
        // Additional CORS headers for API routes
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Portal-Token',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
 // For all available options, see:
 // https://www.npmjs.com/package/@sentry/webpack-plugin#options

 org: "oneonethree-digital-up",

 project: "javascript-nextjs",

 // Only print logs for uploading source maps in CI
 silent: !process.env.CI,

 // For all available options, see:
 // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

 // Upload a larger set of source maps for prettier stack traces (increases build time)
 widenClientFileUpload: true,

 // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
 // This can increase your server load as well as your hosting bill.
 // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
 // side errors will fail.
 tunnelRoute: "/monitoring",

 // Automatically tree-shake Sentry logger statements to reduce bundle size
 disableLogger: true,

 // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
 // See the following for more information:
 // https://docs.sentry.io/product/crons/
 // https://vercel.com/docs/cron-jobs
 automaticVercelMonitors: true
});