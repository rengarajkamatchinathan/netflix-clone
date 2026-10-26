import { requireAdmin } from '@/server/auth'
import { many, one } from '@/server/db'
import { handle, json } from '@/server/http'

export const GET = handle(async () => {
  await requireAdmin()
  const [counts, recent, popular] = await Promise.all([
    one(`select (select count(*) from users)::int as users,
                (select count(*) from users where created_at > now() - interval '7 days')::int as "newUsers",
                (select count(*) from profiles)::int as profiles,
                (select count(*) from titles)::int as titles,
                (select count(*) from channels)::int as channels,
                (select count(*) from avatars)::int as avatars`),
    many(`select u.id, u.email, u.created_at, count(p.id)::int as profiles
          from users u left join profiles p on p.user_id = u.id group by u.id order by u.created_at desc limit 6`),
    many(`select t.id, t.name, count(*)::int as viewers from watch_progress w join titles t on t.id = w.title_id
          where w.updated_at > now() - interval '7 days' group by t.id order by viewers desc, t.name limit 6`),
  ])
  return json({ counts, recent, popular })
})
