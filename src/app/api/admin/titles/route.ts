import { slug } from '@/lib/ids'
import { freeId, getTitle, setTitleChannels, titleFields, titleOut } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, tx } from '@/server/db'
import { handle, json, readBody } from '@/server/http'

export const GET = handle(async () => {
  await requireAdmin()
  return json(await many(`select t.id, t.name, t.year, t.type, t.image, t.poster, t.category, t.hidden, jsonb_array_length(t.videos)::int as episodes,
      coalesce(array_agg(ct.channel_id order by c.sort_order) filter (where ct.channel_id is not null), '{}') as channels
    from titles t left join channel_titles ct on ct.title_id = t.id left join channels c on c.id = ct.channel_id
    group by t.id order by t.name`))
})

export const POST = handle(async req => {
  await requireAdmin()
  const body = await readBody(req)
  const f = titleFields(body)
  const id = await freeId('titles', slug(f.name) || 'show')
  await tx(async c => {
    await c.query(`insert into titles (id, name, year, type, genre, synopsis, category, maturity, image, poster, link, videos, hidden)
                   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, f.name, f.year, f.type, f.genre, f.synopsis, f.category, f.maturity, f.image, f.poster, f.link, JSON.stringify(f.videos), f.hidden])
    await setTitleChannels(c, id, body.channels)
  })
  return json(await titleOut(await getTitle(id)), 201)
})
