import { avatarFields } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

type P = { id: string }

export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const a = (await one('select * from avatars where id = $1', [id])) ?? fail(404, 'Avatar not found.')
  const f = avatarFields(await readBody(req), a)
  return json(await one('update avatars set url = $2, label = $3, category = $4 where id = $1 returning *', [a.id, f.url, f.label, f.category]))
})

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const r = await query('delete from avatars where id = $1', [id])
  if (!r.rowCount) fail(404, 'Avatar not found.')
  return json({ ok: true })
})
