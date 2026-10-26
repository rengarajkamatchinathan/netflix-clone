import { USER_COLS } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many } from '@/server/db'
import { handle, json } from '@/server/http'

export const GET = handle(async req => {
  await requireAdmin()
  const q = `%${(req.nextUrl.searchParams.get('q') || '').trim().toLowerCase()}%`
  return json(await many(
    `select ${USER_COLS}, (select count(*) from profiles p where p.user_id = u.id)::int as profiles
     from users u where u.email like $1 order by u.created_at desc limit 500`, [q]))
})
