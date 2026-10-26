import { LivePage } from '@/views/Player'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <LivePage id={(await params).id} />
}
