'use client'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api'
import { hash } from '@/lib/ids'
import { Close, Grip } from '@/components/icons'

/* ---------- Data loading ---------- */

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Loads `path` and exposes { data, error, loading, reload, setData }.
export function useApi<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true })
  const reload = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: '' }))
    try { setState({ data: await api<T>(path), error: '', loading: false }) } catch (e) { setState(s => ({ ...s, error: message(e), loading: false })) }
  }, [path])
  useEffect(() => { reload() }, [reload])
  const setData = useCallback((data: T | ((d: T | null) => T)) =>
    setState(s => ({ ...s, data: typeof data === 'function' ? (data as (d: T | null) => T)(s.data) : data })), [])
  return { ...state, reload, setData }
}

export function Loading({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  if (error) return <div className="adm-error">{error} {onRetry && <button className="adm-btn" onClick={onRetry}>Try again</button>}</div>
  return <p className="adm-muted">Loading…</p>
}

/* ---------- Toasts ---------- */

type Toast = (text: string, kind?: 'ok' | 'bad') => void
const ToastCtx = createContext<Toast>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: 'ok' | 'bad' }[]>([])
  const show = useCallback<Toast>((text, kind = 'ok') => {
    const id = Math.random()
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`adm-toast ${t.kind}`}>{t.kind === 'ok' ? '✓ ' : ''}{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Modal ---------- */

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  tabs?: [string, string][]
  tab?: string
  onTab?: (k: string) => void
  dirty?: boolean
  narrow?: boolean
  wide?: boolean
}

// Closing a modal with unsaved changes (dirty) asks first.
export function Modal({ title, onClose, children, footer, tabs, tab, onTab, dirty = false, narrow = false, wide = false }: ModalProps) {
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tryClose = () => (dirty ? setConfirming(true) : onClose())
  const closeRef = useRef(tryClose)
  closeRef.current = tryClose

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && ref.current?.contains(document.activeElement)) { e.stopPropagation(); closeRef.current() } }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('adm-modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      if (!document.querySelector('.adm-scrim')) document.body.classList.remove('adm-modal-open')
      prev?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="adm-scrim" onMouseDown={e => { if (e.target === e.currentTarget) tryClose() }}>
      <div className={`adm-modal ${narrow ? 'narrow' : ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="adm-mhead"><h2>{title}</h2><button className="adm-icon" aria-label="Close" onClick={tryClose}><Close size={18} /></button></div>
        {tabs && (
          <div className="adm-mtabs" role="tablist">
            {tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => onTab?.(key)}>{label}</button>)}
          </div>
        )}
        <div className="adm-mbody">{children}</div>
        {confirming
          ? <div className="adm-mfoot warn"><span>You have unsaved changes.</span><span className="grow" /><button className="adm-btn" onClick={() => setConfirming(false)}>Keep editing</button><button className="adm-btn danger" onClick={onClose}>Discard changes</button></div>
          : footer && <div className="adm-mfoot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// Typed confirmation for anything that can't be undone.
export function ConfirmDelete({ title, expected, what, children, onConfirm, onClose }: {
  title: string; expected: string; what: string; children: ReactNode; onConfirm: (typed: string) => Promise<void>; onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = typed.trim().toLowerCase() === expected.trim().toLowerCase()
  const go = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!ok) return
    setBusy(true); setErr('')
    try { await onConfirm(typed) } catch (e) { setErr(message(e)); setBusy(false) }
  }
  return (
    <Modal title={title} onClose={onClose} narrow
      footer={<><span className="grow" /><button className="adm-btn" onClick={onClose}>Cancel</button><button className="adm-btn danger solid" disabled={!ok || busy} onClick={() => go()}>{busy ? 'Deleting…' : 'Delete'}</button></>}>
      <form onSubmit={go} className="adm-stack">
        <div className="adm-danger"><b>This can&apos;t be undone.</b>{children}</div>
        {err && <div className="adm-error">{err}</div>}
        <TextField label={<>Type <b>{expected}</b> to confirm</>} value={typed} onChange={setTyped} autoFocus autoComplete="off" aria-label={`Type the ${what} to confirm`} />
      </form>
    </Modal>
  )
}

/* ---------- Form fields ---------- */

type TextFieldProps = {
  label: ReactNode; value: string | number | null | undefined; onChange: (v: string) => void; hint?: ReactNode; error?: string; multiline?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

export function TextField({ label, value, onChange, hint, error, multiline, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} className={error ? 'bad' : ''} rows={3} maxLength={rest.maxLength} />
        : <input id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} className={error ? 'bad' : ''} {...rest} />}
      {error ? <small className="adm-err-text">{error}</small> : hint && <small>{hint}</small>}
    </div>
  )
}

export function SelectField({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: string }) {
  const id = useId()
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="adm-field adm-color">
      <label htmlFor={id}>{label}</label>
      <div><input id={id} type="color" value={value} onChange={e => onChange(e.target.value)} /><code>{value}</code></div>
    </div>
  )
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="adm-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}{hint && <small>{hint}</small>}</span>
    </label>
  )
}

/* ---------- Drag to reorder ---------- */

// Rows can be dragged by the handle, or moved with the ↑ ↓ buttons.
export function SortableList<T>({ items, getKey, onChange, render, className = 'adm-sortable' }: {
  items: T[]; getKey: (item: T) => string | number; onChange: (items: T[]) => void; render: (item: T, i: number) => ReactNode; className?: string
}) {
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [armed, setArmed] = useState<number | null>(null) // only the grip starts a drag, so inputs in rows stay usable
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }
  const reset = () => { setDrag(null); setOver(null); setArmed(null) }
  return (
    <ol className={className}>
      {items.map((item, i) => (
        <li key={getKey(item)} className={`${drag === i ? 'dragging' : ''} ${over === i && drag !== null && drag !== i ? 'over' : ''}`}
          draggable={armed === i} onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
          onDragOver={e => { if (drag === null) return; e.preventDefault(); setOver(i) }} onDragEnd={reset}
          onDrop={e => { e.preventDefault(); if (drag !== null) move(drag, i); reset() }}>
          <span className="adm-grip" title="Drag to reorder" onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)}><Grip size={16} /></span>
          {render(item, i)}
          <span className="adm-move">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
            <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ---------- Misc ---------- */

export interface ThumbSource { id?: string; name?: string; image?: string | null; poster?: string | null }

// Show artwork thumbnail; reports a broken image link through onBroken.
export function Thumb({ t, onBroken, size = 'sm' }: { t: ThumbSource; onBroken?: (id: string) => void; size?: 'sm' | 'lg' }) {
  const [broken, setBroken] = useState(false)
  const src = t.image || t.poster
  useEffect(() => setBroken(false), [src])
  const h = hash(t.id || t.name || '') % 360
  return (
    <span className={`adm-thumb ${size}`} style={{ background: `linear-gradient(135deg, hsl(${h} 60% 30%), hsl(${(h + 200) % 360} 50% 12%))` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && !broken && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(true); if (t.id) onBroken?.(t.id) }} />}
    </span>
  )
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtAgo = (d?: string | null) => {
  if (!d) return 'never'
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`
  return fmtDate(d)
}

export { message as errorMessage }
