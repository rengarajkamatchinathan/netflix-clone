import bcrypt from 'bcryptjs'
import type pg from 'pg'
import { hash } from '@/lib/ids'
import { normalizeAnswer, QUESTION_KEYS, SECURITY_QUESTIONS } from '@/lib/securityQuestions'
import type { Me, SecurityAnswer } from '@/lib/types'
import { one } from './db'
import { fail } from './http'
import type { SessionUser } from './auth'

export const MAX_PROFILES = 5
export const RECENT_LIMIT = 20
export const PROFILE_COLORS = ['#e50914', '#2f80ed', '#f2c94c', '#27ae60', '#9b51e0', '#f2994a']
const HEX = /^#[0-9a-f]{6}$/i

// Everything the app needs about an account, as json columns of one row; $1 is the user id. One query
// (rather than one per table) so a page render waits on a single database round trip.
export const ME_COLUMNS = `
  (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'avatar_id', p.avatar_id, 'color', p.color, 'is_kids', p.is_kids,
      'notif_seen_at', p.notif_seen_at, 'avatar_url', a.url) order by p.id), '[]')
    from profiles p left join avatars a on a.id = p.avatar_id where p.user_id = $1) as profiles,
  (select coalesce(json_agg(json_build_array(l.profile_id, l.title_id) order by l.added_at desc), '[]')
    from my_list l join profiles p on p.id = l.profile_id where p.user_id = $1) as list,
  (select coalesce(json_agg(json_build_array(w.profile_id, w.title_id, w.pct)), '[]')
    from watch_progress w join profiles p on p.id = w.profile_id where p.user_id = $1) as progress,
  (select coalesce(json_agg(json_build_array(w.profile_id, w.title_id, w.season, w.episode)), '[]')
    from watch_position w join profiles p on p.id = w.profile_id where p.user_id = $1) as positions,
  (select coalesce(json_agg(json_build_array(r.profile_id, r.title_id) order by r.last desc), '[]') from (
      select e.profile_id, e.title_id, max(e.played_at) as last, row_number() over (partition by e.profile_id order by max(e.played_at) desc) as n
      from play_events e join profiles p on p.id = e.profile_id where p.user_id = $1 group by e.profile_id, e.title_id) r
    where r.n <= ${RECENT_LIMIT}) as recent,
  (select coalesce(json_agg(question_key order by slot), '[]') from security_answers where user_id = $1) as questions`

type Pair = [number, string]
export interface MeRow {
  profiles: { id: number; name: string; avatar_id: string | null; color: string; is_kids: boolean; notif_seen_at: string; avatar_url: string | null }[]
  list: Pair[]; progress: [number, string, number][]; positions: [number, string, number, number][]; recent: Pair[]; questions: string[]
}

// Shapes a row of ME_COLUMNS for the app.
export function toMe(user: Pick<SessionUser, 'id' | 'email' | 'role' | 'created_at'>, r: MeRow): Me {
  return {
    user: { id: user.id, email: user.email, role: user.role, createdAt: new Date(user.created_at).toISOString(), questions: r.questions },
    profiles: r.profiles.map(p => ({
      id: p.id, name: p.name, avatarId: p.avatar_id, avatarUrl: p.avatar_url, color: p.color, isKids: p.is_kids,
      list: r.list.filter(([pid]) => pid === p.id).map(([, t]) => t),
      progress: Object.fromEntries(r.progress.filter(([pid]) => pid === p.id).map(([, t, pct]) => [t, pct])),
      recent: r.recent.filter(([pid]) => pid === p.id).map(([, t]) => t),
      position: Object.fromEntries(r.positions.filter(([pid]) => pid === p.id).map(([, t, season, episode]) => [t, { season, episode }])),
      notifSeenAt: new Date(p.notif_seen_at).toISOString(),
    })),
  }
}

// Everything the app needs about the signed-in account.
export async function meFor(user: Pick<SessionUser, 'id' | 'email' | 'role' | 'created_at'>): Promise<Me> {
  return toMe(user, (await one<MeRow>(`select ${ME_COLUMNS}`, [user.id]))!)
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
