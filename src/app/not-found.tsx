import Link from 'next/link'
import { Logo } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="boot">
      <Logo size={48} />
      <p>That page doesn&apos;t exist.</p>
      <Link className="btn red small" href="/">Go to StreamFlix</Link>
    </div>
  )
}
