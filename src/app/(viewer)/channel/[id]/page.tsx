import { ChannelPage } from '@/views/Main'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ChannelPage id={(await params).id} />
}
