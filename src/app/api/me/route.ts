import { meFor } from '@/server/account'
import { currentUser } from '@/server/auth'
import { handle, json } from '@/server/http'

export const GET = handle(async () => {
  const user = await currentUser()
  return json(user ? await meFor(user) : { user: null, profiles: [] })
})
