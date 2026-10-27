'use client'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useBrowseMaybe } from '@/context/BrowseContext'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import { useCatalog } from '@/context/CatalogContext'
import type { Title } from '@/lib/catalog'
import type { AppNotification, ImageCrop, ImageKind } from '@/lib/types'
import { Bell, ChevronDown, Clock, Close, HelpCircle, Pencil, Search, Shield, User } from './icons'

// Inline style that also sets CSS custom properties (--name).
export const cssVars = (v: Record<string, string | number | undefined>) => v as CSSProperties

export function Logo({ size = 32 }: { size?: number }) {
  return <span className="logo" style={{ fontSize: size }}>STREAMFLIX</span>
}

// A show's image with its crop from Admin → Shows: filling the frame, zoomed about the crop point, or the
// whole image over a blurred copy of itself. Only cards and the info modal apply the crop.
export function PosterImg({ src, crop }: { src: string; crop?: ImageCrop | null }) {
  const whole = crop?.fit === 'contain'
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {whole && <img className="poster-img-fill" src={src} alt="" aria-hidden="true" loading="lazy" draggable="false" referrerPolicy="no-referrer" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={`poster-img ${whole ? 'whole' : ''}`} src={src} alt="" loading="lazy" draggable="false" referrerPolicy="no-referrer"
      style={crop && !whole ? cssVars({ '--x': `${crop.x}%`, '--y': `${crop.y}%`, '--zoom': crop.zoom }) : undefined} />
  </>
}

// Uses the show's image link when present, otherwise generated placeholder art.
export function PosterArt({ t, wide = true, bare, backdrop, children }: { t: Title; wide?: boolean; bare?: boolean; backdrop?: boolean; children?: ReactNode }) {
  const { channelById } = useCatalog()
  // Tall cards use the show's optional tall "poster" image, the info modal its optional background
  // image, each with its own crop; without one they use the main image (the modal shows it uncropped).
  const kind: ImageKind = backdrop ? 'backdrop' : wide ? 'image' : 'poster'
  const src = t[kind] || t.image
  const crop = t[kind] ? t.crops[kind] : backdrop ? null : t.crops.image
  const h = t.hue
  return (
    <div className={`poster ${wide ? 'wide' : 'tall'} ${src ? 'has-img' : ''}`}
      style={src ? undefined : { background: `radial-gradient(circle at 28% 22%, hsl(${(h + 40) % 360} 85% 58%), transparent 55%), radial-gradient(circle at 80% 90%, hsl(${(h + 300) % 360} 70% 35%), transparent 50%), linear-gradient(135deg, hsl(${h} 70% 28%), hsl(${(h + 200) % 360} 60% 10%))` }}>
      {src && <PosterImg src={src} crop={crop} />}
      {!bare && <>
        {t.channel && <span className="poster-badge"><span className="logo">S</span></span>}
        {!src && <span className={`poster-title ${wide ? '' : 'tall'}`}>{t.name}</span>}
        {t.isNew && <span className="poster-ribbon">New Episodes</span>}
        {t.channel && !wide && <span className="poster-chan">{channelById[t.channel]?.name}</span>}
      </>}
      {children}
    </div>
  )
}

// Profile picture: the chosen avatar image, or a smiley on the profile colour.
export function Avatar({ color = '#e50914', src, size = 32 }: { color?: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  }
  return (
    <span className="avatar" style={{ background: color, width: size, height: size }}>
      <svg viewBox="0 0 32 32" width="72%" height="72%"><rect x="8" y="9" width="4" height="5" rx="1" fill="#fff" /><rect x="20" y="9" width="4" height="5" rx="1" fill="#fff" /><path d="M8 20q8 6 16 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>
    </span>
  )
}

// Hover menu with Netflix-like open/close delay.
function HoverMenu({ trigger, children, className = '' }: { trigger: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  const enter = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(true), 100) }
  const leave = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(false), 300) }
  return (
    <div className={`hover-menu ${className} ${open ? 'open' : ''}`} onMouseEnter={enter} onMouseLeave={leave}>
      {trigger}
      <div className="menu-panel"><span className="menu-arrow" />{children}</div>
    </div>
  )
}

const LINKS: [string, string][] = [['/browse', 'Home'], ['/browse/tv', 'TV Shows'], ['/browse/movie', 'Movies'], ['/channels', 'Channels'], ['/browse/new', 'New & Popular'], ['/my-list', 'My List']]

function NavLinks() {
  const path = usePathname()
  const { titles } = useCatalog()
  // TV Shows / Movies drop out when there's nothing of that type to show.
  const has = (type: string) => titles.some(t => t.type === type)
  return LINKS.filter(([to]) => !to.startsWith('/browse/') || to === '/browse/new' || has(to.slice(8))).map(([to, l]) => <Link key={to} href={to} className={path === to ? 'active' : ''}>{l}</Link>)
}

export function Navbar() {
  const { profile, user, signOut, setActiveProfile } = useApp()
  const [solid, setSolid] = useState(false)
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [searchOpen, setSearchOpen] = useState(!!params.get('q'))
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const prevPath = useRef('/browse')

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 0)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => { if (pathname !== '/search') prevPath.current = pathname }, [pathname])
  // Follow the URL when a search suggestion is picked.
  useEffect(() => { const v = params.get('q'); if (v) { setQ(v); setSearchOpen(true) } }, [params])

  const onSearch = (v: string) => {
    setQ(v)
    const to = v ? `/search?q=${encodeURIComponent(v)}` : prevPath.current
    if (pathname === '/search') router.replace(to); else router.push(to)
  }
  const openSearch = () => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
  const current = LINKS.find(([to]) => to === pathname)?.[1] || 'Browse'

  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <Link href="/browse" className="nav-logo"><Logo size={30} /></Link>
      <HoverMenu className="nav-browse" trigger={<span className="browse-trigger">{current} <ChevronDown size={14} /></span>}>
        <NavLinks />
      </HoverMenu>
      <nav className="nav-links"><NavLinks /></nav>
      <div className="nav-right">
        <div className={`search ${searchOpen ? 'open' : ''}`}>
          <button aria-label="Search" onClick={openSearch}><Search size={22} /></button>
          <input ref={inputRef} value={q} placeholder="Titles, people, channels"
            onChange={e => onSearch(e.target.value)} onBlur={() => !q && setSearchOpen(false)} />
          {q && <button className="search-clear" onMouseDown={e => { e.preventDefault(); onSearch('') }}><Close size={16} /></button>}
        </div>
        <NotificationBell />
        <HoverMenu className="account" trigger={<span className="account-trigger"><Avatar color={profile?.color} src={profile?.avatarUrl} /><ChevronDown size={14} className="caret" /></span>}>
          {user?.profiles.filter(p => p.id !== profile?.id).map(p => (
            <button key={p.id} onClick={() => setActiveProfile(p.id)}><Avatar color={p.color} src={p.avatarUrl} size={32} /> {p.name}</button>
          ))}
          <Link href="/profiles?manage=1"><Pencil size={22} /> Manage Profiles</Link>
          <Link href="/account"><User size={22} /> Account</Link>
          <Link href="/history"><Clock size={22} /> Viewing history</Link>
          {user?.role === 'admin' && <Link href="/admin"><Shield size={22} /> Admin panel</Link>}
          <a href="#"><HelpCircle size={22} /> Help Centre</a>
          <hr />
          <button className="signout" onClick={async () => { await signOut(); router.replace('/') }}>Sign out of StreamFlix</button>
        </HoverMenu>
      </div>
    </header>
  )
}

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const [n, unit] = s < 3600 ? [Math.floor(s / 60), 'minute'] : s < 86400 ? [Math.floor(s / 3600), 'hour'] : s < 7 * 86400 ? [Math.floor(s / 86400), 'day'] : [Math.floor(s / (7 * 86400)), 'week']
  return n < 1 ? 'just now' : `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

// Notifications for the active profile: new shows and channels it can see, new episodes of
// shows it follows (My List or played), and admin announcements. Opening the menu marks them read.
function NotificationBell() {
  const { profile, markNotificationsSeen } = useApp()
  const cat = useCatalog()
  const browse = useBrowseMaybe()
  const router = useRouter()
  const [items, setItems] = useState<AppNotification[]>([])
  const [readBefore, setReadBefore] = useState<string | null>(null) // still highlighted while the menu is open
  useEffect(() => { api<AppNotification[]>('/notifications').then(setItems, () => {}) }, [profile?.id])
  if (!profile) return null

  const visible = new Set(cat.titles.map(t => t.id))
  const shown = items.filter(n =>
    (!n.titleId || visible.has(n.titleId)) && (!n.channelId || cat.channelById[n.channelId]) &&
    (n.kind !== 'episodes' || profile.list.includes(n.titleId!) || profile.recent.includes(n.titleId!))).slice(0, 12)
  const unread = shown.filter(n => n.createdAt > profile.notifSeenAt).length
  const isNew = (n: AppNotification) => n.createdAt > (readBefore ?? profile.notifSeenAt)
  const opened = () => { if (unread) { setReadBefore(profile.notifSeenAt); markNotificationsSeen() } }
  const go = (n: AppNotification) => {
    const t = n.titleId ? cat.byId[n.titleId] : null
    if (t && browse) browse.openInfo(t)
    else if (n.channelId) router.push(`/channel/${n.channelId}`)
    else if (t) router.push('/browse')
  }
  const art = (n: AppNotification) => {
    const t = n.titleId ? cat.byId[n.titleId] : null
    const c = n.channelId ? cat.channelById[n.channelId] : null
    if (t?.image || t?.poster) return <span className="notif-art" style={{ backgroundImage: `url("${t.image || t.poster}")` }} />
    if (c) return <span className="notif-art" style={{ background: c.bg, backgroundImage: c.image ? `url("${c.image}")` : undefined }} />
    return <span className="notif-art" style={{ background: `linear-gradient(135deg, hsl(${t?.hue ?? 355} 80% 45%), #141414)` }} />
  }

  return (
    <HoverMenu className="bell" trigger={
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onMouseEnter={opened} onFocus={opened}>
        <Bell size={22} />{unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>}>
      {shown.length ? shown.map(n => (
        <button key={n.id} type="button" className={`notif ${isNew(n) ? 'unread' : ''}`} onClick={() => go(n)}>
          {art(n)}
          <div><b>{n.heading}</b>{n.body && <p>{n.body}</p>}<small>{timeAgo(n.createdAt)}</small></div>
        </button>
      )) : <p className="notif-empty">No notifications yet.</p>}
    </HoverMenu>
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
