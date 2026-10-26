import type { NextRequest } from 'next/server'
import { one } from '@/server/db'

// Serves a channel's uploaded logo. The URL carries ?v=<updated time>, so it can be cached for good.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const row = await one<{ logo: Buffer | null; logo_type: string | null }>('select logo, logo_type from channels where id = $1', [id])
  if (!row?.logo || !row.logo_type) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.logo), {
    headers: {
      'Content-Type': row.logo_type,
      'Content-Length': String(row.logo.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // SVG logos can contain script; this stops it running if the image is opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  })
}
