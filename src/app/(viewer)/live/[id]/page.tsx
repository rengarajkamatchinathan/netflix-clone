import { ClientOnly } from '@/components/Providers'
import { LivePage } from '@/views/Player'

// The live player follows the viewer's clock and picks random bumpers, so it only runs in the browser.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ClientOnly><LivePage id={(await params).id} /></ClientOnly>
}
