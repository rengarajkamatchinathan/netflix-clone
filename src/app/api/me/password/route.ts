import bcrypt from 'bcryptjs'
import { checkCurrentPassword } from '@/server/account'
import { checkPassword, requireUser, startSession } from '@/server/auth'
import { one } from '@/server/db'
import { handle, json, readBody } from '@/server/http'

export const PUT = handle(async req => {
  const user = await requireUser()
  const body = await readBody(req)
  await checkCurrentPassword(user.id, body.current)
  checkPassword(body.password)
  const u = await one('update users set password_hash = $2, session_version = session_version + 1 where id = $1 returning *',
    [user.id, await bcrypt.hash(body.password, 10)])
  await startSession(u) // keep this device signed in, sign out the others
  return json({ ok: true })
})
