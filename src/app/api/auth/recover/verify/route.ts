import bcrypt from 'bcryptjs'
import { normalizeAnswer } from '@/lib/securityQuestions'
import { normEmail, signToken } from '@/server/auth'
import { many, one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

const MAX_TRIES = 5
const LOCK_MINUTES = 15

// Step 2: check both answers. Returns a one-time reset token valid for 10 minutes.
export const POST = handle(async req => {
  const body = await readBody(req)
  const email = normEmail(body.email)
  const answers: Record<string, unknown> = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const user = await one('select * from users where email = $1', [email])
  const rows = user ? await many('select slot, answer_hash from security_answers where user_id = $1 order by slot', [user.id]) : []

  if (user?.recovery_locked_until && new Date(user.recovery_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.recovery_locked_until).getTime() - Date.now()) / 60000)
    fail(429, `Too many wrong answers. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or ask the admin to reset your password.`)
  }

  let ok = rows.length === 2 && !user.disabled
  for (const r of rows) ok = (await bcrypt.compare(normalizeAnswer(answers[r.slot]), r.answer_hash)) && ok
  if (!ok) {
    if (!user) fail(400, "Those answers don't match.")
    const fails = user.recovery_fails + 1
    if (fails >= MAX_TRIES) {
      await query(`update users set recovery_fails = 0, recovery_locked_until = now() + make_interval(mins => $2) where id = $1`, [user.id, LOCK_MINUTES])
      fail(429, `Too many wrong answers. Try again in ${LOCK_MINUTES} minutes, or ask the admin to reset your password.`)
    }
    await query('update users set recovery_fails = $2 where id = $1', [user.id, fails])
    const left = MAX_TRIES - fails
    fail(400, `Those answers don't match. ${left} tr${left === 1 ? 'y' : 'ies'} left.`)
  }
  await query('update users set recovery_fails = 0, recovery_locked_until = null where id = $1', [user.id])
  // One-time: becomes invalid as soon as the password changes (session_version bump).
  return json({ resetToken: signToken({ uid: user.id, sv: user.session_version, purpose: 'reset' }, '10m') })
})
