'use client'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { buildCatalog, type Catalog } from '@/lib/catalog'
import type { CatalogData } from '@/lib/types'
import { useApp } from './AppContext'

// The catalog the server rendered with, filtered for kids profiles; reload() refetches it after admin edits.
const Ctx = createContext<{ catalog: Catalog; reload: () => Promise<void> } | null>(null)

export function CatalogProvider({ initial, children }: { initial: CatalogData; children: ReactNode }) {
  const [data, setData] = useState(initial)
  const { profile } = useApp()
  const kids = !!profile?.isKids
  const catalog = useMemo(() => buildCatalog(data, kids), [data, kids])
  const reload = useCallback(async () => setData(await api<CatalogData>('/catalog')), [])
  const value = useMemo(() => ({ catalog, reload }), [catalog, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useCatalogCtx() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCatalog must be used inside CatalogProvider')
  return v
}

export const useCatalog = (): Catalog => useCatalogCtx().catalog
export const useReloadCatalog = () => useCatalogCtx().reload
