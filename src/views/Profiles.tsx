'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { Avatar as AvatarRow, Profile } from '@/lib/types'
import { AVATAR_COLORS, useApp, useUser } from '@/context/AppContext'
import { Avatar, Logo } from '@/components/ui'
import { Pencil } from '@/components/icons'

interface Draft { id?: number; name: string; color: string; avatarId: string | null; avatarUrl: string | null; isKids: boolean }

// Avatars from the server, grouped by category; a colour swatch row is always available too.
function AvatarPicker({ value, onChange }: { value: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const [avatars, setAvatars] = useState<AvatarRow[] | null>(null)
  useEffect(() => { api<AvatarRow[]>('/avatars').then(setAvatars, () => setAvatars([])) }, [])
  const groups = (avatars || []).reduce<Record<string, AvatarRow[]>>((g, a) => ({ ...g, [a.category]: [...(g[a.category] || []), a] }), {})
  return (
    <div className="avatar-picker">
      {avatars === null && <p className="muted">Loading avatars…</p>}
      {Object.entries(groups).map(([cat, list]) => (
        <section key={cat}>
          <h3>{cat}</h3>
          <div className="avatar-grid">
            {list.map(a => (
              <button key={a.id} type="button" title={a.label} aria-label={a.label || a.id} aria-pressed={value.avatarId === a.id}
                className={value.avatarId === a.id ? 'sel' : ''} onClick={() => onChange({ avatarId: a.id, avatarUrl: a.url })}>
                <Avatar src={a.url} color={value.color} size={72} />
              </button>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>{avatars?.length ? 'Or a plain colour' : 'Colour'}</h3>
        <div className="colors">
          {AVATAR_COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} style={{ background: c }} className={!value.avatarId && c === value.color ? 'sel' : ''} onClick={() => onChange({ color: c, avatarId: null, avatarUrl: null })} />)}
        </div>
      </section>
    </div>
  )
}

const toDraft = (p: Profile): Draft => ({ id: p.id, name: p.name, color: p.color, avatarId: p.avatarId, avatarUrl: p.avatarUrl, isKids: p.isKids })

export function ProfilesPage() {
  const user = useUser()
  const { setActiveProfile, addProfile, updateProfile, removeProfile } = useApp()
  const params = useSearchParams()
  const [manage, setManage] = useState(!!params.get('manage'))
  const [editing, setEditing] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const router = useRouter()

  const choose = (p: Profile) => {
    if (manage) return setEditing(toDraft(p))
    setActiveProfile(p.id)
    router.push('/browse')
  }
  const close = () => { setEditing(null); setErr('') }

  if (editing) {
    const isNew = !editing.id
    const run = async (fn: () => Promise<void>) => {
      setBusy(true); setErr('')
      try { await fn(); close() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
    }
    const fields = { name: editing.name.trim(), color: editing.color, avatarId: editing.avatarId || null, isKids: !!editing.isKids }
    const done = () => {
      if (!fields.name) return setErr('Enter a profile name.')
      run(() => (isNew ? addProfile(fields) : updateProfile(editing.id!, fields)))
    }
    return (
      <div className="profiles">
        <header className="profiles-nav"><Logo size={30} /></header>
        <div className="edit-profile gate-in">
          <h1>{isNew ? 'Add Profile' : 'Edit Profile'}</h1>
          {err && <div className="auth-err">{err}</div>}
          <div className="edit-row">
            <Avatar color={editing.color} src={editing.avatarUrl} size={120} />
            <div className="edit-fields">
              <input autoFocus value={editing.name} placeholder="Name" maxLength={30} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              <label className="remember"><input type="checkbox" checked={!!editing.isKids} onChange={e => setEditing({ ...editing, isKids: e.target.checked })} /> Kids profile: only shows from kids channels</label>
              <AvatarPicker value={editing} onChange={v => setEditing({ ...editing, ...v })} />
            </div>
          </div>
          <div className="edit-btns">
            <button className="btn white" disabled={busy} onClick={done}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn outline" disabled={busy} onClick={close}>Cancel</button>
            {!isNew && user.profiles.length > 1 && <button className="btn outline" disabled={busy} onClick={() => run(() => removeProfile(editing.id!))}>Delete Profile</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profiles">
      <header className="profiles-nav"><Logo size={30} /></header>
      <div className="profiles-center gate-in">
        <h1>{manage ? 'Manage Profiles:' : "Who's watching?"}</h1>
        <div className="profile-list">
          {user.profiles.map(p => (
            <button key={p.id} className="profile" onClick={() => choose(p)}>
              <div className="profile-pic"><Avatar color={p.color} src={p.avatarUrl} size={150} />{manage && <span className="pencil"><Pencil size={44} /></span>}</div>
              <span>{p.name}{p.isKids && <small className="kids-tag">Kids</small>}</span>
            </button>
          ))}
          {user.profiles.length < 5 && (
            <button className="profile" onClick={() => setEditing({ name: '', color: AVATAR_COLORS[user.profiles.length % AVATAR_COLORS.length], avatarId: null, avatarUrl: null, isKids: false })}>
              <div className="profile-pic add">+</div><span>Add Profile</span>
            </button>
          )}
        </div>
        <div className="profiles-actions">
          <button className={`btn ${manage ? 'white' : 'outline'}`} onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Manage Profiles'}</button>
          {user.role === 'admin' && <button className="btn outline" onClick={() => router.push('/admin')}>Admin panel</button>}
        </div>
      </div>
    </div>
  )
}
