import { meFor, ownProfile, profileFields } from '@/server/account'
import { requireUser } from '@/server/auth'
import { one, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

type P = { id: string }

export const PUT = handle<P>(async (req, { id }) => {
  const user = await requireUser()
  const p = await ownProfile(user.id, id)
  const f = await profileFields(await readBody(req), p)
  await query('update profiles set name = $2, color = $3, avatar_id = $4, is_kids = $5 where id = $1', [p.id, f.name, f.color, f.avatarId, f.isKids])
  return json(await meFor(user))
})

export const DELETE = handle<P>(async (req, { id }) => {
  const user = await requireUser()
  const p = await ownProfile(user.id, id)
  const { count } = (await one('select count(*)::int as count from profiles where user_id = $1', [user.id]))!
  if (count <= 1) fail(400, 'You need at least one profile.')
  await query('delete from profiles where id = $1', [p.id])
  return json(await meFor(user))
})
