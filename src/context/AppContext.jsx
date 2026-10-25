import { createContext, useContext, useEffect, useState } from 'react'

// Fake auth + profiles, persisted in localStorage. Not secure — demo only.
const Ctx = createContext(null)
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const AVATAR_COLORS = ['#e50914', '#2f80ed', '#f2c94c', '#27ae60', '#9b51e0', '#f2994a']

export function AppProvider({ children }) {
  const [users, setUsers] = useState(() => load('sf_users', {}))
  const [email, setEmail] = useState(() => load('sf_session', null))
  const [activeProfile, setActiveProfile] = useState(() => load('sf_profile', null))

  useEffect(() => { save('sf_users', users) }, [users])
  useEffect(() => { save('sf_session', email) }, [email])
  useEffect(() => { save('sf_profile', activeProfile) }, [activeProfile])

  const user = email ? users[email] : null
  const profile = user?.profiles.find(p => p.id === activeProfile) || null

  const signUp = (em, password) => {
    if (users[em]) return 'An account with this email already exists.'
    setUsers(u => ({ ...u, [em]: { email: em, password, profiles: [newProfile('You', 0)] } }))
    setEmail(em)
    return null
  }
  const signIn = (em, password) => {
    if (!users[em] || users[em].password !== password) return 'Incorrect email or password. Please try again.'
    setEmail(em)
    return null
  }
  const signOut = () => { setEmail(null); setActiveProfile(null) }

  const updateUser = fn => setUsers(u => ({ ...u, [email]: fn(u[email]) }))
  const updateProfile = (id, fn) =>
    updateUser(u => ({ ...u, profiles: u.profiles.map(p => (p.id === id ? fn(p) : p)) }))

  const addProfile = (name, color) => updateUser(u => ({ ...u, profiles: [...u.profiles, newProfile(name, color)] }))
  const removeProfile = id => updateUser(u => ({ ...u, profiles: u.profiles.filter(p => p.id !== id) }))
  const renameProfile = (id, name, color) => updateProfile(id, p => ({ ...p, name, color }))

  const toggleList = titleId => profile && updateProfile(profile.id, p => ({
    ...p, list: p.list.includes(titleId) ? p.list.filter(x => x !== titleId) : [titleId, ...p.list],
  }))
  const saveProgress = (titleId, pct) => profile && updateProfile(profile.id, p => ({
    ...p, progress: { ...p.progress, [titleId]: pct },
  }))

  return (
    <Ctx.Provider value={{
      user, profile, signUp, signIn, signOut, setActiveProfile,
      addProfile, removeProfile, renameProfile, toggleList, saveProgress,
    }}>
      {children}
    </Ctx.Provider>
  )
}

function newProfile(name, color) {
  return { id: Math.random().toString(36).slice(2, 9), name, color, list: [], progress: {} }
}

export const useApp = () => useContext(Ctx)
