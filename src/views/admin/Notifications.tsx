'use client'
import { useState, type FormEvent } from 'react'
import { api } from '@/lib/api'
import type { AppNotification, NotificationKind } from '@/lib/types'
import { Trash } from '@/components/icons'
import { errorMessage, fmtAgo, Loading, SelectField, TextField, useApi, useToast } from './kit'
import type { AdminChannel, AdminTitleRow } from './types'

const KIND_LABELS: Record<NotificationKind, string> = { title: 'New show', episodes: 'New episodes', channel: 'Channel', announcement: 'Announcement' }

// Announcements to every profile, plus the notifications the site wrote by itself.
export function NotificationsPage() {
  const toast = useToast()
  const list = useApi<AppNotification[]>('/admin/notifications')
  const shows = useApi<AdminTitleRow[]>('/admin/titles')
  const chans = useApi<AdminChannel[]>('/admin/channels')
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (!list.data || !shows.data || !chans.data) {
    return <Loading error={list.error || shows.error || chans.error} onRetry={() => { list.reload(); shows.reload(); chans.reload() }} />
  }
  const showName = (id: string | null) => (id && shows.data!.find(t => t.id === id)?.name) || null
  const chanName = (id: string | null) => (id && chans.data!.find(c => c.id === id)?.name) || null

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!heading.trim()) return setErr('Enter a heading.')
    setBusy(true); setErr('')
    const [kind, id] = target.split(':')
    try {
      await api('/admin/notifications', { method: 'POST', body: { heading, body, titleId: kind === 't' ? id : null, channelId: kind === 'c' ? id : null } })
      toast('Notification sent')
      setHeading(''); setBody(''); setTarget('')
      list.reload()
    } catch (e) { setErr(errorMessage(e)) }
    setBusy(false)
  }
  const remove = async (n: AppNotification) => {
    try { await api(`/admin/notifications/${n.id}`, { method: 'DELETE' }); list.setData(l => (l || []).filter(x => x.id !== n.id)); toast('Notification removed') } catch (e) { toast(errorMessage(e), 'bad') }
  }

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Notifications</h1></div>
      <div className="adm-two">
        <section className="adm-panel">
          <h2>Send an announcement</h2>
          <p className="adm-muted">Every profile sees it under the bell. New shows, new episodes and channels going live are announced automatically.</p>
          <form className="adm-stack" onSubmit={send}>
            {err && <div className="adm-error">{err}</div>}
            <TextField label="Heading" value={heading} onChange={setHeading} maxLength={80} placeholder="Weekend marathon" />
            <TextField label="Message (optional)" value={body} onChange={setBody} maxLength={200} placeholder="Tom & Jerry all day Saturday on Cartoon Network" />
            <SelectField label="Opens (optional)" value={target} onChange={setTarget} hint="Clicking the notification opens this show or channel."
              options={[['', 'Nothing'], ...chans.data.map((c): [string, string] => [`c:${c.id}`, `Channel: ${c.name}`]), ...shows.data.map((t): [string, string] => [`t:${t.id}`, `Show: ${t.name}`])]} />
            <div className="adm-actions"><button className="adm-btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send to everyone'}</button></div>
          </form>
        </section>
        <section className="adm-panel">
          <h2>Recent</h2>
          {list.data.length ? (
            <ul className="adm-plain-list adm-notif-list">
              {list.data.map(n => {
                const future = new Date(n.createdAt) > new Date()
                const about = showName(n.titleId) || chanName(n.channelId)
                return (
                  <li key={n.id}>
                    <span className="adm-notif-main">
                      <b>{n.heading}</b>
                      <small>{[n.body, about && about !== n.body ? `→ ${about}` : null].filter(Boolean).join(' ')}</small>
                      <small>{KIND_LABELS[n.kind]} · {future ? `scheduled for ${new Date(n.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : fmtAgo(n.createdAt)}</small>
                    </span>
                    <button type="button" className="adm-icon" aria-label={`Remove “${n.heading}”`} onClick={() => remove(n)}><Trash size={16} /></button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="adm-muted">Nothing sent yet.</p>}
        </section>
      </div>
    </div>
  )
}
