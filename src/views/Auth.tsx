'use client'
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { QUESTION_KEYS, SECURITY_QUESTIONS } from '@/lib/securityQuestions'
import type { SecurityAnswer } from '@/lib/types'
import { Logo } from '@/components/ui'
import { Backdrop } from './Public'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOTICES: Record<string, string> = { reset: 'Password updated. Sign in with your new password.' }
const withEmail = (path: string, email: string) => (email.trim() ? `${path}?email=${encodeURIComponent(email.trim())}` : path)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

type FieldProps = { label: ReactNode; error?: string | false; reveal?: boolean } & InputHTMLAttributes<HTMLInputElement>

// Floating-label text field in the sign-in card style.
export function Field({ label, error, type = 'text', reveal, ...input }: FieldProps) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className={`float ${error ? 'bad' : ''}`}>
        <input type={reveal && show ? 'text' : type} placeholder=" " {...input} /><span>{label}</span>
        {reveal && input.value && <button type="button" className="show-pw" onClick={() => setShow(!show)}>{show ? 'HIDE' : 'SHOW'}</button>}
      </label>
      {error && <p className="field-err">ⓧ {error}</p>}
    </div>
  )
}

function QuestionSelect({ label, value, exclude, onChange }: { label: string; value: string; exclude: string; onChange: (k: string) => void }) {
  return (
    <label className="float select">
      <select value={value} onChange={e => onChange(e.target.value)}>
        {QUESTION_KEYS.filter(k => k !== exclude).map(k => <option key={k} value={k}>{SECURITY_QUESTIONS[k]}</option>)}
      </select>
      <span>{label}</span>
    </label>
  )
}

// Two questions with answers.
export function QuestionFields({ value, onChange, touched }: { value: SecurityAnswer[]; onChange: (v: SecurityAnswer[]) => void; touched: boolean }) {
  const set = (i: number, patch: Partial<SecurityAnswer>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  return value.map((q, i) => (
    <div key={i} className="question-pair">
      <QuestionSelect label={`Question ${i + 1}`} value={q.key} exclude={value[1 - i].key} onChange={key => set(i, { key })} />
      <Field label="Your answer" value={q.answer} maxLength={100} autoComplete="off" onChange={e => set(i, { answer: e.target.value })}
        error={touched && q.answer.trim().length < 2 ? 'Enter at least 2 characters.' : ''} />
    </div>
  ))
}

export const emptyQuestions = (): SecurityAnswer[] => [{ key: 'pet', answer: '' }, { key: 'city', answer: '' }]

function AuthShell({ children, onSubmit }: { children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="auth">
      <Backdrop />
      <header className="landing-nav"><Link href="/"><Logo size={44} /></Link></header>
      <form className="auth-card" onSubmit={onSubmit} noValidate>{children}</form>
    </div>
  )
}

export function SignIn() {
  const { signIn } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const notice = NOTICES[params.get('notice') || '']
  const [email, setEmail] = useState(params.get('email') || '')
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const emailBad = touched && !EMAIL_RE.test(email.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!EMAIL_RE.test(email.trim()) || !pw) return
    setBusy(true); setErr('')
    try {
      const user = await signIn(email.trim(), pw, remember)
      router.replace(user.role === 'admin' ? '/admin' : '/profiles')
    } catch (e) { setErr(message(e)); setBusy(false) }
  }

  return (
    <AuthShell onSubmit={submit}>
      <h1>Sign In</h1>
      {notice && !err && <div className="auth-ok">{notice}</div>}
      {err && <div className="auth-err">{err}</div>}
      <Field label="Email address" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} error={emailBad ? 'Please enter a valid email address.' : ''} />
      <Field label="Password" type="password" reveal autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} error={touched && !pw ? 'Enter your password.' : ''} />
      <button className="btn red full" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
      <Link className="center link" href={withEmail('/forgot-password', email)}>Forgot password?</Link>
      <label className="remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me</label>
      <p className="switch">New to StreamFlix? <Link href="/signup">Sign up now.</Link></p>
    </AuthShell>
  )
}

export function SignUp() {
  const { signUp } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState(params.get('email') || '')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [questions, setQuestions] = useState(emptyQuestions)
  const [touched, setTouched] = useState(false)
  const [err, setErr] = useState('')
  const [taken, setTaken] = useState(false)
  const [busy, setBusy] = useState(false)

  const errors = {
    email: !EMAIL_RE.test(email.trim()) ? 'Please enter a valid email address.' : '',
    pw: pw.length < 8 ? 'Use at least 8 characters.' : pw.length > 100 ? 'Use 100 characters or fewer.' : '',
    pw2: pw2 !== pw ? "Passwords don't match." : '',
  }

  const next = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (errors.email || errors.pw || errors.pw2) return
    setBusy(true); setErr(''); setTaken(false)
    try {
      const { available } = await api<{ available: boolean }>('/auth/check-email', { method: 'POST', body: { email: email.trim() } })
      if (!available) { setTaken(true); setErr('An account with this email already exists.') }
      else { setStep(2); setTouched(false) }
    } catch (e) { setErr(message(e)) }
    setBusy(false)
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (questions.some(q => q.answer.trim().length < 2)) return
    setBusy(true); setErr('')
    try {
      await signUp(email.trim(), pw, questions)
      router.replace('/profiles')
    } catch (e) { setErr(message(e)); setBusy(false) }
  }

  return (
    <AuthShell onSubmit={step === 1 ? next : create}>
      <div className="steps-bar" aria-hidden="true"><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
      <p className="step-label">Step {step} of 2</p>
      <h1>{step === 1 ? 'Create your account' : 'Security questions'}</h1>
      {err && <div className="auth-err">{err} {taken && <Link href={withEmail('/login', email)}>Sign in instead.</Link>}</div>}
      {step === 1 ? <>
        <Field label="Email address" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} error={touched && errors.email} />
        <Field label="Password" type="password" reveal autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} error={touched && errors.pw} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} error={touched && errors.pw2} />
        <button className="btn red full" disabled={busy}>{busy ? 'Checking…' : 'Next'}</button>
        <p className="switch">Already have an account? <Link href="/login">Sign in now.</Link></p>
      </> : <>
        <p className="muted">We don&apos;t send emails, so these answers are how you reset your password if you forget it. Pick answers you&apos;ll remember. Capital letters don&apos;t matter.</p>
        <QuestionFields value={questions} onChange={setQuestions} touched={touched} />
        <button className="btn red full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <button type="button" className="link-btn" onClick={() => { setStep(1); setErr('') }}>Back</button>
      </>}
    </AuthShell>
  )
}

interface RecoveryQuestion { slot: number; key: string; text: string }

export function ForgotPassword() {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState<'email' | 'answers' | 'password'>('email')
  const [email, setEmail] = useState(params.get('email') || '')
  const [questions, setQuestions] = useState<RecoveryQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [token, setToken] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [touched, setTouched] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const call = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(message(e)) }
    setBusy(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (step === 'email') {
      if (!EMAIL_RE.test(email.trim())) return
      call(async () => {
        const r = await api<{ questions: RecoveryQuestion[] }>('/auth/recover/start', { method: 'POST', body: { email: email.trim() } })
        setQuestions(r.questions); setAnswers({}); setStep('answers'); setTouched(false)
      })
    } else if (step === 'answers') {
      if (questions.some(q => !(answers[q.slot] || '').trim())) return
      call(async () => {
        const r = await api<{ resetToken: string }>('/auth/recover/verify', { method: 'POST', body: { email: email.trim(), answers } })
        setToken(r.resetToken); setStep('password'); setTouched(false)
      })
    } else {
      if (pw.length < 8 || pw !== pw2) return
      call(async () => {
        await api('/auth/recover/reset', { method: 'POST', body: { resetToken: token, password: pw } })
        router.replace(`${withEmail('/login', email)}${email.trim() ? '&' : '?'}notice=reset`)
      })
    }
  }

  return (
    <AuthShell onSubmit={submit}>
      {step === 'email' && <>
        <h1>Reset your password</h1>
        {err && <div className="auth-err">{err}</div>}
        <p className="muted">Enter the email you signed up with. You&apos;ll answer your security questions next.</p>
        <Field label="Email address" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} error={touched && !EMAIL_RE.test(email.trim()) ? 'Please enter a valid email address.' : ''} />
        <button className="btn red full" disabled={busy}>{busy ? 'Please wait…' : 'Continue'}</button>
      </>}
      {step === 'answers' && <>
        <h1>Answer your security questions</h1>
        {err && <div className="auth-err">{err}</div>}
        <p className="muted">For {email.trim()}. Capital letters and extra spaces don&apos;t matter.</p>
        {questions.map(q => (
          <Field key={q.slot} label={q.text} autoComplete="off" value={answers[q.slot] || ''} onChange={e => setAnswers({ ...answers, [q.slot]: e.target.value })}
            error={touched && !(answers[q.slot] || '').trim() ? 'Enter your answer.' : ''} />
        ))}
        <button className="btn red full" disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button>
        <button type="button" className="link-btn" onClick={() => { setStep('email'); setErr('') }}>Use a different email</button>
      </>}
      {step === 'password' && <>
        <h1>Set a new password</h1>
        {err && <div className="auth-err">{err}</div>}
        <Field label="New password" type="password" reveal autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} error={touched && pw.length < 8 ? 'Use at least 8 characters.' : ''} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} error={touched && pw2 !== pw ? "Passwords don't match." : ''} />
        <p className="fine">You&apos;ll be signed out on all other devices.</p>
        <button className="btn red full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </>}
      <p className="switch">Remembered it? <Link href={withEmail('/login', email)}>Sign in.</Link></p>
    </AuthShell>
  )
}
