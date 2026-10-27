'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import { useCatalog } from '@/context/CatalogContext'
import { becauseYouWatched, blockAt, daySchedule, channelTitles, clockLabel, continueWatching, nowPlaying, randomBumper, rowsFor, search, searchSuggestions, timeLabel, upNext, type Channel, type Title } from '@/lib/catalog'
import { api } from '@/lib/api'
import type { Bumper, HistoryEntry } from '@/lib/types'
import { YouTubeClip } from './Player'
import { cssVars, Footer, Navbar, PosterArt, timeAgo } from '@/components/ui'
import { Billboard, ChannelTile, OnNowRow, posLabel, Row, TitleCard, useBrowse } from '@/components/Browse'
import { FloatingLogo } from '@/components/FloatingLogo'
import { ChevronDown, ChevronLeft, ChevronRight, Close, Info, Mute, Play, Search as SearchIcon, Volume } from '@/components/icons'

const HEADINGS: Record<string, string> = { tv: 'TV Shows', movie: 'Films', new: 'New & Popular' }

export function BrowsePage({ type }: { type?: string }) {
  const { profile } = useApp()
  const cat = useCatalog()
  const rows = useMemo(() => (profile ? rowsFor(cat, profile, type) : []), [cat, profile, type])
  if (!profile) return null
  const top = rows.find(r => r.top10)?.items || rows.find(r => r.items.length)?.items || []
  if (!top.length) return <Grid heading={type ? HEADINGS[type] : ''} items={[]} empty="Nothing here yet. Add shows in the admin panel to fill this section." />
  // The Top 10's first five take turns in the billboard, starting from a different one each day.
  const featured = top.slice(0, 5).map((t, k) => ({ t, rank: rows.some(r => r.top10) ? k + 1 : undefined }))
  const firstSlide = new Date().getDate() % featured.length

  return (
    <div className="page">
      <Navbar />
      {type && <div className="sub-header"><h1>{HEADINGS[type]}</h1></div>}
      <Billboard key={type || 'home'} items={featured} start={firstSlide} />
      <div className="rows">
        {rows.map(r => r.onNow
          ? <OnNowRow key={r.title} />
          : <Row key={r.title} title={r.resume ? `${r.title} for ${profile.name}` : r.title} items={r.items} top10={r.top10} resume={r.resume} link={r.link} />)}
      </div>
      <Footer />
    </div>
  )
}

function Grid({ heading, items, empty, suggestions, extra }: { heading?: string; items: Title[]; empty: string; suggestions?: boolean; extra?: ReactNode }) {
  return (
    <div className="page">
      <Navbar />
      <div className="grid-page">
        {heading && <h1>{heading}</h1>}
        {extra}
        {items.length ? <div className="grid">{items.map(t => <TitleCard key={t.id} t={t} />)}</div> : (
          <div className="empty">
            <p>{empty}</p>
            {suggestions && <ul><li>Try different keywords</li><li>Looking for a channel? Try &quot;Jetix&quot; or &quot;Pogo&quot;</li><li>Try a genre, like comedy, action or anime</li></ul>}
          </div>
        )}
      </div>
    </div>
  )
}

export function MyListPage() {
  const { profile } = useApp()
  const { byId } = useCatalog()
  return <Grid heading="My List" items={(profile?.list || []).map(id => byId[id]).filter(Boolean)} empty="You haven't added any titles to your list yet." />
}

export function SearchPage() {
  const q = useSearchParams().get('q') || ''
  const cat = useCatalog()
  const router = useRouter()
  const { openInfo } = useBrowse()
  const res = search(cat, q)
  const { related, didYouMean } = searchSuggestions(cat, q)
  const pick = (term: string) => router.replace(`/search?q=${encodeURIComponent(term)}`)
  const extra = (related.length > 0 || didYouMean.length > 0) && (
    <div className="search-suggest">
      {didYouMean.length > 0 && <p className="did-you-mean">Did you mean {didYouMean.map((t, i) => (
        <span key={t.id}>{i > 0 && (i === didYouMean.length - 1 ? ' or ' : ', ')}<button onClick={() => openInfo(t)}>{t.name}</button></span>
      ))}?</p>}
      {related.length > 0 && <div className="suggest-chips"><span>More to explore:</span>{related.map(r => <button key={r} onClick={() => pick(r)}>{r}</button>)}</div>}
    </div>
  )
  return <Grid heading={res.length ? `Explore titles related to: ${q}` : ''} items={res} suggestions={!didYouMean.length} extra={extra}
    empty={`Your search for "${q}" did not have any matches.`} />
}

// Every Play press for the profile, newest first, grouped by day. Removing a show also clears
// its progress, so it leaves Continue Watching and recommendations.
export function HistoryPage() {
  const { profile, forgetTitle } = useApp()
  const cat = useCatalog()
  const { openInfo } = useBrowse()
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (profile) api<HistoryEntry[]>(`/profiles/${profile.id}/history`).then(setRows, e => setError(e instanceof Error ? e.message : String(e)))
  }, [profile?.id])
  const remove = async (titleId: string) => {
    try { await forgetTitle(titleId); setRows(r => r && r.filter(x => x.titleId !== titleId)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const known = (rows || []).filter(r => cat.byId[r.titleId])
  const days = [...new Set(known.map(r => day(r.playedAt)))]

  return (
    <div className="page">
      <Navbar />
      <div className="grid-page history-page">
        <h1>Viewing history</h1>
        {profile && <p className="muted lead">What {profile.name} has played. Removing a show also clears its progress and recommendations.</p>}
        {error && <p className="history-error">{error}</p>}
        {!rows ? (!error && <p className="muted">Loading…</p>) : !known.length ? <div className="empty"><p>Nothing watched yet.</p></div> : days.map(d => (
          <section key={d} className="history-day">
            <h2>{d}</h2>
            <ul>
              {known.filter(r => day(r.playedAt) === d).map((r, i) => {
                const t = cat.byId[r.titleId]
                return (
                  <li key={`${r.titleId}-${r.playedAt}-${i}`} className="history-row">
                    <button className="history-art" onClick={() => openInfo(t)}><PosterArt t={t} /></button>
                    <button className="history-main" onClick={() => openInfo(t)}>
                      <b>{t.name}</b>
                      <small>{[r.season && r.episode ? posLabel({ season: r.season, episode: r.episode }) : null, new Date(r.playedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), timeAgo(r.playedAt)].filter(Boolean).join(' · ')}</small>
                    </button>
                    <button className="history-remove" aria-label={`Remove ${t.name} from history`} title="Remove from history" onClick={() => remove(r.titleId)}><Close size={18} /></button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <Footer />
    </div>
  )
}

export function ChannelsPage() {
  const cat = useCatalog()
  return (
    <div className="page">
      <Navbar />
      <div className="grid-page">
        <h1>Channels</h1>
        <p className="muted lead">Kids TV the way you remember it. Shows play back-to-back, live.</p>
        <div className="channel-grid">
          {cat.channels.map(c => {
            const np = nowPlaying(cat, c.id)
            return (
              <div key={c.id} className="channel-cell">
                <ChannelTile c={c} big />
                <div className="now"><span className="live-pill"><i />NOW</span><b>{np.current.name}</b></div>
                <div className="next muted">Next: {np.next.name}</div>
              </div>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export function ChannelPage({ id }: { id: string }) {
  const cat = useCatalog()
  const c = cat.channelById[id]
  const router = useRouter()
  const { openInfo } = useBrowse()
  const { profile } = useApp()
  // Like Netflix's billboard: once the bumper has been playing a moment, the logo shrinks and the
  // schedule details fade so the video takes over.
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    setCompact(false)
    if (!c?.bumpers?.length) return
    const t = setTimeout(() => setCompact(true), 4000)
    return () => clearTimeout(t)
  }, [id])
  // Re-render every half minute so "on now" and "up next" follow the clock.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const h = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(h) }, [])
  if (!c) return <Grid heading="Channel not found" items={[]} empty="" />
  const list = channelTitles(cat, id)
  const np = upNext(cat, id, 3, now)
  const block = blockAt(c, now.getHours() * 60 + now.getMinutes())
  const [showSchedule, setShowSchedule] = useState(false)
  const shows = list.filter(t => t.type !== 'movie')
  const movies = list.filter(t => t.type === 'movie')
  // Ranked on the server (admin picks, then most watched); only shows this profile may browse.
  const top10 = c.top10.map(tid => list.find(t => t.id === tid)).filter((t): t is NonNullable<typeof t> => !!t)
  const continuing = profile ? continueWatching(cat, profile, id) : []
  const because = profile && becauseYouWatched(cat, profile, id)

  return (
    <div className="page channel-page" style={cssVars({ '--accent': c.accent, '--chan-bg': c.bg })}>
      <Navbar />
      <section className={`channel-hero ${compact ? 'compact' : ''}`}>
        <div className="channel-hero-bg" style={{ background: `radial-gradient(circle at 75% 35%, ${c.accent}55, transparent 55%), radial-gradient(circle at 20% 90%, ${c.accent2}33, transparent 50%), ${c.bg}` }}>
          <HeroBumper c={c} />
        </div>
        <div className="channel-hero-copy">
          {c.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <h1 className="channel-hero-logo"><img src={c.image} alt={c.name} /></h1>
            : <h1 className="channel-name huge" style={{ color: c.accent, textShadow: `5px 5px 0 ${c.accent2}` }}>{c.name}</h1>}
          <div className="now-box">
            <span className="live-pill"><i />LIVE NOW</span>
            <h2>{np.current.name}</h2>
            <p className="now-meta">
              {np.endsAt && <>Until {timeLabel(np.endsAt)}</>}
              {block && <> · {clockLabel(block.start)} – {clockLabel(block.end)} block</>}
            </p>
            {np.next.length > 0 && (
              <ol className="up-next">
                {np.next.map(n => (
                  <li key={n.start.getTime()}>
                    <time>{timeLabel(n.start)}</time>
                    <button type="button" onClick={() => openInfo(n.title)}>{n.title.name}</button>
                  </li>
                ))}
              </ol>
            )}
            <button type="button" className="full-schedule-btn" onClick={() => setShowSchedule(true)}>Full schedule <ChevronRight size={14} /></button>
          </div>
          <div className="btns">
            <button className="btn white" onClick={() => router.push(`/live/${id}`)}><Play size={26} /> Watch Live</button>
            <button className="btn grey" onClick={() => openInfo(np.current)}><Info size={26} /> Show Info</button>
          </div>
        </div>
      </section>
      <div className="rows">
        {profile && continuing.length > 0 && <Row title={`Continue Watching for ${profile.name}`} items={continuing} resume />}
        {top10.length > 0 && <Row title={`Top 10 on ${c.name}`} items={top10} top10 />}
        {because && <Row title={`Because You Watched ${because.source.name}`} items={because.items} />}
        <Row title={`All on ${c.name}`} items={shows} viewAll={`/channel/${id}/all`} />
        {movies.length > 0 && <Row title="Movies" items={movies} />}
      </div>
      {showSchedule && <ScheduleModal c={c} now={now} onClose={() => setShowSchedule(false)} />}
      <FloatingLogo c={c} />
      <Footer />
    </div>
  )
}

/* ---------- Channel "View All": full grid with filters ---------- */

type Option = [string, string]
const SORTS: Option[] = [['suggested', 'Suggestions For You'], ['new', 'Year Released (Newest)'], ['old', 'Year Released (Oldest)'], ['az', 'A–Z'], ['za', 'Z–A']]
const TYPES: Option[] = [['all', 'All'], ['tv', 'TV Shows'], ['movie', 'Movies']]

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const current = options.find(([v]) => v === value)?.[1] ?? label
  return (
    <div className={`dropdown ${open ? 'open' : ''}`} ref={ref}>
      <button className="dropdown-btn" onClick={() => setOpen(!open)}>
        {label && <span className="dropdown-label">{label}</span>}{current}<ChevronDown size={14} />
      </button>
      {open && (
        <ul className="dropdown-menu">
          {options.map(([v, l]) => (
            <li key={v}><button className={v === value ? 'on' : ''} onClick={() => { onChange(v); setOpen(false) }}>{l}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ChannelAllPage({ id }: { id: string }) {
  const cat = useCatalog()
  const c = cat.channelById[id]
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const sort = params.get('sort') || 'suggested'
  const type = params.get('type') || 'all'
  const decade = params.get('decade') || 'all'
  const view = params.get('view') || 'grid'
  const query = params.get('q') || ''
  const [q, setQ] = useState(query)
  const replaceParams = (n: URLSearchParams) => router.replace(n.size ? `${pathname}?${n}` : pathname, { scroll: false })
  const set = (k: string, v: string, def: string) => {
    const n = new URLSearchParams(params.toString())
    if (v === def) n.delete(k); else n.set(k, v)
    replaceParams(n)
  }
  useEffect(() => { const h = setTimeout(() => { if (q.trim() !== query) set('q', q.trim(), '') }, 200); return () => clearTimeout(h) }, [q])

  const list = useMemo(() => (c ? channelTitles(cat, id) : []), [cat, id])
  const decades = useMemo((): Option[] => {
    const ds = [...new Set(list.filter(t => t.year).map(t => Math.floor(t.year! / 10) * 10))].sort((a, b) => b - a)
    return [['all', 'All Decades'], ...ds.map((d): Option => [String(d), `${d}s`]), ...(list.some(t => !t.year) ? [['unknown', 'Year Unknown'] as Option] : [])]
  }, [list])

  const items = useMemo(() => {
    const needle = query.toLowerCase()
    let out = list.filter(t =>
      (type === 'all' || t.type === type) &&
      (decade === 'all' || (decade === 'unknown' ? !t.year : t.year && Math.floor(t.year / 10) * 10 === +decade)) &&
      (!needle || t.name.toLowerCase().includes(needle)))
    const yr = (t: Title) => t.year ?? (sort === 'old' ? 9999 : 0)
    if (sort === 'new') out = [...out].sort((a, b) => yr(b) - yr(a))
    if (sort === 'old') out = [...out].sort((a, b) => yr(a) - yr(b))
    if (sort === 'az') out = [...out].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'za') out = [...out].sort((a, b) => b.name.localeCompare(a.name))
    return out
  }, [list, type, decade, sort, query])

  if (!c) return <Grid heading="Channel not found" items={[]} empty="" />
  const filtered = type !== 'all' || decade !== 'all' || !!query

  return (
    <div className="page">
      <Navbar />
      <div className="all-page">
        <div className="all-head">
          <div className="all-title">
            <Link href={`/channel/${id}`} className="all-back" aria-label={`Back to ${c.name}`}><ChevronLeft size={28} /></Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.image ? <img className="all-logo" src={c.image} alt={c.name} /> : <h1>{c.name}</h1>}
            <span className="all-sub">All Shows</span>
          </div>
          <div className="all-filters">
            <Dropdown label="Type:" value={type} options={TYPES} onChange={v => set('type', v, 'all')} />
            <Dropdown label="Decade:" value={decade} options={decades} onChange={v => set('decade', v, 'all')} />
            <Dropdown label="Sort:" value={sort} options={SORTS} onChange={v => set('sort', v, 'suggested')} />
            <label className="all-search"><SearchIcon size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${c.name}`} /></label>
            <div className="view-toggle" role="group" aria-label="View">
              <button className={view === 'grid' ? 'on' : ''} onClick={() => set('view', 'grid', 'grid')} aria-label="Grid view"><GridIcon /></button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => set('view', 'list', 'grid')} aria-label="List view"><ListIcon /></button>
            </div>
          </div>
        </div>
        <p className="all-count">
          {items.length} {items.length === 1 ? 'title' : 'titles'}
          {filtered && <button className="link-btn" onClick={() => { setQ(''); replaceParams(new URLSearchParams(view === 'grid' ? {} : { view })) }}>Clear filters</button>}
        </p>
        {!items.length ? <div className="empty"><p>No titles match these filters.</p></div>
          : view === 'grid'
            ? <div className="grid">{items.map(t => <TitleCard key={t.id} t={t} />)}</div>
            : <ListView items={items} />}
      </div>
      <Footer />
    </div>
  )
}

function ListView({ items }: { items: Title[] }) {
  const { openTitle, playTitle } = useBrowse()
  return (
    <ul className="list-view">
      {items.map((t, i) => (
        <li key={t.id} onClick={() => openTitle(t)}>
          <span className="lv-n">{i + 1}</span>
          <div className="lv-art"><PosterArt t={t} bare /></div>
          <div className="lv-text">
            <b>{t.name}</b>
            <span className="muted">{[t.year, t.type === 'movie' ? 'Film' : 'Series', t.maturity].filter(Boolean).join(' · ')}</span>
          </div>
          <button className="circle white" aria-label={`Play ${t.name}`} onClick={e => { e.stopPropagation(); playTitle(t) }}><Play size={16} /></button>
        </li>
      ))}
    </ul>
  )
}

const GridIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
const ListIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3" rx="1" /><rect x="3" y="10.5" width="18" height="3" rx="1" /><rect x="3" y="17" width="18" height="3" rx="1" /></svg>

// Channel header background: bumpers behind a dark shade, a random one on every visit and another
// random one each time it ends (loops if the channel has only one). Plays with sound; the mute
// choice is remembered. Without bumpers the gradient background shows on its own.
const MUTE_KEY = 'sf_bumper_muted'
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } }

function HeroBumper({ c }: { c: Channel }) {
  const [bumper, setBumper] = useState<Bumper | null>(() => randomBumper(c))
  const [muted, setMutedState] = useState(readMuted)
  useEffect(() => { setBumper(randomBumper(c)) }, [c.id])
  if (!bumper) return null
  const loop = c.bumpers.length === 1
  const next = () => setBumper(prev => randomBumper(c, prev))
  const setMuted = (m: boolean) => { setMutedState(m); try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch {} }
  // Browser blocked sound on autoplay: show as muted for now, without changing the saved choice.
  const autoMuted = () => setMutedState(true)

  return (
    <>
      <div className="hero-bumper" aria-hidden="true">
        <YouTubeClip key={bumper.ytId} videoId={bumper.ytId} muted={muted} loop={loop} onEnded={next} onAutoMuted={autoMuted} />
        <div className="hero-bumper-shade" />
      </div>
      <button className="round-outline hero-mute" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute bumper' : 'Mute bumper'}>
        {muted ? <Mute size={20} /> : <Volume size={20} />}
      </button>
    </>
  )
}

// The whole day on the channel, opened from the live box. Scrolls to what's on now.
function ScheduleModal({ c, now, onClose }: { c: Channel; now: Date; onClose: () => void }) {
  const cat = useCatalog()
  const { openInfo } = useBrowse()
  const day = daySchedule(cat, c.id, now)
  const nowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'center' })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = '' }
  }, [])
  const minute = (d: Date) => d.getHours() * 60 + d.getMinutes()
  return createPortal(
    <div className="sched-bg" onClick={onClose}>
      <div className="sched-modal" role="dialog" aria-label={`Today on ${c.name}`} onClick={e => e.stopPropagation()} style={cssVars({ '--accent': c.accent })}>
        <header>
          <div>
            <h2>Today on {c.name}</h2>
            <small>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · times in your time zone</small>
          </div>
          <button className="sched-close" onClick={onClose} aria-label="Close"><Close size={22} /></button>
        </header>
        <ol className="sched-list">
          {day.map(e => {
            const on = e.start <= now && now < e.end
            const block = blockAt(c, minute(e.start))
            return (
              <li key={e.start.getTime()} ref={on ? nowRef : undefined} className={on ? 'on' : e.end <= now ? 'past' : ''}>
                <time>{timeLabel(e.start)} – {timeLabel(e.end)}</time>
                <button type="button" onClick={() => { onClose(); openInfo(e.title) }}>{e.title.name}</button>
                {on ? <span className="live-pill"><i />ON NOW</span> : block && <small className="sched-block">{clockLabel(block.start)}–{clockLabel(block.end)} block</small>}
              </li>
            )
          })}
        </ol>
      </div>
    </div>,
    document.body,
  )
}
