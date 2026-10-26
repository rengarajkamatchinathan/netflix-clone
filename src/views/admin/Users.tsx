'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useUser } from '@/context/AppContext'
import { Avatar } from '@/components/ui'
import { Search } from '@/components/icons'
import { ConfirmDelete, errorMessage, fmtAgo, fmtDate, Loading, Modal, useApi, useToast } from './kit'
import type { AdminUserDetail, AdminUserRow } from './types'

const FILTERS: [string, string][] = [['all', 'All'], ['admin', 'Admins'], ['disabled', 'Disabled'], ['locked', 'Locked']]

export function StatusPills({ u }: { u: Pick<AdminUserRow, 'role' | 'disabled' | 'locked'> }) {
  return <>
    {u.role === 'admin' && <span className="adm-pill red">Admin</span>}
    {u.disabled ? <span className="adm-pill bad">Disabled</span> : <span className="adm-pill ok">Active</span>}
    {u.locked && <span className="adm-pill warn" title="Too many wrong security answers">Locked</span>}
  </>
}

export function UsersPage() {
  const users = useApi<AdminUserRow[]>('/admin/users')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  const list = useMemo(() => (users.data || []).filter(u =>
    u.email.includes(q.trim().toLowerCase()) &&
    (filter === 'all' || (filter === 'admin' ? u.role === 'admin' : filter === 'disabled' ? u.disabled : u.locked))), [users.data, q, filter])

  if (!users.data) return <Loading error={users.error} onRetry={users.reload} />
  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Users</h1></div>
      <div className="adm-toolbar">
        <label className="adm-search"><Search size={16} /><input placeholder="Search by email" value={q} onChange={e => setQ(e.target.value)} aria-label="Search by email" /></label>
        <div className="adm-seg" role="group" aria-label="Filter users">
          {FILTERS.map(([k, l]) => <button key={k} aria-pressed={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Email</th><th>Status</th><th className="num">Profiles</th><th>Joined</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id} tabIndex={0} onClick={() => router.push(`/admin/users/${u.id}`)} onKeyDown={e => e.key === 'Enter' && router.push(`/admin/users/${u.id}`)}>
                <td><Link href={`/admin/users/${u.id}`} onClick={e => e.stopPropagation()}>{u.email}</Link></td>
                <td><StatusPills u={u} /></td>
                <td className="num">{u.profiles}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>{fmtAgo(u.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="adm-empty">No users match.</p>}
    </div>
  )
}

export function UserDetailPage({ id }: { id: string }) {
  const me = useUser()
  const toast = useToast()
  const router = useRouter()
  const u = useApi<AdminUserDetail>(`/admin/users/${id}`)
  const [busy, setBusy] = useState('')
  const [tempPw, setTempPw] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!u.data) return <Loading error={u.error} onRetry={u.reload} />
  const user = u.data
  const self = user.id === me.id

  async function act<T>(key: string, fn: () => Promise<T>, done?: string): Promise<T | undefined> {
    setBusy(key)
    try { const r = await fn(); if (done) toast(done); await u.reload(); return r } catch (e) { toast(errorMessage(e), 'bad') } finally { setBusy('') }
  }
  const patch = (body: object, done: string) => act('patch', () => api(`/admin/users/${user.id}`, { method: 'PATCH', body }), done)
  const resetPassword = async () => {
    const r = await act('reset', () => api<{ password: string }>(`/admin/users/${user.id}/reset-password`, { method: 'POST' }))
    if (r) setTempPw(r.password)
  }

  return (
    <div className="adm-page">
      <Link className="adm-link" href="/admin/users">← All users</Link>
      <div className="adm-head">
        <h1 className="adm-break">{user.email}</h1>
        <div className="adm-pills"><StatusPills u={user} /></div>
      </div>
      <p className="adm-muted">Joined {fmtDate(user.created_at)} · last sign-in {fmtAgo(user.last_login_at)}</p>

      <section className="adm-panel">
        <h2>Actions</h2>
        {self && <p className="adm-muted">This is your account. Change your own password on the <Link className="adm-link" href="/account">Account</Link> page.</p>}
        <div className="adm-actions">
          {user.locked && <button className="adm-btn" disabled={!!busy} onClick={() => act('unlock', () => api(`/admin/users/${user.id}/unlock`, { method: 'POST' }), 'Password recovery unlocked')}>Unlock recovery</button>}
          {!self && <>
            <button className="adm-btn" disabled={!!busy} onClick={resetPassword}>Reset password</button>
            <button className="adm-btn" disabled={!!busy} onClick={() => patch({ role: user.role === 'admin' ? 'user' : 'admin' }, user.role === 'admin' ? 'Admin access removed' : 'Made admin')}>{user.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
            <button className="adm-btn" disabled={!!busy} onClick={() => patch({ disabled: !user.disabled }, user.disabled ? 'Account enabled' : 'Account disabled and signed out')}>{user.disabled ? 'Enable account' : 'Disable account'}</button>
            <button className="adm-btn danger" disabled={!!busy} onClick={() => setDeleting(true)}>Delete user</button>
          </>}
        </div>
      </section>

      <section className="adm-panel">
        <h2>Profiles ({user.profiles.length})</h2>
        <div className="adm-profiles">
          {user.profiles.map(p => (
            <div key={p.id} className="adm-profile">
              <Avatar color={p.color} src={p.avatar_url} size={56} />
              <b>{p.name}</b>
              <small>{p.is_kids ? 'Kids · ' : ''}{p.list} in My List</small>
            </div>
          ))}
        </div>
      </section>

      <section className="adm-panel">
        <h2>Recently watched</h2>
        {user.activity.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Show</th><th>Profile</th><th className="num">Watched</th><th>When</th></tr></thead>
              <tbody>{user.activity.map(a => <tr key={a.title_id + a.profile}><td>{a.title}</td><td>{a.profile}</td><td className="num">{a.pct}%</td><td>{fmtAgo(a.updated_at)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="adm-muted">Nothing watched yet.</p>}
      </section>

      {tempPw && (
        <Modal title="Temporary password" narrow onClose={() => setTempPw(null)} footer={<><span className="grow" /><button className="adm-btn primary" onClick={() => setTempPw(null)}>Done</button></>}>
          <div className="adm-stack">
            <p>Give this password to {user.email}. They&apos;ve been signed out everywhere and should change it on their Account page after signing in.</p>
            <div className="adm-temp-pw">
              <code>{tempPw}</code>
              <button className="adm-btn small" onClick={() => navigator.clipboard?.writeText(tempPw).then(() => toast('Copied'), () => {})}>Copy</button>
            </div>
            <p className="adm-muted">It won&apos;t be shown again.</p>
          </div>
        </Modal>
      )}
      {deleting && (
        <ConfirmDelete title={`Delete ${user.email}?`} expected={user.email} what="email" onClose={() => setDeleting(false)}
          onConfirm={async confirm => {
            await api(`/admin/users/${user.id}`, { method: 'DELETE', body: { confirm } })
            toast(`${user.email} deleted`)
            router.replace('/admin/users')
          }}>
          Their {user.profiles.length} profile{user.profiles.length === 1 ? '' : 's'}, My Lists and watch history will be deleted too.
        </ConfirmDelete>
      )}
    </div>
  )
}
