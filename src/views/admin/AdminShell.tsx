'use client'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useApp, useUser } from '@/context/AppContext'
import { Logo } from '@/components/ui'
import { fmtAgo, Loading, ToastProvider, useApi } from './kit'
import type { Stats } from './types'

const NAV: [string, string][] = [['/admin', 'Dashboard'], ['/admin/users', 'Users'], ['/admin/channels', 'Channels'], ['/admin/series', 'Series'], ['/admin/movies', 'Movies'], ['/admin/shows', 'All shows'], ['/admin/avatars', 'Avatars']]
const isActive = (path: string, to: string) => (to === '/admin' ? path === to : path === to || path.startsWith(to + '/'))

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useUser()
  const { signOut } = useApp()
  const router = useRouter()
  const path = usePathname()
  const [open, setOpen] = useState(false)
  return (
    <ToastProvider>
      <div className="adm">
        <aside className={`adm-side ${open ? 'open' : ''}`}>
          <div className="adm-brand">
            <Link href="/admin"><Logo size={26} /></Link><span>Admin</span>
            <button className="adm-menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
          </div>
          <nav onClick={() => setOpen(false)}>
            {NAV.map(([to, label]) => <Link key={to} href={to} className={isActive(path, to) ? 'active' : ''}>{label}</Link>)}
            <hr />
            <Link href="/profiles">View site ↗</Link>
            <Link href="/account">My account</Link>
            <button onClick={async () => { await signOut(); router.replace('/') }}>Sign out</button>
          </nav>
          <p className="adm-who">{user.email}</p>
        </aside>
        <main className="adm-main">{children}</main>
      </div>
    </ToastProvider>
  )
}

export function Dashboard() {
  const stats = useApi<Stats>('/admin/stats')
  if (!stats.data) return <Loading error={stats.error} onRetry={stats.reload} />
  const { counts, recent, popular } = stats.data
  const tiles: [string, number, string | null, string | null][] = [
    ['Users', counts.users, `${counts.newUsers} new this week`, '/admin/users'],
    ['Profiles', counts.profiles, null, null],
    ['Shows', counts.titles, null, '/admin/shows'],
    ['Channels', counts.channels, null, '/admin/channels'],
    ['Avatars', counts.avatars, null, '/admin/avatars'],
    ['Plays', counts.plays7d, 'in the last 7 days', null],
  ]
  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Dashboard</h1></div>
      <div className="adm-tiles">
        {tiles.map(([label, n, sub, to]) => {
          const body = <><small>{label}</small><b>{n.toLocaleString('en-GB')}</b>{sub && <span>{sub}</span>}</>
          return to ? <Link key={label} href={to} className="adm-tile">{body}</Link> : <div key={label} className="adm-tile">{body}</div>
        })}
      </div>
      <div className="adm-two">
        <section className="adm-panel">
          <h2>Newest accounts</h2>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Email</th><th className="num">Profiles</th><th>Joined</th></tr></thead>
              <tbody>{recent.map(u => <tr key={u.id}><td><Link href={`/admin/users/${u.id}`}>{u.email}</Link></td><td className="num">{u.profiles}</td><td>{fmtAgo(u.created_at)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="adm-panel">
          <h2>Most watched this week</h2>
          {popular.length ? (
            <ol className="adm-rank">
              {popular.map(t => <li key={t.id}><Link href={`/admin/shows?edit=${encodeURIComponent(t.id)}`}>{t.name}</Link><span>{t.viewers} viewer{t.viewers === 1 ? '' : 's'} · {t.plays} play{t.plays === 1 ? '' : 's'}</span></li>)}
            </ol>
          ) : <p className="adm-muted">Nobody has watched anything in the last 7 days.</p>}
        </section>
      </div>
    </div>
  )
}
