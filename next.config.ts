import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The SEO contract owns a finite one-hop 301 surface. Disabling Next's
  // blanket normalization prevents unknown slashless URLs becoming chains.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
