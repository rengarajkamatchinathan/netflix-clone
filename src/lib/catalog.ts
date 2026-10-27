// Turns the catalog from /api/catalog into what the app displays, plus the live-channel schedule.
// Everything here is a pure function of a Catalog, so it is safe on the server and in the browser.
import { hash, youtubeId } from './ids'
import type { Bumper, CatalogData, ImageCrops, RawChannel, RawTitle, ScheduleBlock, TitleType, TitleViewers, Video } from './types'

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
  backdrop: string | null
  crops: ImageCrops
  videos: Video[]
  hasMedia: boolean
  videoUrl: string
  viewers: TitleViewers
  addedAt: string | null
  episodesAt: string | null
  isNew: boolean // episodes added in the last 14 days ("New Episodes" ribbon)
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
  top10: string[]
  image: string | null
  bumpers: Bumper[]
  schedule: ScheduleBlock[]
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
    backdrop: s.backdrop || null,
    crops: s.crops || {},
    videos,
    hasMedia: videos.length > 0,
    videoUrl: videos[0]?.url || SAMPLE,
    viewers: s.viewers || { day: 0, week: 0, prev: 0 },
    addedAt: s.addedAt || null,
    episodesAt: s.episodesAt || null,
    isNew: !!s.episodesAt && Date.now() - Date.parse(s.episodesAt) < 14 * 86400000,
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
    top10: c.top10 || [],
    image: c.image,
    bumpers: (c.bumpers || []).map(youtubeId).filter((id): id is string => !!id).map((ytId): Bumper => ({ kind: 'youtube', ytId })),
    schedule: [...(c.schedule || [])].sort((a, b) => a.start - b.start),
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

// A browse row. `onNow` is the live channels strip, drawn by the page instead of as title cards.
export interface RowData { title: string; items: Title[]; top10?: boolean; resume?: boolean; link?: string; onNow?: boolean }

const DAY_MS = 86400000
const within = (iso: string | null, days: number) => !!iso && Date.now() - Date.parse(iso) < days * DAY_MS
const shuffle = (arr: Title[], seed: string) => [...arr].sort((a, b) => (hash(a.id + seed) % 1000) - (hash(b.id + seed) % 1000))
// A stable order that changes once a day, for rows with no ranking of their own.
const daily = (arr: Title[], seed: string) => shuffle(arr, seed + new Date().toDateString())
const ids = (list: Title[]) => new Set(list.map(t => t.id))

// The channels' own Top 10s taken in turn (every #1, then every #2, …): what to show while there
// aren't enough plays to rank by.
function channelPicks(cat: Catalog, pool: Set<string>): Title[] {
  const out: string[] = []
  for (let i = 0; i < 10; i++) for (const c of cat.channels) { const id = c.top10[i]; if (id && pool.has(id)) out.push(id) }
  return [...new Set(out)].map(id => cat.byId[id])
}

// "Top 10 Today": most viewers in the last day, then in the last week, then the channels' Top 10s.
export function topToday(cat: Catalog, pool: Title[] = cat.titles): Title[] {
  const played = pool.filter(t => t.viewers.week > 0).sort((a, b) => b.viewers.day - a.viewers.day || b.viewers.week - a.viewers.week)
  return [...new Set([...played, ...channelPicks(cat, ids(pool)), ...daily(pool, 'top')])].slice(0, 10)
}

// "Trending Now": most viewers this week, with a bonus for gaining viewers on the week before; then
// new arrivals, the channels' Top 10s and a daily pick of the rest (skipping what Top 10 Today shows).
function trending(cat: Catalog, pool: Title[], top: Title[]): Title[] {
  const score = (t: Title) => t.viewers.week + Math.max(0, t.viewers.week - t.viewers.prev)
  const played = pool.filter(t => t.viewers.week > 0).sort((a, b) => score(b) - score(a))
  const inTop = ids(top)
  const fill = [...newReleases(pool), ...channelPicks(cat, ids(pool)), ...daily(pool, 'trend')].filter(t => !inTop.has(t.id))
  return [...new Set([...played, ...fill])].slice(0, 20)
}

// Added (or published) in the last 30 days, newest first.
const newReleases = (pool: Title[]) => pool.filter(t => within(t.addedAt, 30)).sort((a, b) => Date.parse(b.addedAt!) - Date.parse(a.addedAt!))

type Viewing = { recent: string[]; progress: Record<string, number>; list: string[] }

// Episodes added in the last 14 days; shows this profile follows (My List or played) first.
function newEpisodes(pool: Title[], v: Viewing): Title[] {
  const mine = new Set([...v.list, ...v.recent])
  return pool.filter(t => t.isNew).sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || Date.parse(b.episodesAt!) - Date.parse(a.episodesAt!))
}

// "More from <channel>": the channel this profile has played most (recent plays count more),
// with the shows on it they haven't played, in its Top 10 order then line-up order.
function favouriteChannel(cat: Catalog, v: Viewing, pool: Set<string>): RowData | null {
  const weight: Record<string, number> = {}
  v.recent.forEach((id, i) => cat.byId[id]?.channels.forEach(c => { weight[c] = (weight[c] || 0) + 1 / (i + 1) }))
  const c = cat.channels.filter(c => weight[c.id]).sort((a, b) => weight[b.id] - weight[a.id])[0]
  if (!c) return null
  const seen = new Set(v.recent)
  const items = [...new Set([...c.top10, ...c.titleIds])].filter(id => !seen.has(id) && pool.has(id)).map(id => cat.byId[id])
  return { title: `More from ${c.name}`, items, link: `/channel/${c.id}` }
}

// Every row of the home page (no type), the TV Shows / Films pages (type 'tv' / 'movie') and
// New & Popular ('new'), in display order. Rows with nothing in them are left out.
export function rowsFor(cat: Catalog, v: Viewing, type?: string): RowData[] {
  const pool = !type || type === 'new' ? cat.titles : cat.titles.filter(t => t.type === type)
  const inPool = ids(pool)
  const mine = (list: Title[]) => list.filter(t => inPool.has(t.id))
  const top = topToday(cat, pool)
  const because = becauseYouWatched(cat, v)
  const myList = mine(v.list.map(id => cat.byId[id]).filter(Boolean))
  const rows: (RowData | null)[] = type === 'new'
    ? [
        { title: 'New Episodes', items: newEpisodes(pool, v) },
        { title: 'New Releases', items: newReleases(pool) },
        { title: 'Trending Now', items: trending(cat, pool, top) },
        { title: 'Top 10 Today', items: top, top10: true },
      ]
    : [
        { title: `Continue Watching`, items: mine(continueWatching(cat, v)), resume: true },
        !type ? { title: 'On Now', items: [], onNow: true } : null,
        { title: 'Trending Now', items: trending(cat, pool, top) },
        because && { title: `Because You Watched ${because.source.name}`, items: mine(because.items) },
        { title: 'Top 10 Today', items: top, top10: true },
        { title: 'New Episodes', items: newEpisodes(pool, v) },
        { title: 'My List', items: myList, link: '/my-list' },
        { title: 'New Releases', items: newReleases(pool) },
        favouriteChannel(cat, v, inPool),
        { title: 'Throwbacks', items: daily(pool.filter(t => t.year && t.year < 2005), 'throwback') },
      ]
  return rows.filter((r): r is RowData => !!r && (r.onNow ? cat.channels.length > 0 : r.items.length > 0))
}

export function search(cat: Catalog, q: string): Title[] {
  q = q.trim().toLowerCase()
  if (!q) return []
  return cat.titles.filter(t => [t.name, t.genre, ...t.channels.map(c => cat.channelNames[c] || c), t.category || '', String(t.year || '')]
    .some(f => f.toLowerCase().includes(q)))
}

// Edit distance between two strings (for "did you mean").
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

// While typing: channels, genres and titles with a word starting with the query. When nothing
// matches: titles that are a typo or two away ("did you mean").
export function searchSuggestions(cat: Catalog, q: string): { related: string[]; didYouMean: Title[] } {
  q = q.trim().toLowerCase()
  if (q.length < 2) return { related: [], didYouMean: [] }
  const startsWord = (s: string) => s.toLowerCase() !== q && s.toLowerCase().split(/[^a-z0-9]+/).some(w => w.startsWith(q))
  const pool = [...cat.channels.map(c => c.name), ...new Set(cat.titles.map(t => t.genre)), ...cat.titles.map(t => t.name)]
  const related = [...new Set(pool.filter(startsWord))].slice(0, 8)
  if (q.length < 3 || search(cat, q).length) return { related, didYouMean: [] }
  const limit = q.length >= 6 ? 2 : 1
  const score = (t: Title) => {
    const name = t.name.toLowerCase()
    return Math.min(distance(q, name), distance(q, name.slice(0, q.length)), ...name.split(/\s+/).map(w => distance(q, w)))
  }
  const didYouMean = cat.titles.map(t => ({ t, d: score(t) })).filter(x => x.d <= limit).sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.t)
  return { related, didYouMean }
}

/* ---------- Live channels ---------- */

export const channelTitles = (cat: Catalog, id: string): Title[] =>
  (cat.channelById[id]?.titleIds || []).map(t => cat.byId[t]).filter(Boolean)

// 24h schedule in 22-minute slots. A slot inside one of the channel's time blocks plays that
// block's shows in order from the block's start; any other slot cycles through the whole line-up.
export const SLOT_MIN = 22
const DAY_MIN = 24 * 60
const mod = (n: number, m: number) => ((n % m) + m) % m
const slotMinute = (slot: number) => mod(slot * SLOT_MIN, DAY_MIN)

export const blockAt = (c: Channel, minute: number) => c.schedule.find(b => minute >= b.start && minute < b.end) || null

export function showAt(cat: Catalog, id: string, slot: number): Title {
  const c = cat.channelById[id]
  const minute = slotMinute(slot)
  const block = c && blockAt(c, minute)
  const items = block ? block.titleIds.map(t => cat.byId[t]).filter(Boolean) : []
  if (block && items.length) return items[Math.floor((minute - block.start) / SLOT_MIN) % items.length]
  const list = channelTitles(cat, id)
  return list[mod(slot, list.length)]
}

export function nowPlaying(cat: Catalog, id: string, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  const slot = Math.floor(mins / SLOT_MIN)
  const at = (k: number) => showAt(cat, id, slot + k)
  return { slot, current: at(0), next: at(1), later: at(2), offsetSec: (mins % SLOT_MIN) * 60 + now.getSeconds() }
}

// What the channel airs after the current show, with start times: the next `count` changes of
// show, following the same slots as the live player. `endsAt` is when the current show ends.
export function upNext(cat: Catalog, id: string, count = 3, now = new Date()) {
  const { slot, current } = nowPlaying(cat, id, now)
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const at = (s: number) => new Date(midnight.getTime() + s * SLOT_MIN * 60000)
  const next: { title: Title; start: Date }[] = []
  let prev = current
  for (let k = 1; k <= 200 && next.length < count; k++) {
    const t = showAt(cat, id, slot + k)
    if (t && t.id !== prev.id) { next.push({ title: t, start: at(slot + k) }); prev = t }
  }
  return { current, endsAt: next[0]?.start ?? null, next }
}

// The whole day on a channel, midnight to midnight: one entry per show change, following the
// same slots as the live player.
export function daySchedule(cat: Catalog, id: string, now = new Date()) {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const at = (s: number) => new Date(midnight.getTime() + s * SLOT_MIN * 60000)
  const out: { title: Title; start: Date; end: Date }[] = []
  for (let slot = 0; slot * SLOT_MIN < DAY_MIN; slot++) {
    const t = showAt(cat, id, slot)
    if (!t) continue
    const last = out[out.length - 1]
    if (last && last.title.id === t.id) last.end = at(slot + 1)
    else out.push({ title: t, start: at(slot), end: at(slot + 1) })
  }
  return out
}

export const timeLabel =(d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// "7:00 AM" for minutes from midnight, in the viewer's own clock format.
export const clockLabel = (m: number) => new Date(2000, 0, 1, 0, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

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

/* ---------- Personal rows (from the profile's plays) ---------- */

const onChannel = (t: Title, channelId?: string) => !channelId || t.channels.includes(channelId)

// "Continue Watching": shows played most recently first, then any part-watched in the built-in player.
export function continueWatching(cat: Catalog, v: Pick<Viewing, 'recent' | 'progress'>, channelId?: string): Title[] {
  const partWatched = Object.entries(v.progress).filter(([, p]) => p > 0 && p < 98).map(([id]) => id)
  return [...new Set([...v.recent, ...partWatched])].map(id => cat.byId[id]).filter(t => t && onChannel(t, channelId))
}

// "Because You Watched X": X is one of the last 3 shows played (on this channel, if given), a
// different one each day. Shows not played yet are scored on how alike they are: same genre +3,
// same type (series/film) +2, released within 5 years +1, sharing a channel +1 (off channel pages).
// Ties go to the shows with the most viewers this week.
export function becauseYouWatched(cat: Catalog, v: Pick<Viewing, 'recent'>, channelId?: string): { source: Title; items: Title[] } | null {
  const lastFew = v.recent.map(id => cat.byId[id]).filter(t => t && onChannel(t, channelId)).slice(0, 3)
  if (!lastFew.length) return null
  const source = lastFew[hash(new Date().toDateString()) % lastFew.length]
  const seen = new Set(v.recent)
  const score = (t: Title) => (t.genre === source.genre ? 3 : 0) + (t.type === source.type ? 2 : 0)
    + (t.year && source.year && Math.abs(t.year - source.year) <= 5 ? 1 : 0)
    + (!channelId && t.channels.some(c => source.channels.includes(c)) ? 1 : 0)
  const items = cat.titles.filter(t => !seen.has(t.id) && onChannel(t, channelId))
    .map(t => ({ t, s: score(t) })).filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || b.t.viewers.week - a.t.viewers.week)
    .slice(0, 18).map(x => x.t)
  return items.length ? { source, items } : null
}
