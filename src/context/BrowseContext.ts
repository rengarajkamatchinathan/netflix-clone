'use client'
import { createContext, useContext } from 'react'
import type { Title } from '@/lib/catalog'

// Opening and playing titles from anywhere on the viewer pages. Provided by BrowseProvider.
export type Origin = 'left' | 'right' | 'center'
export interface CardRect { left: number; top: number; width: number; height: number; wide: boolean }
export type Rect = { left: number; top: number; width: number; height: number } | null

export interface BrowseValue {
  openInfo: (t: Title, rect?: Rect) => void
  openTitle: (t: Title, rect?: Rect) => void
  playTitle: (t: Title) => void
  setPreview: (p: { t: Title; origin: Origin; rect: CardRect } | null) => void
}
export const BrowseCtx = createContext<BrowseValue | null>(null)

// For components that also render outside the viewer pages (like the navbar).
export const useBrowseMaybe = () => useContext(BrowseCtx)

export function useBrowse(): BrowseValue {
  const v = useContext(BrowseCtx)
  if (!v) throw new Error('useBrowse must be used inside BrowseProvider')
  return v
}
