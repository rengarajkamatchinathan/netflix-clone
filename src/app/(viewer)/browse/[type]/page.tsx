import { BrowsePage } from '@/views/Main'

export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  return <BrowsePage type={(await params).type} />
}
