import { ownProfile, titleExists } from '@/server/account'
import { requireUser } from '@/server/auth'
import { query } from '@/server/db'
import { fail, handle, json } from '@/server/http'

// Logs a Play press with the season/episode the profile is up to. Repeat presses within
// 30 seconds count once, so double clicks don't inflate the numbers.
export const POST = handle<{ id: string; titleId: string }>(async (_req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  if (!(await titleExists(titleId))) fail(404, 'That show no longer exists.')
  await query(`insert into play_events (profile_id, title_id, season, episode)
    select $1, $2, w.season, w.episode
    from (select 1) one left join watch_position w on w.profile_id = $1 and w.title_id = $2
    where not exists (select 1 from play_events where profile_id = $1 and title_id = $2 and played_at > now() - interval '30 seconds')`,
  [p.id, titleId])
  return json({ ok: true })
})
