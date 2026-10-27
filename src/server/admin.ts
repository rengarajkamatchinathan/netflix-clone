// Validation and lookups used by the /api/admin routes.
import { randomInt } from 'node:crypto'
import type pg from 'pg'
import { toCrops, toVideos, youtubeId } from '@/lib/ids'
import type { ChannelColors, ImageCrops, ScheduleBlock, Video } from '@/lib/types'
import { logoUrl } from './catalog'
import { many, one } from './db'
import { fail } from './http'

const HEX = /^#[0-9a-f]{6}$/i

export const str = (v: unknown, max: number, label: string): string => {
  const s = v == null ? '' : String(v).trim()
  if (s.length > max) fail(400, `${label} must be ${max} characters or fewer.`)
  return s
}

export const confirmMatches = (typed: unknown, expected: string, what: string) => {
  if (String(typed ?? '').trim().toLowerCase() !== expected.trim().toLowerCase()) fail(400, `Type the ${what} exactly to confirm.`)
}

// Free id based on `base`: base, base-2, base-3…
export async function freeId(table: 'channels' | 'titles' | 'avatars', base: string) {
  let id = base, n = 1
  while (await one(`select 1 from ${table} where id = $1`, [id])) id = `${base}-${++n}`
  return id
}

// ---------- Users ----------

export const USER_COLS = `u.id, u.email, u.role, u.disabled, u.created_at, u.last_login_at,
  (u.recovery_locked_until is not null and u.recovery_locked_until > now()) as locked`

export async function getUser(id: string | number) {
  const u = await one(`select ${USER_COLS} from users u where u.id = $1`, [Number(id) || 0])
  return u ?? fail(404, 'User not found.')
}

// Readable temporary password, e.g. "kite-4827-moss".
const WORDS = ['kite', 'moss', 'river', 'comet', 'maple', 'pixel', 'otter', 'cloud', 'ember', 'tiger', 'lotus', 'orbit', 'mango', 'cedar', 'flint', 'raven']
export const tempPassword = () => `${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 10000)}-${WORDS[randomInt(WORDS.length)]}`

// ---------- Channels ----------

export interface ChannelRow { id: string; name: string; tagline: string; sort_order: number; colors: ChannelColors; bumpers: string[]; hidden: boolean; schedule: ScheduleBlock[]; logo_updated_at: Date | null }
// Every channel column except the logo bytes.
export const CHANNEL_COLS = 'id, name, tagline, sort_order, colors, bumpers, hidden, schedule, logo_updated_at'

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Daily time blocks: whole minutes within the day, start before end, no overlaps, at least one show each.
function scheduleField(v: unknown): ScheduleBlock[] {
  if (!Array.isArray(v)) return []
  if (v.length > 48) fail(400, 'A channel can have up to 48 time blocks.')
  const blocks = v.map((b: any) => ({
    start: Number(b?.start), end: Number(b?.end),
    titleIds: [...new Set((Array.isArray(b?.titleIds) ? b.titleIds : []).map(String))] as string[],
  })).sort((a, b) => a.start - b.start)
  blocks.forEach((b, i) => {
    if (![b.start, b.end].every(n => Number.isInteger(n) && n >= 0 && n <= 1440) || b.start >= b.end) fail(400, 'Each time block must end after it starts, within the same day.')
    if (!b.titleIds.length) fail(400, `The ${hhmm(b.start)} block needs at least one show.`)
    if (i && b.start < blocks[i - 1].end) fail(400, `The ${hhmm(blocks[i - 1].start)} and ${hhmm(b.start)} blocks overlap.`)
  })
  return blocks
}

export function channelFields(b: Record<string, any>, current: Partial<ChannelRow> = {}) {
  const name = b.name === undefined ? current.name ?? '' : str(b.name, 60, 'Name')
  if (!name) fail(400, 'Enter a channel name.')
  const colors: Partial<ChannelColors> = b.colors === undefined ? current.colors ?? {} : b.colors ?? {}
  for (const k of ['bg', 'accent', 'accent2'] as const) if (colors[k] && !HEX.test(colors[k]!)) fail(400, 'Colours must be hex values like #1a0b2e.')
  const bumpers: string[] = b.bumpers === undefined ? current.bumpers ?? [] : (Array.isArray(b.bumpers) ? b.bumpers : []).map((s: unknown) => String(s).trim()).filter(Boolean)
  const bad = bumpers.find(l => !youtubeId(l))
  if (bad) fail(400, `"${bad}" isn't a YouTube link.`)
  return {
    name,
    tagline: b.tagline === undefined ? current.tagline ?? '' : str(b.tagline, 120, 'Tagline'),
    colors: { bg: colors.bg || '#141414', accent: colors.accent || '#e50914', accent2: colors.accent2 || '#ffffff' },
    bumpers,
    hidden: b.hidden === undefined ? !!current.hidden : !!b.hidden,
    schedule: b.schedule === undefined ? current.schedule ?? [] : scheduleField(b.schedule),
  }
}

export async function getChannel(id: string) {
  return (await one<ChannelRow>(`select ${CHANNEL_COLS} from channels where id = $1`, [id])) ?? fail(404, 'Channel not found.')
}

export const channelOut = (c: ChannelRow) => ({
  id: c.id, name: c.name, tagline: c.tagline, order: c.sort_order, colors: c.colors, bumpers: c.bumpers, hidden: c.hidden, schedule: c.schedule, image: logoUrl(c.id, c.logo_updated_at),
})

// ---------- Shows (titles) ----------

export interface TitleRow {
  id: string; name: string; year: number | null; type: string; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; backdrop: string | null; crops: ImageCrops | null; link: string | null; videos: Video[]
  hidden: boolean; publish_at: Date | null
}

export function titleFields(b: Record<string, any>, current: Partial<TitleRow> = {}) {
  const pick = (k: keyof TitleRow, max: number, label: string) => (b[k] === undefined ? String(current[k] ?? '') : str(b[k], max, label))
  const name = pick('name', 200, 'Title')
  if (!name) fail(400, 'Enter a title.')
  const year = b.year === undefined ? current.year ?? null : b.year === '' || b.year == null ? null : Number(b.year)
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > 2100)) fail(400, 'Year must be between 1900 and 2100.')
  const type = b.type === undefined ? current.type || 'tv' : b.type
  if (!['tv', 'movie'].includes(type)) fail(400, 'Type must be TV show or film.')
  const videos = b.videos === undefined ? current.videos ?? [] : toVideos(b.videos)
  if (videos.length > 500) fail(400, 'A show can have up to 500 episodes.')
  for (const v of videos) str(v.url, 2000, 'Video links')
  const or = (s: string) => s || null
  return {
    name, year, type, videos,
    genre: or(pick('genre', 40, 'Genre')), synopsis: or(pick('synopsis', 1000, 'Synopsis')), category: or(pick('category', 40, 'Category')),
    maturity: or(pick('maturity', 20, 'Rating')), image: or(pick('image', 2000, 'Image link')), poster: or(pick('poster', 2000, 'Poster link')),
    backdrop: or(pick('backdrop', 2000, 'Background image link')), crops: b.crops === undefined ? current.crops ?? null : toCrops(b.crops),
    link: or(pick('link', 2000, 'Link')),
    hidden: b.hidden === undefined ? !!current.hidden : !!b.hidden,
    publishAt: b.publishAt === undefined ? current.publish_at ?? null : publishAt(b.publishAt),
  }
}

function publishAt(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(String(v))
  if (isNaN(d.getTime())) fail(400, 'Enter a valid publish date and time.')
  return d
}

export async function getTitle(id: string) {
  return (await one<TitleRow>('select * from titles where id = $1', [id])) ?? fail(404, 'Show not found.')
}

export async function titleOut(t: TitleRow) {
  const [channels, impact] = await Promise.all([
    many('select channel_id from channel_titles ct join channels c on c.id = ct.channel_id where title_id = $1 order by c.sort_order', [t.id]),
    one(`select (select count(*) from my_list where title_id = $1)::int as lists,
                (select count(*) from watch_progress where title_id = $1)::int as progress`, [t.id]),
  ])
  return {
    id: t.id, name: t.name, year: t.year, type: t.type, genre: t.genre, synopsis: t.synopsis, category: t.category, maturity: t.maturity,
    image: t.image, poster: t.poster, backdrop: t.backdrop, crops: t.crops ?? {}, link: t.link, videos: t.videos, hidden: t.hidden, publishAt: t.publish_at, channels: channels.map(c => c.channel_id), impact,
  }
}

// Adds/removes channel links; new links go to the end of that channel's line-up.
export async function setTitleChannels(client: pg.PoolClient, titleId: string, channelIds: unknown) {
  const wanted = [...new Set((Array.isArray(channelIds) ? channelIds : []).map(String))]
  const known = (await client.query('select id from channels where id = any($1)', [wanted])).rows
  if (known.length !== wanted.length) fail(400, 'Some of those channels no longer exist.')
  await client.query('delete from channel_titles where title_id = $1 and not (channel_id = any($2))', [titleId, wanted])
  for (const c of wanted) {
    await client.query(`insert into channel_titles (channel_id, title_id, position)
      select $1, $2, coalesce(max(position), 0) + 1 from channel_titles where channel_id = $1 on conflict do nothing`, [c, titleId])
  }
}

// ---------- Avatars ----------

export function avatarFields(b: Record<string, any>, current: { url?: string; label?: string; category?: string } = {}) {
  const url = b.url === undefined ? current.url ?? '' : str(b.url, 2000, 'Image link')
  if (!/^https?:\/\/\S+$/i.test(url) && !/^\/\S+$/.test(url)) fail(400, 'Enter an image link starting with https://')
  return {
    url,
    label: b.label === undefined ? current.label ?? '' : str(b.label, 60, 'Name'),
    category: (b.category === undefined ? current.category : str(b.category, 40, 'Category')) || 'Classics',
  }
}
