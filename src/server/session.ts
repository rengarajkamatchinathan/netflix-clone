// Session lookups for server components and layouts, cached once per request.
import { cache } from 'react'
import { cookies } from 'next/headers'
import { meFor } from './account'
import { currentUser, PROFILE_COOKIE } from './auth'
import type { Me } from '@/lib/types'

export const getMe = cache(async (): Promise<Me | null> => {
  const user = await currentUser()
  return user ? meFor(user) : null
})

// The profile chosen in this browser, if it belongs to the signed-in account.
export const getActiveProfileId = cache(async (): Promise<number | null> => {
  const me = await getMe()
  const id = Number((await cookies()).get(PROFILE_COOKIE)?.value)
  return me?.profiles.some(p => p.id === id) ? id : null
})

export const homeFor = (me: Me) => (me.user.role === 'admin' ? '/admin' : '/profiles')
