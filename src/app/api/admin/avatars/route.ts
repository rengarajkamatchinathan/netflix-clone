import { slug } from '@/lib/ids'
import { avatarFields, freeId } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, one } from '@/server/db'
import { handle, json, readBody } from '@/server/http'

export const GET = handle(async () => {
  await requireAdmin()
  return json(await many(`select a.*, (select count(*) from profiles p where p.avatar_id = a.id)::int as used
                          from avatars a order by a.category, a.sort_order, a.id`))
})

export const POST = handle(async req => {
  await requireAdmin()
  const body = await readBody(req)
  const f = avatarFields(body)
  const id = await freeId('avatars', slug(String(body.id || f.label || 'avatar')) || 'avatar')
  const { next } = (await one('select coalesce(max(sort_order), 0) + 1 as next from avatars'))!
  return json(await one('insert into avatars (id, url, label, category, sort_order) values ($1, $2, $3, $4, $5) returning *',
    [id, f.url, f.label, f.category, next]), 201)
})
