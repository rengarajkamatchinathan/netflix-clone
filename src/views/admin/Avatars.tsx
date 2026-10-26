'use client'
import { useState, type FormEvent } from 'react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui'
import { Plus, Trash } from '@/components/icons'
import { errorMessage, Loading, Modal, TextField, useApi, useToast } from './kit'
import type { AdminAvatar } from './types'

function AvatarModal({ avatar, categories, onClose, onSaved }: { avatar: AdminAvatar | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ url: avatar?.url || '', label: avatar?.label || '', category: avatar?.category || categories[0] || 'Classics' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const listId = 'avatar-categories'

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true); setErr('')
    try {
      await api(avatar ? `/admin/avatars/${avatar.id}` : '/admin/avatars', { method: avatar ? 'PUT' : 'POST', body: form })
      toast(avatar ? 'Avatar saved' : 'Avatar added')
      onSaved(); onClose()
    } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }
  const remove = async () => {
    if (!avatar) return
    setBusy(true)
    try { await api(`/admin/avatars/${avatar.id}`, { method: 'DELETE' }); toast('Avatar deleted'); onSaved(); onClose() } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }

  return (
    <Modal title={avatar ? 'Edit avatar' : 'Add avatar'} narrow onClose={onClose}
      footer={confirmDelete && avatar ? <>
        <span>{avatar.used ? `${avatar.used} profile${avatar.used === 1 ? '' : 's'} use this. They'll switch to a plain colour.` : 'Delete this avatar?'}</span>
        <span className="grow" />
        <button className="adm-btn" onClick={() => setConfirmDelete(false)}>Keep</button>
        <button className="adm-btn danger solid" disabled={busy} onClick={remove}>Delete</button>
      </> : <>
        {avatar && <button className="adm-btn danger" onClick={() => setConfirmDelete(true)}><Trash size={16} /> Delete</button>}
        <span className="grow" />
        <button className="adm-btn" onClick={onClose}>Cancel</button>
        <button className="adm-btn primary" disabled={busy || !form.url.trim()} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <form className="adm-stack" onSubmit={save}>
        {err && <div className="adm-error">{err}</div>}
        <div className="adm-avatar-edit">
          <Avatar src={form.url.trim()} size={96} />
          <div className="adm-stack grow">
            <TextField label="Image link" value={form.url} onChange={v => set({ url: v })} placeholder="https://…" autoFocus />
            <TextField label="Name" value={form.label} onChange={v => set({ label: v })} placeholder="Red panda" maxLength={60} />
            <TextField label="Category" value={form.category} onChange={v => set({ category: v })} list={listId} maxLength={40} hint="Avatars are grouped by category in the picker." />
            <datalist id={listId}>{categories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// Paste many image links at once, one per line, into one category.
function BulkAddModal({ categories, onClose, onSaved }: { categories: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [category, setCategory] = useState(categories[0] || 'Classics')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const urls = text.split(/\s+/).map(s => s.trim()).filter(Boolean)
  const listId = 'bulk-avatar-categories'

  const save = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api<{ added: number; skipped: number }>('/admin/avatars/bulk', { method: 'POST', body: { urls, category } })
      toast(`${r.added} avatar${r.added === 1 ? '' : 's'} added${r.skipped ? `, ${r.skipped} already in the list` : ''}`)
      onSaved(); onClose()
    } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }

  return (
    <Modal title="Add avatars" onClose={onClose} dirty={!!text.trim()}
      footer={<>
        <span className="adm-muted small">{urls.length} link{urls.length === 1 ? '' : 's'}</span>
        <span className="grow" />
        <button className="adm-btn" onClick={onClose}>Cancel</button>
        <button className="adm-btn primary" disabled={busy || !urls.length} onClick={save}>{busy ? 'Adding…' : `Add ${urls.length || ''} avatar${urls.length === 1 ? '' : 's'}`}</button>
      </>}>
      <div className="adm-stack">
        {err && <div className="adm-error">{err}</div>}
        <div className="adm-field">
          <label htmlFor="bulk-urls">Image links, one per line</label>
          <textarea id="bulk-urls" rows={8} value={text} onChange={e => setText(e.target.value)} placeholder={'https://example.com/avatars/panda.png\nhttps://example.com/avatars/robot.png'} autoFocus />
          <small>Links already in the list are skipped. You can name each avatar afterwards.</small>
        </div>
        <TextField label="Category" value={category} onChange={setCategory} list={listId} maxLength={40} hint="Avatars are grouped by category in the picker." />
        <datalist id={listId}>{categories.map(c => <option key={c} value={c} />)}</datalist>
        {urls.length > 0 && (
          <div className="adm-avatar-grid">
            {urls.slice(0, 24).map(u => <span key={u} className="adm-avatar"><Avatar src={u} size={56} /></span>)}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function AvatarsPage() {
  const avatars = useApi<AdminAvatar[]>('/admin/avatars')
  const [editing, setEditing] = useState<AdminAvatar | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)

  if (!avatars.data) return <Loading error={avatars.error} onRetry={avatars.reload} />
  const groups = avatars.data.reduce<Record<string, AdminAvatar[]>>((g, a) => ({ ...g, [a.category]: [...(g[a.category] || []), a] }), {})
  const categories = Object.keys(groups)

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Avatars</h1>
        <div className="adm-actions">
          <button className="adm-btn" onClick={() => setEditing('new')}>Add one</button>
          <button className="adm-btn primary" onClick={() => setBulk(true)}><Plus size={16} /> Add avatars</button>
        </div>
      </div>
      <p className="adm-muted">Profiles pick from these. Click an avatar to rename it, change its category or delete it.</p>
      {categories.length === 0 && <p className="adm-empty">No avatars yet. Use Add avatars to paste a list of image links. Until then, profiles use plain colours.</p>}
      {categories.map(cat => (
        <section key={cat} className="adm-panel">
          <h2>{cat} · {groups[cat].length}</h2>
          <div className="adm-avatar-grid">
            {groups[cat].map(a => (
              <button key={a.id} className="adm-avatar" onClick={() => setEditing(a)}>
                <Avatar src={a.url} size={72} />
                <span>{a.label || a.id}</span>
                <small>{a.used ? `${a.used} profile${a.used === 1 ? '' : 's'}` : 'Unused'}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      {editing && <AvatarModal avatar={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={avatars.reload} />}
      {bulk && <BulkAddModal categories={categories} onClose={() => setBulk(false)} onSaved={avatars.reload} />}
    </div>
  )
}
