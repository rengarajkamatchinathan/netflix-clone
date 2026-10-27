// Session lookups for server components and layouts, cached once per request.
import { cache } from 'react'
import { cookies } from 'next/headers'
import { ME_COLUMNS, toMe, type MeRow } from './account'
import { PROFILE_COOKIE, SESSION_USER_COLS, sessionClaims, sessionValid, type SessionUser } from './auth'
import { one } from './db'
import type { Me } from '@/lib/types'

// The session check and the account load share one query.
export const getMe = cache(async (): Promise<Me | null> => {
  const claims = await sessionClaims()
  if (!claims) return null
  const row = await one<SessionUser & MeRow>(`select ${SESSION_USER_COLS}, ${ME_COLUMNS} from users where id = $1`, [claims.uid])
  return row && sessionValid(row, claims) ? toMe(row, row) : null
})

// The profile chosen in this browser, if it belongs to the signed-in account.
export const getActiveProfileId = cache(async (): Promise<number | null> => {
  const me = await getMe()
  const id = Number((await cookies()).get(PROFILE_COOKIE)?.value)
  return me?.profiles.some(p => p.id === id) ? id : null
})

export const homeFor = (me: Me) => (me.user.role === 'admin' ? '/admin' : '/profiles')
