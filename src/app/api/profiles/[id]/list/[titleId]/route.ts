import { ownProfile, titleExists } from '@/server/account'
import { requireUser } from '@/server/auth'
import { query } from '@/server/db'
import { fail, handle, json } from '@/server/http'

type P = { id: string; titleId: string }

export const PUT = handle<P>(async (req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  if (!(await titleExists(titleId))) fail(404, 'That show no longer exists.')
  await query('insert into my_list (profile_id, title_id) values ($1, $2) on conflict do nothing', [p.id, titleId])
  return json({ ok: true })
})

export const DELETE = handle<P>(async (req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  await query('delete from my_list where profile_id = $1 and title_id = $2', [p.id, titleId])
  return json({ ok: true })
})
