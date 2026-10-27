import { channelFields, channelOut, confirmMatches, getChannel } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { catalogChanged, weeklyViewers } from '@/server/catalog'
import { many, query } from '@/server/db'
import { handle, json, readBody } from '@/server/http'
import { notify } from '@/server/notifications'

type P = { id: string }

export const GET = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const [titles, viewers] = await Promise.all([
    many(`select t.id, t.name, t.year, t.image, t.poster, jsonb_array_length(t.videos)::int as episodes
          from channel_titles ct join titles t on t.id = ct.title_id where ct.channel_id = $1 order by ct.position, t.name`, [c.id]),
    weeklyViewers(),
  ])
  return json({ ...channelOut(c), titles: titles.map(t => ({ ...t, viewers: viewers[t.id] || 0 })) })
})

export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const f = channelFields(await readBody(req), c)
  await query('update channels set name = $2, tagline = $3, colors = $4, bumpers = $5, hidden = $6, schedule = $7, top10 = $8 where id = $1',
    [c.id, f.name, f.tagline, JSON.stringify(f.colors), JSON.stringify(f.bumpers), f.hidden, JSON.stringify(f.schedule), JSON.stringify(f.top10)])
  if (c.hidden && !f.hidden) await notify({ kind: 'channel', channelId: c.id, heading: 'Now live', body: `${f.name} is back on air` })
  catalogChanged()
  return json(channelOut(await getChannel(c.id)))
})

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  confirmMatches((await readBody(req)).confirm, c.name, 'channel name')
  await query('delete from channels where id = $1', [c.id])
  catalogChanged()
  return json({ ok: true })
})
