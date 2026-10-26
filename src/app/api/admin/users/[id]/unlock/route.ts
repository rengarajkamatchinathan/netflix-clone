import { getUser } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { query } from '@/server/db'
import { handle, json } from '@/server/http'

export const POST = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin()
  const u = await getUser(id)
  await query('update users set recovery_fails = 0, recovery_locked_until = null where id = $1', [u.id])
  return json(await getUser(u.id))
})
