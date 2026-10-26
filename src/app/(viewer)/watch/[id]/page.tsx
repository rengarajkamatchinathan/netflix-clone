import { WatchPage } from '@/views/Player'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WatchPage id={(await params).id} />
}
