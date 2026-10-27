import { execSync } from 'node:child_process'
import type { NextConfig } from 'next'
import pkg from './package.json'

// The commit being built: Vercel provides it; locally it comes from git (blank outside a checkout).
function commitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false, // the dev badge sits on top of the player controls
  // Build details for the version tag under the navbar logo, fixed when the app is built.
  env: {
    APP_VERSION: pkg.version,
    APP_COMMIT: commitSha().slice(0, 7),
    // Vercel's production / preview; otherwise how it was built (next build vs next dev).
    APP_ENV: process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    APP_BUILT_AT: new Date().toISOString(),
  },
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
