import { requireUser } from '@/server/auth'
import { many } from '@/server/db'
import { handle, json } from '@/server/http'
import { notificationOut } from '@/server/notifications'

// The last month of notifications; the app drops ones about shows or channels the profile can't see,
// except announcements, which every grown-up profile gets.
export const GET = handle(async () => {
  await requireUser()
  const rows = await many(`select * from notifications where created_at <= now() and created_at > now() - interval '30 days'
                           order by created_at desc limit 40`)
  return json(rows.map(notificationOut))
})
