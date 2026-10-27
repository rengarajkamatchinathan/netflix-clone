import { requireUser } from '@/server/auth'
import { titleVideos } from '@/server/catalog'
import { fail, handle, json } from '@/server/http'

// A show's episode links, loaded when the built-in player opens (the catalog only carries their count).
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  await requireUser()
  return json((await titleVideos(id)) ?? fail(404, 'Title not found.'))
})
