import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { channelById } from '../data/channels'
import { Bell, ChevronDown, Close, HelpCircle, Pencil, Search, User } from './icons'

export function Logo({ size = 32 }) {
  return <span className="logo" style={{ fontSize: size }}>STREAMFLIX</span>
}

// Placeholder poster art generated from the title's hue.
export function PosterArt({ t, wide = true, bare, children }) {
  const h = t.hue
  return (
    <div className={`poster ${wide ? 'wide' : 'tall'}`}
      style={{ background: `radial-gradient(circle at 28% 22%, hsl(${(h + 40) % 360} 85% 58%), transparent 55%), radial-gradient(circle at 80% 90%, hsl(${(h + 300) % 360} 70% 35%), transparent 50%), linear-gradient(135deg, hsl(${h} 70% 28%), hsl(${(h + 200) % 360} 60% 10%))` }}>
      {!bare && <>
        {t.channel && <span className="poster-badge"><span className="logo">S</span>{t.type === 'tv' ? 'SERIES' : 'FILM'}</span>}
        <span className={`poster-title ${wide ? '' : 'tall'}`}>{t.name}</span>
        {t.isNew && <span className="poster-ribbon">New Episodes</span>}
        {t.channel && !wide && <span className="poster-chan">{channelById[t.channel]?.name}</span>}
      </>}
      {children}
    </div>
  )
}

export function Avatar({ color = '#e50914', size = 32 }) {
  return (
    <span className="avatar" style={{ background: color, width: size, height: size }}>
      <svg viewBox="0 0 32 32" width="72%" height="72%"><rect x="8" y="9" width="4" height="5" rx="1" fill="#fff" /><rect x="20" y="9" width="4" height="5" rx="1" fill="#fff" /><path d="M8 20q8 6 16 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>
    </span>
  )
}

// Hover menu with Netflix-like open/close delay.
function HoverMenu({ trigger, children, className = '' }) {
  const [open, setOpen] = useState(false)
  const t = useRef()
  const enter = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(true), 100) }
  const leave = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(false), 300) }
  return (
    <div className={`hover-menu ${className} ${open ? 'open' : ''}`} onMouseEnter={enter} onMouseLeave={leave}>
      {trigger}
      <div className="menu-panel"><span className="menu-arrow" />{children}</div>
    </div>
  )
}

const LINKS = [['/browse', 'Home'], ['/browse/tv', 'TV Shows'], ['/browse/movie', 'Movies'], ['/channels', 'Channels'], ['/browse/new', 'New & Popular'], ['/my-list', 'My List']]

export function Navbar() {
  const { profile, user, signOut, setActiveProfile } = useApp()
  const [solid, setSolid] = useState(false)
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [searchOpen, setSearchOpen] = useState(!!params.get('q'))
  const nav = useNavigate()
  const loc = useLocation()
  const inputRef = useRef()
  const prevPath = useRef('/browse')

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 0)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => { if (loc.pathname !== '/search') prevPath.current = loc.pathname }, [loc.pathname])

  const onSearch = v => { setQ(v); nav(v ? `/search?q=${encodeURIComponent(v)}` : prevPath.current, { replace: loc.pathname === '/search' }) }
  const openSearch = () => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
  const current = LINKS.find(([to]) => to === loc.pathname)?.[1] || 'Browse'

  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <Link to="/browse" className="nav-logo"><Logo size={30} /></Link>
      <HoverMenu className="nav-browse" trigger={<span className="browse-trigger">{current} <ChevronDown size={14} /></span>}>
        {LINKS.map(([to, l]) => <NavLink key={to} to={to} end>{l}</NavLink>)}
      </HoverMenu>
      <nav className="nav-links">
        {LINKS.map(([to, l]) => <NavLink key={to} to={to} end>{l}</NavLink>)}
      </nav>
      <div className="nav-right">
        <div className={`search ${searchOpen ? 'open' : ''}`}>
          <button aria-label="Search" onClick={openSearch}><Search size={22} /></button>
          <input ref={inputRef} value={q} placeholder="Titles, people, channels"
            onChange={e => onSearch(e.target.value)} onBlur={() => !q && setSearchOpen(false)} />
          {q && <button className="search-clear" onMouseDown={e => { e.preventDefault(); onSearch('') }}><Close size={16} /></button>}
        </div>
        <Link to="/channels" className="kids">Kids</Link>
        <HoverMenu className="bell" trigger={<button aria-label="Notifications"><Bell size={22} /><span className="bell-dot">2</span></button>}>
          <div className="notif"><span className="notif-art" style={{ background: 'linear-gradient(135deg,#ff3d00,#ffd600)' }} /><div><b>New on Jetix</b><p>Thunder Rangers: Season 2</p><small>2 days ago</small></div></div>
          <div className="notif"><span className="notif-art" style={{ background: 'linear-gradient(135deg,#ff2e93,#29e3ff)' }} /><div><b>Live now on Pogo</b><p>Magic Pencil marathon</p><small>1 week ago</small></div></div>
        </HoverMenu>
        <HoverMenu className="account" trigger={<span className="account-trigger"><Avatar color={profile?.color} /><ChevronDown size={14} className="caret" /></span>}>
          {user?.profiles.filter(p => p.id !== profile?.id).map(p => (
            <button key={p.id} onClick={() => setActiveProfile(p.id)}><Avatar color={p.color} size={32} /> {p.name}</button>
          ))}
          <Link to="/profiles?manage=1"><Pencil size={22} /> Manage Profiles</Link>
          <a href="#"><User size={22} /> Account</a>
          <a href="#"><HelpCircle size={22} /> Help Centre</a>
          <hr />
          <button className="signout" onClick={() => { signOut(); nav('/') }}>Sign out of StreamFlix</button>
        </HoverMenu>
      </div>
    </header>
  )
}

export function Footer() {
  const cols = ['Audio Description', 'Help Centre', 'Gift Cards', 'Media Centre', 'Investor Relations', 'Jobs', 'Terms of Use', 'Privacy', 'Legal Notices', 'Cookie Preferences', 'Corporate Information', 'Contact Us']
  return (
    <footer className="footer">
      <div className="footer-social">
        {['M4 4h16v16H4z', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M4 6h16v12H4z', 'M5 5l14 14M19 5 5 19'].map((d, i) => (
          <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d} /></svg>
        ))}
      </div>
      <div className="footer-grid">{cols.map(c => <a key={c} href="#">{c}</a>)}</div>
      <button className="service-code">Service Code</button>
      <p className="copy">© 2026 StreamFlix demo. Not affiliated with any streaming service.</p>
    </footer>
  )
}
