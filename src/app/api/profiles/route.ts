import { MAX_PROFILES, meFor, profileFields } from '@/server/account'
import { requireUser } from '@/server/auth'
import { one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const POST = handle(async req => {
  const user = await requireUser()
  const { count } = (await one('select count(*)::int as count from profiles where user_id = $1', [user.id]))!
  if (count >= MAX_PROFILES) fail(400, `You can have up to ${MAX_PROFILES} profiles.`)
  const f = await profileFields(await readBody(req))
  await query('insert into profiles (user_id, name, color, avatar_id, is_kids) values ($1, $2, $3, $4, $5)', [user.id, f.name, f.color, f.avatarId, f.isKids])
  return json(await meFor(user), 201)
})
