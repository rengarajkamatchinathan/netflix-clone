import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { one } from './db'
import { fail } from './http'
import type { Role } from '@/lib/types'

export const SESSION_COOKIE = 'sf_session'
export const PROFILE_COOKIE = 'sf_profile' // chosen profile, set by the browser
const THIRTY_DAYS = 30 * 24 * 3600

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s === 'change-me') throw new Error('Set JWT_SECRET in .env to a long random string.')
  return s
}

export interface SessionUser {
  id: number
  email: string
  role: Role
  disabled: boolean
  session_version: number
  created_at: Date
}

export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
export const normEmail = (s: unknown) => String(s ?? '').trim().toLowerCase()
export function checkPassword(pw: unknown): asserts pw is string {
  if (typeof pw !== 'string' || pw.length < 8) fail(400, 'Password must be at least 8 characters.')
  if ((pw as string).length > 100) fail(400, 'Password must be 100 characters or fewer.')
}

export const signToken = (payload: object, expiresIn: jwt.SignOptions['expiresIn']) => jwt.sign(payload, secret(), { expiresIn })
export function readToken(token: unknown): Record<string, any> | null {
  if (typeof token !== 'string') return null
  try { return jwt.verify(token, secret()) as Record<string, any> } catch { return null }
}

// Session cookie holds the user id and their session_version; bumping the version signs out every session.
export async function startSession(user: { id: number; session_version: number }, remember = true) {
  const token = signToken({ uid: user.id, sv: user.session_version }, '30d')
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  })
}

export async function endSession() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  jar.delete(PROFILE_COOKIE)
}

// The signed-in user, or null. A disabled account or a stale session_version counts as signed out.
export async function currentUser(): Promise<SessionUser | null> {
  const claims = readToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!claims?.uid) return null
  const u = await one<SessionUser>('select id, email, role, disabled, session_version, created_at from users where id = $1', [claims.uid])
  return u && !u.disabled && u.session_version === claims.sv ? u : null
}

export async function requireUser(): Promise<SessionUser> {
  return (await currentUser()) ?? fail(401, 'Please sign in.')
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser()
  if (u.role !== 'admin') fail(403, 'Admins only.')
  return u
}

// Small in-memory limiter for repeated failed sign-ins (per email, per server process).
const g = globalThis as typeof globalThis & { __sfLoginFailures?: Map<string, { count: number; until: number }> }
const failures = (g.__sfLoginFailures ??= new Map())
export const loginLimiter = {
  blocked(key: string) {
    const f = failures.get(key)
    if (!f) return false
    if (Date.now() > f.until) { failures.delete(key); return false }
    return f.count >= 10
  },
  fail(key: string) {
    const f = failures.get(key)
    if (!f || Date.now() > f.until) failures.set(key, { count: 1, until: Date.now() + 15 * 60 * 1000 })
    else f.count++
  },
  clear(key: string | undefined) { if (key) failures.delete(key) },
}
