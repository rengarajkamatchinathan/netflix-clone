import bcrypt from 'bcryptjs'
import { getUser, tempPassword } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { query } from '@/server/db'
import { fail, handle, json } from '@/server/http'

// Sets a temporary password for the admin to pass on, and signs the user out everywhere.
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const me = await requireAdmin()
  const u = await getUser(id)
  if (u.id === me.id) fail(400, 'Change your own password on the Account page.')
  const password = tempPassword()
  await query(`update users set password_hash = $2, session_version = session_version + 1, recovery_fails = 0, recovery_locked_until = null
               where id = $1`, [u.id, await bcrypt.hash(password, 10)])
  return json({ password })
})
