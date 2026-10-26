import { requireAdmin } from '@/server/auth'
import { query } from '@/server/db'
import { handle, json } from '@/server/http'

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  await requireAdmin()
  await query('delete from notifications where id = $1', [Number(id) || 0])
  return json({ ok: true })
})
