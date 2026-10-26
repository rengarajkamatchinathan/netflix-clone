import { decoyQuestions, describeQuestions } from '@/server/account'
import { isEmail, normEmail } from '@/server/auth'
import { many, one } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

// Step 1 of password recovery: which two questions to ask.
export const POST = handle(async req => {
  const email = normEmail((await readBody(req)).email)
  if (!isEmail(email)) fail(400, 'Enter a valid email address.')
  const user = await one('select id from users where email = $1', [email])
  const rows = user ? await many('select question_key from security_answers where user_id = $1 order by slot', [user.id]) : []
  return json({ questions: describeQuestions(rows.length ? rows.map(r => r.question_key) : decoyQuestions(email)) })
})
