import { slug } from '@/lib/ids'
import { CHANNEL_COLS, channelFields, channelOut, freeId, getChannel, type ChannelRow } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'
import { notify } from '@/server/notifications'

export const GET = handle(async () => {
  await requireAdmin()
  const rows = await many<ChannelRow & { shows: number }>(`select ${CHANNEL_COLS}, (select count(*) from channel_titles ct where ct.channel_id = c.id)::int as shows
                                 from channels c order by c.sort_order, c.name`)
  return json(rows.map(c => ({ ...channelOut(c), shows: c.shows })))
})

export const POST = handle(async req => {
  await requireAdmin()
  const body = await readBody(req)
  const f = channelFields(body)
  const base = slug(String(body.id || f.name))
  if (!base) fail(400, 'Enter a URL slug using letters or numbers.')
  if (body.id && (await one('select 1 from channels where id = $1', [base]))) fail(409, `A channel with the slug "${base}" already exists.`)
  const id = await freeId('channels', base)
  const { next } = (await one('select coalesce(max(sort_order), 0) + 1 as next from channels'))!
  await query('insert into channels (id, name, tagline, sort_order, colors, bumpers, hidden, schedule, top10) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [id, f.name, f.tagline, next, JSON.stringify(f.colors), JSON.stringify(f.bumpers), f.hidden, JSON.stringify(f.schedule), JSON.stringify(f.top10)])
  if (!f.hidden) await notify({ kind: 'channel', channelId: id, heading: 'New channel', body: `${f.name} is live now` })
  return json(channelOut(await getChannel(id)), 201)
})
