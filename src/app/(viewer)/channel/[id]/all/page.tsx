import { ChannelAllPage } from '@/views/Main'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ChannelAllPage id={(await params).id} />
}
