import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { ClientOnly, RequireUser } from '@/components/Providers'
import { BrowseProvider } from '@/components/Browse'
import { getActiveProfileId, getMe } from '@/server/session'

// Browsing and watching: needs a signed-in user who has picked a profile.
export default async function ViewerLayout({ children }: { children: ReactNode }) {
  if (!(await getMe())) redirect('/login')
  if (!(await getActiveProfileId())) redirect('/profiles')
  return (
    <RequireUser profile>
      <ClientOnly>
        <BrowseProvider>{children}</BrowseProvider>
      </ClientOnly>
    </RequireUser>
  )
}
