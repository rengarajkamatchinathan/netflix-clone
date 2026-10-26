'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useApp, useUser } from '@/context/AppContext'
import { SECURITY_QUESTIONS } from '@/lib/securityQuestions'
import type { SecurityAnswer } from '@/lib/types'
import { Avatar, Logo } from '@/components/ui'
import { Field, QuestionFields, emptyQuestions } from './Auth'

// Fixed locale so the server-rendered date matches the browser's.
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
type Msg = { ok: boolean; text: string } | null
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [touched, setTouched] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!current || pw.length < 8 || pw !== pw2) return
    setBusy(true); setMsg(null)
    try {
      await api('/me/password', { method: 'PUT', body: { current, password: pw } })
      setMsg({ ok: true, text: 'Password changed. Other devices have been signed out.' })
      setCurrent(''); setPw(''); setPw2(''); setTouched(false)
    } catch (e) { setMsg({ ok: false, text: message(e) }) }
    setBusy(false)
  }

  return (
    <form className="account-card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      {msg && <div className={msg.ok ? 'auth-ok' : 'auth-err'}>{msg.text}</div>}
      <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} error={touched && !current ? 'Enter your current password.' : ''} />
      <Field label="New password" type="password" reveal autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} error={touched && pw.length < 8 ? 'Use at least 8 characters.' : ''} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} error={touched && pw2 !== pw ? "Passwords don't match." : ''} />
      <button className="btn red small" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
    </form>
  )
}

function QuestionsForm({ keys, onSaved }: { keys: string[]; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState('')
  const [questions, setQuestions] = useState<SecurityAnswer[]>(() => (keys.length === 2 ? keys.map(key => ({ key, answer: '' })) : emptyQuestions()))
  const [touched, setTouched] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!current || questions.some(q => q.answer.trim().length < 2)) return
    setBusy(true); setMsg(null)
    try {
      await api('/me/questions', { method: 'PUT', body: { current, questions } })
      await onSaved()
      setMsg({ ok: true, text: 'Security questions saved.' })
      setEditing(false); setCurrent(''); setTouched(false)
    } catch (e) { setMsg({ ok: false, text: message(e) }) }
    setBusy(false)
  }

  return (
    <form className="account-card" onSubmit={submit} noValidate>
      <h2>Security questions</h2>
      {msg && <div className={msg.ok ? 'auth-ok' : 'auth-err'}>{msg.text}</div>}
      {!editing ? <>
        {keys.length
          ? <ul className="question-list">{keys.map(k => <li key={k}>{SECURITY_QUESTIONS[k] || k}</li>)}</ul>
          : <p className="muted">You haven&apos;t set security questions, so you can&apos;t reset a forgotten password yourself. Add them now.</p>}
        <button type="button" className="btn grey small" onClick={() => setEditing(true)}>{keys.length ? 'Change questions' : 'Add questions'}</button>
      </> : <>
        <p className="muted">These are used to reset your password if you forget it.</p>
        <QuestionFields value={questions} onChange={setQuestions} touched={touched} />
        <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} error={touched && !current ? 'Enter your current password.' : ''} />
        <div className="row-btns">
          <button className="btn red small" disabled={busy}>{busy ? 'Saving…' : 'Save questions'}</button>
          <button type="button" className="btn grey small" onClick={() => { setEditing(false); setMsg(null) }}>Cancel</button>
        </div>
      </>}
    </form>
  )
}

export function AccountPage() {
  const user = useUser()
  const { profile, refresh, signOut } = useApp()
  const router = useRouter()
  const back = profile ? '/browse' : '/profiles'
  return (
    <div className="account-page">
      <header className="profiles-nav account-nav">
        <Link href={back}><Logo size={30} /></Link>
        <Link className="link" href={back}>Back to StreamFlix</Link>
      </header>
      <main className="account-main">
        <h1>Account</h1>
        <p className="muted">{user.email} · Member since {fmtDate(user.createdAt)}{user.role === 'admin' && <> · <Link className="link" href="/admin">Admin panel</Link></>}</p>
        <section className="account-card">
          <h2>Profiles</h2>
          <div className="account-profiles">
            {user.profiles.map(p => <span key={p.id}><Avatar color={p.color} src={p.avatarUrl} size={40} /> {p.name}{p.isKids && <small className="kids-tag">Kids</small>}</span>)}
          </div>
          <Link className="btn grey small" href="/profiles?manage=1">Manage profiles</Link>
        </section>
        <PasswordForm />
        <QuestionsForm keys={user.questions} onSaved={refresh} />
        <button className="btn outline" onClick={async () => { await signOut(); router.replace('/') }}>Sign out</button>
      </main>
    </div>
  )
}
