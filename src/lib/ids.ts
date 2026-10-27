// Shared by the app and the server so both derive the same ids and shapes.
import type { ImageCrop, ImageCrops, ImageKind, Video } from './types'

export function hash(s: string): number { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export const slug = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// "videos" may be a list of URLs or of { title, url } objects.
export const toVideos = (list: unknown): Video[] => (Array.isArray(list) ? list : [])
  .map((v): Video => (typeof v === 'string'
    ? { url: v.trim(), title: null }
    : { url: String(v?.url ?? '').trim(), title: typeof v?.title === 'string' && v.title.trim() ? v.title.trim() : null }))
  .filter(v => v.url)

export const DEFAULT_CROP: ImageCrop = { fit: 'cover', zoom: 1, x: 50, y: 50 }

// A card crop with its numbers clamped and rounded; null when it's the default.
export function toCrop(v: unknown): ImageCrop | null {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const num = (n: unknown, min: number, max: number, d: number, per: number) => {
    const x = Number(n)
    return Number.isFinite(x) ? Math.round(Math.min(max, Math.max(min, x)) * per) / per : d
  }
  const c: ImageCrop = { fit: o.fit === 'contain' ? 'contain' : 'cover', zoom: num(o.zoom, 1, 3, 1, 100), x: num(o.x, 0, 100, 50, 10), y: num(o.y, 0, 100, 50, 10) }
  return Object.entries(DEFAULT_CROP).every(([k, d]) => c[k as keyof ImageCrop] === d) ? null : c
}

export const IMAGE_KINDS: ImageKind[] = ['image', 'poster', 'backdrop']

// Crops for each of a show's images, keeping only the ones that aren't the default; null when none are left.
export function toCrops(v: unknown): ImageCrops | null {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const out: ImageCrops = {}
  for (const k of IMAGE_KINDS) { const c = toCrop(o[k]); if (c) out[k] = c }
  return Object.keys(out).length ? out : null
}

// Video id from youtu.be/…, youtube.com/watch?v=…, /shorts/…, /embed/… or a bare 11-char id.
export function youtubeId(link: unknown): string | null {
  if (typeof link !== 'string') return null
  const s = link.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^(www|m|music)\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      return u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] || null
    }
  } catch {}
  return null
}
