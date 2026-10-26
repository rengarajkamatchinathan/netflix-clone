import { ownProfile } from '@/server/account'
import { requireUser } from '@/server/auth'
import { many } from '@/server/db'
import { handle, json } from '@/server/http'

// Every Play press for the profile, newest first.
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const p = await ownProfile((await requireUser()).id, id)
  const rows = await many('select title_id, season, episode, played_at from play_events where profile_id = $1 order by played_at desc limit 500', [p.id])
  return json(rows.map(r => ({ titleId: r.title_id, season: r.season, episode: r.episode, playedAt: new Date(r.played_at).toISOString() })))
})
