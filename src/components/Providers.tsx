'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppProvider, useApp } from '@/context/AppContext'
import { CatalogProvider } from '@/context/CatalogContext'
import type { CatalogData, Me } from '@/lib/types'

export function Providers({ initialMe, initialProfileId, initialCatalog, children }: {
  initialMe: Me | null; initialProfileId: number | null; initialCatalog: CatalogData; children: ReactNode
}) {
  return (
    <AppProvider initialMe={initialMe} initialProfileId={initialProfileId}>
      <CatalogProvider initial={initialCatalog}>{children}</CatalogProvider>
    </AppProvider>
  )
}

// Layouts check sign-in on the server; this covers signing out (or switching away) while on the page.
export function RequireUser({ admin = false, profile = false, children }: { admin?: boolean; profile?: boolean; children: ReactNode }) {
  const { user, profile: active } = useApp()
  const router = useRouter()
  const ok = !!user && (!admin || user.role === 'admin') && (!profile || !!active)
  useEffect(() => {
    if (ok) return
    router.replace(user ? '/profiles' : '/')
  }, [ok, user, router])
  return ok ? children : null
}

// Renders children only in the browser: for the players, and for parts that depend on the window
// or saved browser settings, where server HTML would never match.
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}

// The viewer's clock, ticking every `ms`. Null on the server and while the page hydrates (the server's
// clock and time zone aren't the viewer's), so schedules render once the page is in the browser.
export function useNow(ms = 30000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const h = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(h)
  }, [ms])
  return now
}
