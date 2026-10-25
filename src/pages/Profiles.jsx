import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AVATAR_COLORS, useApp } from '../context/AppContext'
import { Avatar, Logo } from '../components/ui'
import { Pencil } from '../components/icons'

export default function Profiles() {
  const { user, setActiveProfile, addProfile, removeProfile, renameProfile } = useApp()
  const [params] = useSearchParams()
  const [manage, setManage] = useState(!!params.get('manage'))
  const [editing, setEditing] = useState(null) // {id?, name, color}
  const nav = useNavigate()

  const choose = p => { if (manage) return setEditing({ ...p }); setActiveProfile(p.id); nav('/browse') }

  if (editing) {
    const isNew = !editing.id
    const done = () => {
      if (!editing.name.trim()) return
      isNew ? addProfile(editing.name.trim(), editing.color) : renameProfile(editing.id, editing.name.trim(), editing.color)
      setEditing(null)
    }
    return (
      <div className="profiles">
        <header className="profiles-nav"><Logo size={30} /></header>
        <div className="edit-profile gate-in">
          <h1>{isNew ? 'Add Profile' : 'Edit Profile'}</h1>
          <div className="edit-row">
            <Avatar color={editing.color} size={120} />
            <div>
              <input autoFocus value={editing.name} placeholder="Name" onChange={e => setEditing({ ...editing, name: e.target.value })} />
              <div className="colors">
                {AVATAR_COLORS.map(c => <button key={c} style={{ background: c }} className={c === editing.color ? 'sel' : ''} onClick={() => setEditing({ ...editing, color: c })} />)}
              </div>
            </div>
          </div>
          <div className="edit-btns">
            <button className="btn white" onClick={done}>Save</button>
            <button className="btn outline" onClick={() => setEditing(null)}>Cancel</button>
            {!isNew && user.profiles.length > 1 && <button className="btn outline" onClick={() => { removeProfile(editing.id); setEditing(null) }}>Delete Profile</button>}
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
              <div className="profile-pic"><Avatar color={p.color} size={150} />{manage && <span className="pencil"><Pencil size={44} /></span>}</div>
              <span>{p.name}</span>
            </button>
          ))}
          {user.profiles.length < 5 && (
            <button className="profile" onClick={() => setEditing({ name: '', color: AVATAR_COLORS[user.profiles.length % AVATAR_COLORS.length] })}>
              <div className="profile-pic add">+</div><span>Add Profile</span>
            </button>
          )}
        </div>
        <button className={`btn ${manage ? 'white' : 'outline'}`} onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Manage Profiles'}</button>
      </div>
    </div>
  )
}
