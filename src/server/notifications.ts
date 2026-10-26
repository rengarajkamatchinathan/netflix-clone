// Writes the notifications viewers see under the bell.
import type pg from 'pg'
import type { NotificationKind } from '@/lib/types'
import { many, query } from './db'

interface NewNotification { kind: NotificationKind; titleId?: string | null; channelId?: string | null; heading: string; body?: string; at?: Date | null }

// One notification per show/channel and kind within an hour, so repeated saves don't stack up.
// `at` dates it in the future for scheduled titles; viewers only see it once that time comes.
export async function notify(n: NewNotification, client?: pg.PoolClient) {
  const run = (text: string, params: unknown[]) => (client ? client.query(text, params) : query(text, params))
  if (n.titleId || n.channelId) {
    await run(`delete from notifications where kind = $1 and title_id is not distinct from $2 and channel_id is not distinct from $3
               and created_at > now() - interval '1 hour'`, [n.kind, n.titleId ?? null, n.channelId ?? null])
  }
  await run('insert into notifications (kind, title_id, channel_id, heading, body, created_at) values ($1, $2, $3, $4, $5, coalesce($6, now()))',
    [n.kind, n.titleId ?? null, n.channelId ?? null, n.heading, n.body ?? '', n.at ?? null])
}

// The heading for a newly visible show: the first channel it's on, or the site.
export async function newTitleHeading(titleId: string) {
  const [c] = await many<{ name: string }>(`select c.name from channel_titles ct join channels c on c.id = ct.channel_id
    where ct.title_id = $1 and not c.hidden order by c.sort_order limit 1`, [titleId])
  return c ? `New on ${c.name}` : 'New on StreamFlix'
}

export const notificationOut = (r: any) => ({
  id: r.id, kind: r.kind, titleId: r.title_id, channelId: r.channel_id, heading: r.heading, body: r.body, createdAt: new Date(r.created_at).toISOString(),
})
