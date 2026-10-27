import { requireUser } from '@/server/auth'
import { channelVideos } from '@/server/catalog'
import { handle, json } from '@/server/http'

// Episode links of every show on a channel, keyed by title id, for the live player.
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  await requireUser()
  return json(await channelVideos(id))
})
