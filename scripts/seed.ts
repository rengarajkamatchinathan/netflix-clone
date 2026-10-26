// Creates tables and imports the starting catalog from scripts/seed-data/ into Postgres:
// shows (data.json), channels (channels/<id>/channel.json) and their logos (channels/<id>/logo.*).
// Safe to re-run: existing channels, titles, logos and users are never overwritten.
//   npm run db:setup                    first-time setup
//   npm run db:setup -- --reset-admin   also resets the admin password to ADMIN_PASSWORD
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { slug, toVideos } from '../src/lib/ids'
import type { Video } from '../src/lib/types'
import { logoTypeForFile } from '../src/server/logos'
import { one, pool, query } from '../src/server/db'

const DATA = path.join(process.cwd(), 'scripts', 'seed-data')
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))

interface SourceShow { title?: string; year?: number; type?: string; genre?: string; synopsis?: string; maturity?: string; image?: string; poster?: string; link?: string; videos?: unknown; needsReview?: boolean }
interface SourceData { channels?: Record<string, SourceShow[]>; series?: SourceShow[] }

async function seedChannels(data: SourceData) {
  const ids = new Set(Object.keys(data.channels || {}))
  const dirs = await readdir(path.join(DATA, 'channels'), { withFileTypes: true }).catch(() => [])
  for (const d of dirs) if (d.isDirectory()) ids.add(d.name)

  let added = 0, logos = 0
  for (const id of ids) {
    const c = await readJson(path.join(DATA, 'channels', id, 'channel.json')).catch(() => ({}))
    const r = await query(
      `insert into channels (id, name, tagline, sort_order, colors, bumpers) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do nothing`,
      [id, c.name || id, c.tagline || '', c.order ?? 999, JSON.stringify(c.colors || {}), JSON.stringify(Array.isArray(c.bumpers) ? c.bumpers : [])],
    )
    added += r.rowCount ?? 0
    logos += await seedLogo(id)
  }
  return { total: ids.size, added, logos }
}

// First image in the channel folder (logo.* preferred), stored only if the channel has no logo yet.
async function seedLogo(id: string): Promise<number> {
  const files = (await readdir(path.join(DATA, 'channels', id)).catch(() => [] as string[])).filter(f => logoTypeForFile(f))
  const file = files.find(f => /^logo./i.test(f)) || files[0]
  if (!file) return 0
  const bytes = await readFile(path.join(DATA, 'channels', id, file))
  const r = await query('update channels set logo = $2, logo_type = $3, logo_updated_at = now() where id = $1 and logo is null', [id, bytes, logoTypeForFile(file)])
  return r.rowCount ?? 0
}

interface Merged {
  id: string; name: string; year: number | null; type: string; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; link: string | null; videos: Video[]; needsReview: boolean; channels: string[]
}

// One title per name, joined across channels; later duplicates fill in missing details.
function mergeTitles(data: SourceData): Merged[] {
  const merged = new Map<string, Merged>()
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || null
  const add = (s: SourceShow, channelId: string | null, category: string | null) => {
    if (!s?.title) return
    const id = slug(s.title)
    const existing = merged.get(id)
    if (existing) {
      if (channelId && !existing.channels.includes(channelId)) existing.channels.push(channelId)
      existing.image ||= clean(s.image)
      existing.link ||= clean(s.link)
      existing.poster ||= clean(s.poster)
      if (!existing.videos.length) existing.videos = toVideos(s.videos)
      return
    }
    merged.set(id, {
      id, name: s.title, year: s.year ?? null, type: s.type || 'tv', genre: s.genre || null, synopsis: s.synopsis || null,
      category, maturity: s.maturity || null, image: clean(s.image), poster: clean(s.poster), link: clean(s.link),
      videos: toVideos(s.videos), needsReview: !!s.needsReview, channels: channelId ? [channelId] : [],
    })
  }
  for (const [channelId, shows] of Object.entries(data.channels || {})) shows.forEach(s => add(s, channelId, null))
  for (const s of data.series || []) add(s, null, 'Series')
  return [...merged.values()]
}

async function seedTitles(data: SourceData) {
  const list = mergeTitles(data)
  const positions: Record<string, number> = {}
  let added = 0
  for (const t of list) {
    const r = await query(
      `insert into titles (id, name, year, type, genre, synopsis, category, maturity, image, poster, link, videos, needs_review)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) on conflict (id) do nothing`,
      [t.id, t.name, t.year, t.type, t.genre, t.synopsis, t.category, t.maturity, t.image, t.poster, t.link, JSON.stringify(t.videos), t.needsReview],
    )
    if (!r.rowCount) continue // already imported; keep whatever the admin has since changed
    added++
    for (const c of t.channels) {
      positions[c] = (positions[c] ?? 0) + 1
      await query('insert into channel_titles (channel_id, title_id, position) values ($1, $2, $3) on conflict do nothing', [c, t.id, positions[c]])
    }
  }
  return { total: list.length, added }
}

async function seedAdmin(reset: boolean) {
  const email = (process.env.ADMIN_EMAIL || 'admin@admin.com').trim().toLowerCase()
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin', 10)
  const existing = await one('select id from users where email = $1', [email])
  if (existing) {
    if (reset) await query("update users set password_hash = $2, role = 'admin', disabled = false, session_version = session_version + 1 where id = $1", [existing.id, hash])
    return reset ? 'password reset' : 'already exists'
  }
  const u = (await one("insert into users (email, password_hash, role) values ($1, $2, 'admin') returning id", [email, hash]))!
  await query("insert into profiles (user_id, name, color) values ($1, 'Admin', '#e50914')", [u.id])
  return 'created'
}

async function main() {
  const data: SourceData = await readJson(path.join(DATA, 'data.json'))
  await query(await readFile(path.join(process.cwd(), 'src', 'server', 'schema.sql'), 'utf8'))
  console.log('Tables ready')
  const ch = await seedChannels(data)
  console.log(`Channels: ${ch.added} added, ${ch.total - ch.added} already there, ${ch.logos} logos stored`)
  const ti = await seedTitles(data)
  console.log(`Titles: ${ti.added} added, ${ti.total - ti.added} already there`)
  console.log(`Admin ${process.env.ADMIN_EMAIL || 'admin@admin.com'}: ${await seedAdmin(process.argv.includes('--reset-admin'))}`)
  await pool.end()
}

main().catch(async e => { console.error(e); await pool.end(); process.exit(1) })
