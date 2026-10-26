'use client'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import type { AccountUser, Me, Profile, SecurityAnswer, WatchPosition } from '@/lib/types'

// Signed-in account and its profiles, kept on the server. The chosen profile is a cookie so the
// server can check it before rendering the viewer pages.
export const AVATAR_COLORS = ['#e50914', '#2f80ed', '#f2c94c', '#27ae60', '#9b51e0', '#f2994a']
const PROFILE_COOKIE = 'sf_profile'

export type ProfileFields = { name: string; color: string; avatarId: string | null; isKids: boolean }

interface AppValue {
  user: (AccountUser & { profiles: Profile[] }) | null
  profile: Profile | null
  refresh: () => Promise<void>
  signUp: (email: string, password: string, questions: SecurityAnswer[]) => Promise<void>
  signIn: (email: string, password: string, remember: boolean) => Promise<AccountUser>
  signOut: () => Promise<void>
  setActiveProfile: (id: number | null) => void
  addProfile: (fields: ProfileFields) => Promise<void>
  updateProfile: (id: number, fields: ProfileFields) => Promise<void>
  removeProfile: (id: number) => Promise<void>
  toggleList: (titleId: string) => void
  saveProgress: (titleId: string, pct: number) => void
  savePosition: (titleId: string, pos: WatchPosition) => void
  recordPlay: (titleId: string) => void
  markNotificationsSeen: () => void
  forgetTitle: (titleId: string) => Promise<void>
}

const Ctx = createContext<AppValue | null>(null)

function writeProfileCookie(id: number | null) {
  document.cookie = id == null
    ? `${PROFILE_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${PROFILE_COOKIE}=${id}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`
}

export function AppProvider({ initialMe, initialProfileId, children }: { initialMe: Me | null; initialProfileId: number | null; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(initialMe)
  const [activeProfile, setActive] = useState<number | null>(initialProfileId)

  const user = me ? { ...me.user, profiles: me.profiles } : null
  const profile = me?.profiles.find(p => p.id === activeProfile) || null

  const setActiveProfile = useCallback((id: number | null) => { writeProfileCookie(id); setActive(id) }, [])

  const refresh = useCallback(async () => {
    const m = await api<Me | { user: null }>('/me')
    setMe(m.user ? (m as Me) : null)
  }, [])

  const signUp = async (email: string, password: string, questions: SecurityAnswer[]) => {
    setMe(await api<Me>('/auth/signup', { method: 'POST', body: { email, password, questions } }))
    setActiveProfile(null)
  }
  const signIn = async (email: string, password: string, remember: boolean) => {
    const m = await api<Me>('/auth/login', { method: 'POST', body: { email, password, remember } })
    setMe(m)
    setActiveProfile(null)
    return m.user
  }
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setActiveProfile(null)
    setMe(null)
  }

  // Profile changes return the updated account from the server.
  const addProfile = async (fields: ProfileFields) => setMe(await api<Me>('/profiles', { method: 'POST', body: fields }))
  const updateProfile = async (id: number, fields: ProfileFields) => setMe(await api<Me>(`/profiles/${id}`, { method: 'PUT', body: fields }))
  const removeProfile = async (id: number) => {
    setMe(await api<Me>(`/profiles/${id}`, { method: 'DELETE' }))
    if (id === activeProfile) setActiveProfile(null)
  }

  // My List and progress update on screen straight away and save in the background.
  const patchProfile = (id: number, fn: (p: Profile) => Profile) =>
    setMe(m => m && { ...m, profiles: m.profiles.map(p => (p.id === id ? fn(p) : p)) })

  const toggleList = (titleId: string) => {
    if (!profile) return
    const inList = profile.list.includes(titleId)
    patchProfile(profile.id, p => ({ ...p, list: inList ? p.list.filter(x => x !== titleId) : [titleId, ...p.list] }))
    api(`/profiles/${profile.id}/list/${encodeURIComponent(titleId)}`, { method: inList ? 'DELETE' : 'PUT' }).catch(() => refresh())
  }
  const saveProgress = (titleId: string, pct: number) => {
    if (!profile) return
    patchProfile(profile.id, p => ({ ...p, progress: { ...p.progress, [titleId]: pct } }))
    api(`/profiles/${profile.id}/progress/${encodeURIComponent(titleId)}`, { method: 'PUT', body: { pct } }).catch(() => {})
  }
  const savePosition = (titleId: string, pos: WatchPosition) => {
    if (!profile) return
    patchProfile(profile.id, p => ({ ...p, position: { ...p.position, [titleId]: pos } }))
    api(`/profiles/${profile.id}/position/${encodeURIComponent(titleId)}`, { method: 'PUT', body: pos }).catch(() => {})
  }

  // Playback is off-site, so pressing Play counts as watching. Season/episode come from the saved position.
  const recordPlay = (titleId: string) => {
    if (!profile) return
    patchProfile(profile.id, p => ({ ...p, recent: [titleId, ...p.recent.filter(x => x !== titleId)].slice(0, 20) }))
    api(`/profiles/${profile.id}/plays/${encodeURIComponent(titleId)}`, { method: 'POST' }).catch(() => {})
  }

  const markNotificationsSeen = () => {
    if (!profile) return
    patchProfile(profile.id, p => ({ ...p, notifSeenAt: new Date().toISOString() }))
    api(`/profiles/${profile.id}/notifications`, { method: 'PUT' }).catch(() => {})
  }

  // Removes a show from the profile's history (plays, progress and saved episode).
  const forgetTitle = async (titleId: string) => {
    if (!profile) return
    await api(`/profiles/${profile.id}/history/${encodeURIComponent(titleId)}`, { method: 'DELETE' })
    patchProfile(profile.id, p => {
      const { [titleId]: _pct, ...progress } = p.progress
      const { [titleId]: _pos, ...position } = p.position
      return { ...p, recent: p.recent.filter(x => x !== titleId), progress, position }
    })
  }

  return (
    <Ctx.Provider value={{
      user, profile, refresh, signUp, signIn, signOut, setActiveProfile,
      addProfile, updateProfile, removeProfile, toggleList, saveProgress, savePosition, recordPlay, markNotificationsSeen, forgetTitle,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useApp(): AppValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}

// For pages that only render for a signed-in user (their layouts check this on the server).
export function useUser() {
  const { user } = useApp()
  if (!user) throw new Error('Expected a signed-in user')
  return user
}
