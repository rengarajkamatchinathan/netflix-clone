import { ownProfile } from '@/server/account'
import { requireUser } from '@/server/auth'
import { one } from '@/server/db'
import { handle, json } from '@/server/http'

// Marks every notification so far as read for this profile.
export const PUT = handle<{ id: string }>(async (_req, { id }) => {
  const p = await ownProfile((await requireUser()).id, id)
  const row = (await one('update profiles set notif_seen_at = now() where id = $1 returning notif_seen_at', [p.id]))!
  return json({ notifSeenAt: new Date(row.notif_seen_at).toISOString() })
})
