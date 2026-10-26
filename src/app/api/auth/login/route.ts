import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { meFor } from '@/server/account'
import { loginLimiter, normEmail, PROFILE_COOKIE, startSession } from '@/server/auth'
import { one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const POST = handle(async req => {
  const body = await readBody(req)
  const email = normEmail(body.email)
  if (loginLimiter.blocked(email)) fail(429, 'Too many failed sign-ins. Wait 15 minutes, or reset your password.')
  const user = await one('select * from users where email = $1', [email])
  const ok = user && typeof body.password === 'string' && (await bcrypt.compare(body.password, user.password_hash))
  if (!ok) { loginLimiter.fail(email); fail(401, 'Incorrect email or password. Try again, or reset your password.') }
  if (user.disabled) fail(403, 'This account has been disabled. Contact the StreamFlix admin.')
  loginLimiter.clear(email)
  await query('update users set last_login_at = now() where id = $1', [user.id])
  await startSession(user, body.remember !== false)
  ;(await cookies()).delete(PROFILE_COOKIE) // pick a profile again after signing in
  return json(await meFor(user))
})
