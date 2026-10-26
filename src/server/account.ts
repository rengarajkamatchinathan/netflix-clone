import bcrypt from 'bcryptjs'
import type pg from 'pg'
import { hash } from '@/lib/ids'
import { normalizeAnswer, QUESTION_KEYS, SECURITY_QUESTIONS } from '@/lib/securityQuestions'
import type { Me, SecurityAnswer } from '@/lib/types'
import { many, one } from './db'
import { fail } from './http'
import type { SessionUser } from './auth'

export const MAX_PROFILES = 5
export const PROFILE_COLORS = ['#e50914', '#2f80ed', '#f2c94c', '#27ae60', '#9b51e0', '#f2994a']
const HEX = /^#[0-9a-f]{6}$/i

// Everything the app needs about the signed-in account.
export async function meFor(user: Pick<SessionUser, 'id' | 'email' | 'role' | 'created_at'>): Promise<Me> {
  const profiles = await many(
    `select p.id, p.name, p.avatar_id, p.color, p.is_kids, a.url as avatar_url
     from profiles p left join avatars a on a.id = p.avatar_id where p.user_id = $1 order by p.id`, [user.id])
  const ids = profiles.map(p => p.id)
  const [list, progress, questions] = await Promise.all([
    many('select profile_id, title_id from my_list where profile_id = any($1) order by added_at desc', [ids]),
    many('select profile_id, title_id, pct from watch_progress where profile_id = any($1)', [ids]),
    many('select question_key from security_answers where user_id = $1 order by slot', [user.id]),
  ])
  return {
    user: { id: user.id, email: user.email, role: user.role, createdAt: new Date(user.created_at).toISOString(), questions: questions.map(q => q.question_key) },
    profiles: profiles.map(p => ({
      id: p.id, name: p.name, avatarId: p.avatar_id, avatarUrl: p.avatar_url, color: p.color, isKids: p.is_kids,
      list: list.filter(l => l.profile_id === p.id).map(l => l.title_id),
      progress: Object.fromEntries(progress.filter(x => x.profile_id === p.id).map(x => [x.title_id, x.pct])),
    })),
  }
}

// Validates [{ key, answer }, { key, answer }] and returns it normalised.
export function checkQuestions(questions: unknown): SecurityAnswer[] {
  if (!Array.isArray(questions) || questions.length !== 2) fail(400, 'Choose two security questions.')
  const qs = questions as any[]
  const keys = qs.map(q => q?.key)
  if (keys.some(k => !QUESTION_KEYS.includes(k))) fail(400, 'Choose questions from the list.')
  if (keys[0] === keys[1]) fail(400, 'Choose two different questions.')
  const answers = qs.map(q => normalizeAnswer(q.answer))
  if (answers.some(a => a.length < 2)) fail(400, 'Each answer needs at least 2 characters.')
  if (answers.some(a => a.length > 100)) fail(400, 'Answers must be 100 characters or fewer.')
  return keys.map((key, i) => ({ key, answer: answers[i] }))
}

export async function saveQuestions(client: pg.PoolClient, userId: number, questions: SecurityAnswer[]) {
  await client.query('delete from security_answers where user_id = $1', [userId])
  for (const [i, q] of questions.entries()) {
    await client.query('insert into security_answers (user_id, slot, question_key, answer_hash) values ($1, $2, $3, $4)',
      [userId, i + 1, q.key, await bcrypt.hash(q.answer, 10)])
  }
}

export async function checkCurrentPassword(userId: number, pw: unknown) {
  const row = await one('select password_hash from users where id = $1', [userId])
  if (typeof pw !== 'string' || !row || !(await bcrypt.compare(pw, row.password_hash))) fail(400, 'Your current password is incorrect.')
}

// Unknown emails get two stable decoy questions, so recovery can't be used to find out who has an account.
export function decoyQuestions(email: string): string[] {
  const h = hash(email), n = QUESTION_KEYS.length
  const a = h % n
  const b = (a + 1 + ((h >>> 8) % (n - 1))) % n
  return [QUESTION_KEYS[a], QUESTION_KEYS[b]]
}
export const describeQuestions = (keys: string[]) => keys.map((key, i) => ({ slot: i + 1, key, text: SECURITY_QUESTIONS[key] || key }))

export const defaultProfileColor = (email: string) => PROFILE_COLORS[hash(email) % PROFILE_COLORS.length]

// --- Profiles ---

export async function ownProfile(userId: number, id: string) {
  const p = await one('select * from profiles where id = $1 and user_id = $2', [Number(id) || 0, userId])
  return p ?? fail(404, 'Profile not found.')
}

export async function profileFields(body: Record<string, any>, current: Record<string, any> = {}) {
  const name = body.name === undefined ? current.name : String(body.name).trim()
  if (!name) fail(400, 'Enter a profile name.')
  if (name.length > 30) fail(400, 'Profile names can be up to 30 characters.')
  const color = body.color === undefined ? current.color : body.color
  if (color && !HEX.test(color)) fail(400, 'Pick a colour from the list.')
  const avatarId = body.avatarId === undefined ? current.avatar_id ?? null : body.avatarId || null
  if (avatarId && !(await one('select 1 from avatars where id = $1', [avatarId]))) fail(400, 'That avatar no longer exists.')
  return { name: name as string, color: (color as string) || '#e50914', avatarId: avatarId as string | null, isKids: body.isKids === undefined ? !!current.is_kids : !!body.isKids }
}

export const titleExists = async (id: string) => !!(await one('select 1 from titles where id = $1', [id]))
