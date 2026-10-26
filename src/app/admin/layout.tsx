import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { RequireUser } from '@/components/Providers'
import { AdminShell } from '@/views/admin/AdminShell'
import { getMe } from '@/server/session'
import '@/views/admin/admin.css'

// Admin panel: admins only. Every admin API route checks the role again.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.user.role !== 'admin') redirect('/profiles')
  return <RequireUser admin><AdminShell>{children}</AdminShell></RequireUser>
}
