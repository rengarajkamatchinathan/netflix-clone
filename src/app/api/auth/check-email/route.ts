import { isEmail, normEmail } from '@/server/auth'
import { one } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const POST = handle(async req => {
  const email = normEmail((await readBody(req)).email)
  if (!isEmail(email)) fail(400, 'Enter a valid email address.')
  const taken = await one('select 1 from users where email = $1', [email])
  return json({ available: !taken })
})
