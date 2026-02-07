import type { NextConfig } from "next";

/**
 * Next.js Configuration
 * 
 * IMPORTANT NOTES FOR VERCEL FREE TIER:
 * - Serverless functions have a 10s default timeout (can extend to 60s)
 * - Body size limit is 4.5MB for serverless functions
 * - Use Supabase Storage for file uploads to bypass this limit
 * 
 * For PDF generation routes, use:
 *   export const maxDuration = 60;
 * at the top of the route file to extend timeout.
 */
const nextConfig: NextConfig = {
  // Disable X-Powered-By header (minor security & bytes-on-wire win)
  poweredByHeader: false,

  // Skip server-side gzip — Vercel/CDN handles compression at the edge
  compress: false,

  // Keep heavy server-only packages out of the bundled server JS so they
  // are require()-d at runtime instead.  Reduces cold-start parse time.
  serverExternalPackages: ['pdf-lib', '@pdf-lib/fontkit'],

  /**
   * Server Actions Configuration
   * 
   * bodySizeLimit: Maximum request body size for Server Actions.
   * Default is 1MB, which is sufficient for most form data.
   * 
   * IMPORTANT: For large file uploads (PDFs > 1MB):
   * - DO NOT increase bodySizeLimit beyond Vercel's 4.5MB limit
   * - Instead, use client-side upload directly to Supabase Storage
   * - This bypasses the serverless function entirely
   * 
   * The workflow for template uploads should be:
   * 1. Client uploads PDF to Supabase Storage (no size limit)
   * 2. Client receives the storage URL
   * 3. Server Action saves metadata (template name, storage URL) to database
   */
  experimental: {
    serverActions: {
      // 1MB body size limit for Server Actions
      // Sufficient for form data; files go directly to Supabase Storage
      bodySizeLimit: '1mb',
      
      // Allowed origins for Server Actions (CSRF protection)
      // Add your production domain when deploying
      // allowedOrigins: ['your-domain.vercel.app'],
    },
  },

  /**
   * Image Optimization Configuration
   * 
   * remotePatterns: Allow images from Supabase Storage
   * This is required for next/image to optimize images from your Supabase bucket
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  /**
   * Headers Configuration
   * 
   * Security headers for production deployment
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
