import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { RequireUser } from '@/components/Providers'
import { BrowseProvider } from '@/components/Browse'
import { getActiveProfileId, getMe } from '@/server/session'

// Browsing and watching: needs a signed-in user who has picked a profile. Rendered on the server, so
// the page arrives drawn; the parts that follow the viewer's clock or window fill in in the browser.
export default async function ViewerLayout({ children }: { children: ReactNode }) {
  if (!(await getMe())) redirect('/login')
  if (!(await getActiveProfileId())) redirect('/profiles')
  return (
    <RequireUser profile>
      <BrowseProvider>{children}</BrowseProvider>
    </RequireUser>
  )
}
