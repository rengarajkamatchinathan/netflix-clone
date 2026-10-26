import { ownProfile, titleExists } from '@/server/account'
import { requireUser } from '@/server/auth'
import { query } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

export const PUT = handle<{ id: string; titleId: string }>(async (req, { id, titleId }) => {
  const p = await ownProfile((await requireUser()).id, id)
  const pct = Math.max(0, Math.min(100, Math.round(Number((await readBody(req)).pct) || 0)))
  if (!(await titleExists(titleId))) fail(404, 'That show no longer exists.')
  await query(`insert into watch_progress (profile_id, title_id, pct) values ($1, $2, $3)
    on conflict (profile_id, title_id) do update set pct = excluded.pct, updated_at = now()`, [p.id, titleId, pct])
  return json({ ok: true })
})
