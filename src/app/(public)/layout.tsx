import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getMe, homeFor } from '@/server/session'

// Landing, sign-in, sign-up and password reset: signed-in visitors go straight in.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const me = await getMe()
  if (me) redirect(homeFor(me))
  return children
}
