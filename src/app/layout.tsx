import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/components/Providers'
import { loadCatalog } from '@/server/catalog'
import { getActiveProfileId, getMe } from '@/server/session'
import './globals.css'

export const metadata: Metadata = { title: 'StreamFlix', description: 'Films, series and the cartoon channels you grew up with.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [me, profileId, catalog] = await Promise.all([getMe(), getActiveProfileId(), loadCatalog()])
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers initialMe={me} initialProfileId={profileId} initialCatalog={catalog}>{children}</Providers>
      </body>
    </html>
  )
}
