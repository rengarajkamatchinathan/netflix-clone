// Shared by the app and the server so both derive the same ids.
import type { Video } from './types'

export function hash(s: string): number { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export const slug = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// "videos" may be a list of URLs or of { title, url } objects.
export const toVideos = (list: unknown): Video[] => (Array.isArray(list) ? list : [])
  .map((v): Video => (typeof v === 'string'
    ? { url: v.trim(), title: null }
    : { url: String(v?.url ?? '').trim(), title: typeof v?.title === 'string' && v.title.trim() ? v.title.trim() : null }))
  .filter(v => v.url)

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
