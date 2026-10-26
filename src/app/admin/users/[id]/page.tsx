import { UserDetailPage } from '@/views/admin/Users'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <UserDetailPage key={id} id={id} />
}
