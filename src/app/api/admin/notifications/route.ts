import { str } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { many, one } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'
import { notificationOut, notify } from '@/server/notifications'

export const GET = handle(async () => {
  await requireAdmin()
  return json((await many('select * from notifications order by created_at desc limit 100')).map(notificationOut))
})

// An announcement to every profile, optionally pointing at a show or channel.
export const POST = handle(async req => {
  await requireAdmin()
  const b = await readBody(req)
  const heading = str(b.heading, 80, 'Heading')
  if (!heading) fail(400, 'Enter a heading.')
  const titleId = b.titleId ? String(b.titleId) : null
  const channelId = b.channelId ? String(b.channelId) : null
  if (titleId && !(await one('select 1 from titles where id = $1', [titleId]))) fail(400, 'That show no longer exists.')
  if (channelId && !(await one('select 1 from channels where id = $1', [channelId]))) fail(400, 'That channel no longer exists.')
  await notify({ kind: 'announcement', titleId, channelId, heading, body: str(b.body, 200, 'Message') })
  return json({ ok: true }, 201)
})
