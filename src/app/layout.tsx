import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { Providers } from '@/components/Providers'
import { loadCatalog } from '@/server/catalog'
import { getActiveProfileId, getMe } from '@/server/session'
import './globals.css'

export const metadata: Metadata = { title: 'StreamFlix', description: 'Films, series and the cartoon channels you grew up with.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

// Served from our own domain with the page (no trip to Google first); globals.css uses the variables.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-inter', display: 'swap' })
const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' })

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [me, profileId, catalog] = await Promise.all([getMe(), getActiveProfileId(), loadCatalog()])
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <body>
        <Providers initialMe={me} initialProfileId={profileId} initialCatalog={catalog}>{children}</Providers>
      </body>
    </html>
  )
}
