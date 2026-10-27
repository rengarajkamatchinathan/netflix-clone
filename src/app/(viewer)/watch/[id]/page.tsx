import { ClientOnly } from '@/components/Providers'
import { WatchPage } from '@/views/Player'

// The player only runs in the browser.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ClientOnly><WatchPage id={(await params).id} /></ClientOnly>
}
