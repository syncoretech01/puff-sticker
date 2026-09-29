import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The SEO contract owns a finite one-hop 301 surface. Disabling Next's
  // blanket normalization prevents unknown slashless URLs becoming chains.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/sitemap.xml',
          destination: '/seo-internal/sitemap-redirect',
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async headers() {
    const rules = [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          {
            key: 'Content-Security-Policy',
            value: 'base-uri \'none\'; frame-ancestors \'none\'; object-src \'none\'',
          },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ]

    if (process.env.VERCEL_ENV === 'preview') {
      rules.push({
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      })
    }
    return rules
  },
}

export default nextConfig
