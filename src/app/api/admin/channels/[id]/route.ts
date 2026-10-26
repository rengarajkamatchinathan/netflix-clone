import { channelFields, channelOut, confirmMatches, getChannel } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, query } from '@/server/db'
import { handle, json, readBody } from '@/server/http'

type P = { id: string }

export const GET = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const titles = await many(`select t.id, t.name, t.year, t.image, t.poster, jsonb_array_length(t.videos)::int as episodes
          from channel_titles ct join titles t on t.id = ct.title_id where ct.channel_id = $1 order by ct.position, t.name`, [c.id])
  return json({ ...channelOut(c), titles })
})

export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const f = channelFields(await readBody(req), c)
  await query('update channels set name = $2, tagline = $3, colors = $4, bumpers = $5, hidden = $6 where id = $1',
    [c.id, f.name, f.tagline, JSON.stringify(f.colors), JSON.stringify(f.bumpers), f.hidden])
  return json(channelOut(await getChannel(c.id)))
})

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  confirmMatches((await readBody(req)).confirm, c.name, 'channel name')
  await query('delete from channels where id = $1', [c.id])
  return json({ ok: true })
})
