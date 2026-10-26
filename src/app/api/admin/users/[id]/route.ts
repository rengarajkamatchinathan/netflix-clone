import { confirmMatches, getUser } from '@/server/admin'
import { requireAdmin, type SessionUser } from '@/server/auth'
import { many, query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

type P = { id: string }
const notSelf = (me: SessionUser, u: { id: number }, action: string) => { if (u.id === me.id) fail(400, `You can't ${action} your own account.`) }

export const GET = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const u = await getUser(id)
  const [profiles, activity] = await Promise.all([
    many(`select p.id, p.name, p.color, p.is_kids, a.url as avatar_url,
            (select count(*) from my_list l where l.profile_id = p.id)::int as list
          from profiles p left join avatars a on a.id = p.avatar_id where p.user_id = $1 order by p.id`, [u.id]),
    many(`select w.title_id, t.name as title, w.pct, w.updated_at, p.name as profile
          from watch_progress w join profiles p on p.id = w.profile_id join titles t on t.id = w.title_id
          where p.user_id = $1 order by w.updated_at desc limit 20`, [u.id]),
  ])
  return json({ ...u, profiles, activity })
})

export const PATCH = handle<P>(async (req, { id }) => {
  const me = await requireAdmin()
  const u = await getUser(id)
  const body = await readBody(req)
  if (body.disabled !== undefined) {
    notSelf(me, u, 'disable')
    await query('update users set disabled = $2, session_version = session_version + $3 where id = $1', [u.id, !!body.disabled, body.disabled ? 1 : 0])
  }
  if (body.role !== undefined) {
    if (!['user', 'admin'].includes(body.role)) fail(400, 'Role must be user or admin.')
    notSelf(me, u, 'change the role of')
    await query('update users set role = $2 where id = $1', [u.id, body.role])
  }
  return json(await getUser(u.id))
})

export const DELETE = handle<P>(async (req, { id }) => {
  const me = await requireAdmin()
  const u = await getUser(id)
  notSelf(me, u, 'delete')
  confirmMatches((await readBody(req)).confirm, u.email, 'email')
  await query('delete from users where id = $1', [u.id])
  return json({ ok: true })
})
