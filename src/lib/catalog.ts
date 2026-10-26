// Turns the catalog from /api/catalog into what the app displays, plus the live-channel schedule.
// Everything here is a pure function of a Catalog, so it is safe on the server and in the browser.
import { hash, youtubeId } from './ids'
import type { Bumper, CatalogData, RawChannel, RawTitle, TitleType, Video } from './types'

export { hash, youtubeId }

const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
const KIDS_RATINGS = ['U', 'U/A 7+']
const ADULT_RATINGS = ['U/A 13+', 'U/A 16+']
const DEFAULT_COLORS = { bg: '#141414', accent: '#e50914', accent2: '#ffffff' }

export interface Title {
  id: string
  name: string
  type: TitleType
  genre: string
  synopsis: string
  year: number | null
  order: number
  channels: string[]
  channel: string | null
  category: string | null
  maturity: string
  match: number
  seasons: number
  duration?: string
  hue: number
  needsReview: boolean
  image: string | null
  link: string | null
  poster: string | null
  videos: Video[]
  hasMedia: boolean
  videoUrl: string
  isNew: boolean
}

export interface Channel {
  id: string
  name: string
  tagline: string
  order: number
  bg: string
  accent: string
  accent2: string
  titleIds: string[]
  image: string | null
  bumpers: Bumper[]
}

export interface Catalog {
  titles: Title[] // what this profile may browse (kids profiles: channel shows only)
  byId: Record<string, Title> // every title, so lists and progress still resolve
  channels: Channel[]
  channelById: Record<string, Channel>
  channelNames: Record<string, string>
}

function toTitle(s: RawTitle, i: number): Title {
  const h = hash(s.id)
  const videos = (s.videos || []).filter(v => v?.url)
  return {
    id: s.id,
    name: s.title,
    type: s.type || 'tv',
    genre: s.genre || 'Kids',
    synopsis: s.synopsis || '',
    year: s.year ?? null,
    order: i,
    channels: s.channels,
    channel: s.channels[0] || null,
    category: s.category || null,
    maturity: s.maturity || (s.channels.length ? KIDS_RATINGS : ADULT_RATINGS)[h % 2],
    match: 80 + (h % 19),
    seasons: 0,
    hue: h % 360,
    needsReview: !!s.needsReview,
    image: s.image || null,
    link: s.link || null,
    poster: s.poster || null,
    videos,
    hasMedia: videos.length > 0,
    videoUrl: videos[0]?.url || SAMPLE,
    isNew: (s.year ?? 0) >= 2010 || i % 9 === 0,
  }
}

function toChannel(c: RawChannel): Channel {
  return {
    id: c.id,
    name: c.name || c.id,
    tagline: c.tagline || '',
    order: c.order ?? 999,
    ...DEFAULT_COLORS,
    ...c.colors,
    titleIds: c.titleIds || [],
    image: c.image,
    bumpers: (c.bumpers || []).map(youtubeId).filter((id): id is string => !!id).map((ytId): Bumper => ({ kind: 'youtube', ytId })),
  }
}

export function buildCatalog(data: CatalogData, kidsOnly = false): Catalog {
  const all = data.titles.map(toTitle)
  // Channels with no shows have nothing to air, so viewers don't see them.
  const channels = data.channels.filter(c => !c.hidden && c.titleIds.length).map(toChannel)
  return {
    titles: kidsOnly ? all.filter(t => t.channels.length) : all,
    byId: Object.fromEntries(all.map(t => [t.id, t])),
    channels,
    channelById: Object.fromEntries(channels.map(c => [c.id, c])),
    channelNames: Object.fromEntries(channels.map(c => [c.id, c.name])),
  }
}

/* ---------- Episodes ---------- */

export interface Episode { n: number; name: string; minutes: number | null; blurb: string; url: string }

// Real episodes come from the show's "videos" links; otherwise six placeholder episodes.
export function episodesFor(t: Title): Episode[] {
  if (t.type !== 'tv') return []
  if (t.videos.length) {
    return t.videos.map((v, i) => ({ n: i + 1, name: v.title || `Episode ${i + 1}`, minutes: null, blurb: '', url: v.url }))
  }
  return Array.from({ length: 6 }, (_, i) => ({
    n: i + 1, name: `Episode ${i + 1}`, minutes: 20 + ((hash(t.id) + i * 7) % 25),
    blurb: `${t.name}, episode ${i + 1}.`, url: SAMPLE,
  }))
}

/* ---------- Browse rows and search ---------- */

export interface RowData { title: string; items: Title[]; top10?: boolean }

const shuffle = (arr: Title[], seed: string) => [...arr].sort((a, b) => (hash(a.id + seed) % 1000) - (hash(b.id + seed) % 1000))
const decade = (pool: Title[], from: number, to: number) => pool.filter(t => t.year && t.year >= from && t.year < to)

export function rowsFor(cat: Catalog, type?: string): RowData[] {
  const { titles } = cat
  const pool = !type ? titles : type === 'new' ? titles.filter(t => t.isNew) : titles.filter(t => t.type === type)
  const count = (g: string) => pool.filter(t => t.genre === g).length
  const genres = [...new Set(pool.map(t => t.genre))].sort((a, b) => count(b) - count(a))
  const rows: RowData[] = [
    { title: 'Trending Now', items: shuffle(pool, 'trend').slice(0, 24) },
    { title: 'Top 10 Today', items: shuffle(pool, 'top').slice(0, 10), top10: true },
    { title: 'Ready to Watch', items: pool.filter(t => t.hasMedia) },
    { title: '90s Classics', items: shuffle(decade(pool, 1990, 2000), '90s') },
    { title: '2000s Throwbacks', items: shuffle(decade(pool, 2000, 2010), '00s') },
    { title: 'Sitcoms', items: pool.filter(t => t.category === 'Series') },
    { title: 'Golden Age Cartoons', items: decade(pool, 1900, 1990).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)) },
    { title: 'New Releases', items: shuffle(pool.filter(t => t.isNew), 'new') },
    ...genres.filter(g => g !== 'Sitcom').slice(0, 6).map(g => ({ title: `${g} Picks`, items: shuffle(pool.filter(t => t.genre === g), g) })),
  ]
  return rows.filter(r => r.items.length)
}

export function search(cat: Catalog, q: string): Title[] {
  q = q.trim().toLowerCase()
  if (!q) return []
  return cat.titles.filter(t => [t.name, t.genre, ...t.channels.map(c => cat.channelNames[c] || c), t.category || '', String(t.year || '')]
    .some(f => f.toLowerCase().includes(q)))
}

/* ---------- Live channels ---------- */

export const channelTitles = (cat: Catalog, id: string): Title[] =>
  (cat.channelById[id]?.titleIds || []).map(t => cat.byId[t]).filter(Boolean)

// Fake 24h schedule: 22-minute slots cycling through the channel's shows.
export const SLOT_MIN = 22

export function nowPlaying(cat: Catalog, id: string, now = new Date()) {
  const list = channelTitles(cat, id)
  const mins = now.getHours() * 60 + now.getMinutes()
  const slot = Math.floor(mins / SLOT_MIN)
  const at = (k: number) => list[(slot + k) % list.length]
  return { slot, current: at(0), next: at(1), later: at(2), offsetSec: (mins % SLOT_MIN) * 60 + now.getSeconds() }
}

export const showAt = (cat: Catalog, id: string, slot: number): Title => {
  const list = channelTitles(cat, id)
  return list[((slot % list.length) + list.length) % list.length]
}

// Which episode a channel airs for a show in a given slot.
export function airedVideo(t: Title, slot: number): string {
  if (!t.videos.length) return t.videoUrl
  return t.videos[hash(`${t.id}:${slot}`) % t.videos.length].url
}

// Random bumper; when the channel has more than one, never the same as `previous`.
export function randomBumper(c: Channel, previous: Bumper | null = null): Bumper | null {
  if (!c.bumpers.length) return null
  const pool = c.bumpers.length > 1 ? c.bumpers.filter(b => b !== previous) : c.bumpers
  return pool[Math.floor(Math.random() * pool.length)]
}
