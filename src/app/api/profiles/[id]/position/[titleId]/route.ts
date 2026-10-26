import { ownProfile, titleExists } from '@/server/account'
import { requireUser } from '@/server/auth'
import { query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

const whole = (v: unknown) => Math.max(1, Math.min(999, Math.round(Number(v) || 1)))

export const PUT = handle<{ id: string; titleId: string }>(async (req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  const body = await readBody(req)
  if (!(await titleExists(titleId))) fail(404, 'That show no longer exists.')
  await query(`insert into watch_position (profile_id, title_id, season, episode) values ($1, $2, $3, $4)
    on conflict (profile_id, title_id) do update set season = excluded.season, episode = excluded.episode, updated_at = now()`,
  [p.id, titleId, whole(body.season), whole(body.episode)])
  return json({ ok: true })
})
