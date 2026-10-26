import { requireAdmin } from '@/server/auth'
import { one, tx } from '@/server/db'
import { fail, handle, json, readBody } from '@/server/http'

const ACTIONS = ['hide', 'show', 'add-channel', 'remove-channel', 'delete'] as const

// One action on many shows at once.
export const POST = handle(async req => {
  await requireAdmin()
  const b = await readBody(req)
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String))]
  if (!ids.length) fail(400, 'Select at least one show.')
  if (!ACTIONS.includes(b.action)) fail(400, 'Unknown action.')
  const channelId = String(b.channelId || '')
  if (b.action.endsWith('-channel') && !(await one('select 1 from channels where id = $1', [channelId]))) fail(400, 'Pick a channel.')
  if (b.action === 'delete' && Number(b.confirm) !== ids.length) fail(400, `Type ${ids.length} to confirm.`)
  await tx(async c => {
    if (b.action === 'hide' || b.action === 'show') await c.query('update titles set hidden = $2 where id = any($1)', [ids, b.action === 'hide'])
    else if (b.action === 'delete') await c.query('delete from titles where id = any($1)', [ids])
    else if (b.action === 'remove-channel') await c.query('delete from channel_titles where channel_id = $1 and title_id = any($2)', [channelId, ids])
    else {
      // New shows go to the end of the line-up, in the order given.
      for (const id of ids) {
        await c.query(`insert into channel_titles (channel_id, title_id, position)
          select $1, $2, coalesce(max(position), 0) + 1 from channel_titles where channel_id = $1 on conflict do nothing`, [channelId, id])
      }
    }
  })
  return json({ ok: true })
})
