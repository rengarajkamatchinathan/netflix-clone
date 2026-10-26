import bcrypt from 'bcryptjs'
import { checkQuestions, defaultProfileColor, meFor, saveQuestions } from '@/server/account'
import { checkPassword, isEmail, normEmail, startSession, type SessionUser } from '@/server/auth'
import { one, tx } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const POST = handle(async req => {
  const body = await readBody(req)
  const email = normEmail(body.email)
  if (!isEmail(email)) fail(400, 'Enter a valid email address.')
  checkPassword(body.password)
  const questions = checkQuestions(body.questions)
  if (await one('select 1 from users where email = $1', [email])) fail(409, 'An account with this email already exists. Sign in instead.')

  const passwordHash = await bcrypt.hash(body.password, 10)
  const user = await tx(async c => {
    const u: SessionUser = (await c.query('insert into users (email, password_hash, last_login_at) values ($1, $2, now()) returning *', [email, passwordHash])).rows[0]
    await saveQuestions(c, u.id, questions)
    const avatar = (await c.query('select id from avatars order by random() limit 1')).rows[0]
    await c.query('insert into profiles (user_id, name, avatar_id, color) values ($1, $2, $3, $4)',
      [u.id, 'You', avatar?.id ?? null, defaultProfileColor(email)])
    return u
  })
  await startSession(user)
  return json(await meFor(user), 201)
})
