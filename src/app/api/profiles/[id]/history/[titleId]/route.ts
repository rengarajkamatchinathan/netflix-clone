import { ownProfile } from '@/server/account'
import { requireUser } from '@/server/auth'
import { tx } from '@/server/db'
import { handle, json } from '@/server/http'

// Forgets a show for this profile: its plays, progress and saved episode, so it leaves
// Continue Watching and stops steering recommendations.
export const DELETE = handle<{ id: string; titleId: string }>(async (_req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  await tx(async c => {
    for (const table of ['play_events', 'watch_progress', 'watch_position']) await c.query(`delete from ${table} where profile_id = $1 and title_id = $2`, [p.id, titleId])
  })
  return json({ ok: true })
})
