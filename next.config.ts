import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false, // the dev badge sits on top of the player controls
  images: {
    // Show images are links an admin pastes from anywhere on the web, so any host is allowed. The
    // optimiser resizes them to the size they're drawn at and serves AVIF/WebP.
    remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
    // Image links rarely change their picture, so keep optimised copies for a week.
    minimumCacheTTL: 7 * 24 * 3600,
    maximumRedirects: 3,
  },
}

export default nextConfig
