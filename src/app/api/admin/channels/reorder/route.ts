import { requireAdmin } from '@/server/auth'
import { catalogChanged } from '@/server/catalog'
import { tx } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const POST = handle(async req => {
  await requireAdmin()
  const { ids } = await readBody(req)
  if (!Array.isArray(ids)) fail(400, 'Send the channel ids in order.')
  await tx(async c => { for (const [i, id] of (ids as unknown[]).entries()) await c.query('update channels set sort_order = $2 where id = $1', [String(id), i + 1]) })
  catalogChanged()
  return json({ ok: true })
})
