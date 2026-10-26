import bcrypt from 'bcryptjs'
import { checkPassword, loginLimiter, readToken } from '@/server/auth'
import { one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

// Step 3: set the new password. Signs out every existing session.
export const POST = handle(async req => {
  const body = await readBody(req)
  const claims = readToken(body.resetToken)
  if (claims?.purpose !== 'reset') fail(400, 'This reset link has expired. Start again.')
  checkPassword(body.password)
  const r = await query('update users set password_hash = $3, session_version = session_version + 1 where id = $1 and session_version = $2 and not disabled',
    [claims!.uid, claims!.sv, await bcrypt.hash(body.password, 10)])
  if (!r.rowCount) fail(400, 'This reset link has expired. Start again.')
  loginLimiter.clear((await one('select email from users where id = $1', [claims!.uid]))?.email)
  return json({ ok: true })
})
