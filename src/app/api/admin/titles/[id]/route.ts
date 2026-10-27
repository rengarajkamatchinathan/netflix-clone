import { confirmMatches, getTitle, setTitleChannels, titleFields, titleOut } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { catalogChanged } from '@/server/catalog'
import { query, tx } from '@/server/db'
import { handle, json, readBody } from '@/server/http'
import { newTitleHeading, notify } from '@/server/notifications'

type P = { id: string }

export const GET = handle<P>(async (req, { id }) => {
  await requireAdmin()
  return json(await titleOut(await getTitle(id)))
})

export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const t = await getTitle(id)
  const body = await readBody(req)
  const f = titleFields(body, t)
  await tx(async c => {
    await c.query(`update titles set name = $2, year = $3, type = $4, genre = $5, synopsis = $6, category = $7, maturity = $8,
                   image = $9, poster = $10, link = $11, videos = $12, hidden = $13, publish_at = $14, backdrop = $15, crops = $16, needs_review = false where id = $1`,
      [t.id, f.name, f.year, f.type, f.genre, f.synopsis, f.category, f.maturity, f.image, f.poster, f.link, JSON.stringify(f.videos), f.hidden, f.publishAt,
        f.backdrop, f.crops && JSON.stringify(f.crops)])
    if (body.channels !== undefined) await setTitleChannels(c, t.id, body.channels)
  })
  // Tell viewers when a show appears (unhidden or newly scheduled) or gains episodes.
  const wasLive = !t.hidden && (!t.publish_at || t.publish_at <= new Date())
  const scheduleChanged = String(t.publish_at ?? '') !== String(f.publishAt ?? '')
  if (!f.hidden && (t.hidden || (scheduleChanged && !wasLive))) {
    await notify({ kind: 'title', titleId: t.id, heading: await newTitleHeading(t.id), body: f.name, at: f.publishAt })
  } else if (!f.hidden && f.videos.length > t.videos.length) {
    const n = f.videos.length - t.videos.length
    await notify({ kind: 'episodes', titleId: t.id, heading: 'New episodes', body: `${f.name}: ${n} new episode${n === 1 ? '' : 's'}` })
  }
  catalogChanged()
  return json(await titleOut(await getTitle(t.id)))
})

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const t = await getTitle(id)
  confirmMatches((await readBody(req)).confirm, t.name, 'show title')
  await query('delete from titles where id = $1', [t.id])
  catalogChanged()
  return json({ ok: true })
})
