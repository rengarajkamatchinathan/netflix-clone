import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { RequireUser } from '@/components/Providers'
import { getMe } from '@/server/session'

// Profiles and account settings: any signed-in user.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  if (!(await getMe())) redirect('/login')
  return <RequireUser>{children}</RequireUser>
}
