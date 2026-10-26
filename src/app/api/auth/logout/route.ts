import { endSession } from '@/server/auth'
import { handle, json } from '@/server/http'

export const POST = handle(async () => {
  await endSession()
  return json({ ok: true })
})
