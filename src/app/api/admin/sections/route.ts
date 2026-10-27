import { requireAdmin } from '@/server/auth'
import { catalogChanged } from '@/server/catalog'
import { handle, json, readBody } from '@/server/http'
import { getSections, setSections, type Sections } from '@/server/settings'

export const GET = handle(async () => {
  await requireAdmin()
  return json(await getSections())
})

export const PUT = handle(async req => {
  await requireAdmin()
  const body = await readBody(req)
  const patch: Partial<Sections> = {}
  for (const k of ['series', 'movies'] as const) if (body[k] !== undefined) patch[k] = !!body[k]
  const sections = await setSections(patch)
  catalogChanged()
  return json(sections)
})
