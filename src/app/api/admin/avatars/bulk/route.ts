import { slug } from '@/lib/ids'
import { avatarFields, freeId, str } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

const MAX = 200

// Adds many avatars at once from a list of image links, all in one category.
// Links already in the avatar list are skipped.
export const POST = handle(async req => {
  await requireAdmin()
  const body = await readBody(req)
  const urls = [...new Set((Array.isArray(body.urls) ? body.urls : []).map((u: unknown) => String(u).trim()).filter(Boolean))] as string[]
  if (!urls.length) fail(400, 'Paste at least one image link.')
  if (urls.length > MAX) fail(400, `Add up to ${MAX} avatars at a time.`)
  const category = str(body.category, 40, 'Category') || 'Classics'
  const bad = urls.find(u => !/^https?:\/\/\S+$/i.test(u))
  if (bad) fail(400, `"${bad.slice(0, 80)}" isn't a link. Each line should start with https://`)
  const checked = urls.map(url => avatarFields({ url, category }))
  const existing = new Set((await many<{ url: string }>('select url from avatars where url = any($1)', [urls])).map(r => r.url))
  let { next } = (await one('select coalesce(max(sort_order), 0) + 1 as next from avatars'))!
  let added = 0
  for (const a of checked) {
    if (existing.has(a.url)) continue
    const fileName = decodeURIComponent(a.url.split(/[?#]/)[0].split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '')
    const id = await freeId('avatars', slug(fileName).slice(0, 40) || 'avatar')
    await query('insert into avatars (id, url, label, category, sort_order) values ($1, $2, $3, $4, $5)', [id, a.url, '', a.category, next++])
    added++
  }
  return json({ added, skipped: checked.length - added }, 201)
})
