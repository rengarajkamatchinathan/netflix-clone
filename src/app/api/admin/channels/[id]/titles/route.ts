import { getChannel } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { catalogChanged } from '@/server/catalog'
import { many, tx } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

// Replaces the channel's line-up with `ids`, in that order.
export const PUT = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const body = await readBody(req)
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))]
  const found = await many('select id from titles where id = any($1)', [ids])
  if (found.length !== ids.length) fail(400, 'Some of those shows no longer exist. Reload and try again.')
  await tx(async cl => {
    await cl.query('delete from channel_titles where channel_id = $1', [c.id])
    for (const [i, tid] of ids.entries()) await cl.query('insert into channel_titles (channel_id, title_id, position) values ($1, $2, $3)', [c.id, tid, i + 1])
  })
  catalogChanged()
  return json({ ok: true })
})
