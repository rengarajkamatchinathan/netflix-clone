'use client'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import { useCatalog } from '@/context/CatalogContext'
import { hash, type Channel, type Title } from '@/lib/catalog'
import { cssVars, PosterArt } from './ui'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Close, Info, Play, Plus, Replay, ThumbUp, Volume } from './icons'

const MOODS = ['Exciting', 'Feel-good', 'Witty', 'Suspenseful', 'Heartfelt', 'Imaginative', 'Quirky', 'Goofy', 'Action-packed']
export const moodsFor = (t: Title) => [0, 1, 2].map(i => MOODS[(hash(t.id) + i * 4) % MOODS.length]).filter((m, i, a) => a.indexOf(m) === i)
const lengthOf = (t: Title) => (t.type === 'tv' ? (t.seasons ? `${t.seasons} Season${t.seasons > 1 ? 's' : ''}` : 'Series') : t.duration)

type Origin = 'left' | 'right' | 'center'
interface CardRect { left: number; top: number; width: number; height: number; wide: boolean }
type Rect = { left: number; top: number; width: number; height: number } | null

/* ---------- Shared browse state: hover preview + info modal ---------- */

interface BrowseValue {
  openInfo: (t: Title, rect?: Rect) => void
  openTitle: (t: Title, rect?: Rect) => void
  playTitle: (t: Title) => void
  setPreview: (p: { t: Title; origin: Origin; rect: CardRect } | null) => void
}
const BrowseCtx = createContext<BrowseValue | null>(null)
export function useBrowse(): BrowseValue {
  const v = useContext(BrowseCtx)
  if (!v) throw new Error('useBrowse must be used inside BrowseProvider')
  return v
}

export function BrowseProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<{ t: Title; rect: Rect } | null>(null)
  const [preview, setPreview] = useState<{ t: Title; origin: Origin; rect: CardRect } | null>(null)
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const router = useRouter()
  useEffect(() => { setPreview(null); setInfo(null) }, [pathname, search])

  const openInfo = (t: Title, rect: Rect = null) => { setPreview(null); setInfo({ t, rect }) }
  const openLink = (t: Title) => { setPreview(null); window.open(t.link!, '_blank', 'noopener,noreferrer') }
  // Clicking a title: open its link in a new tab if it has one, otherwise the details modal.
  const openTitle = (t: Title, rect: Rect = null) => (t.link ? openLink(t) : openInfo(t, rect))
  // Play: open its link in a new tab if it has one, otherwise the built-in player.
  const playTitle = (t: Title) => (t.link ? openLink(t) : router.push(`/watch/${t.id}`))
  return (
    <BrowseCtx.Provider value={{ openInfo, openTitle, playTitle, setPreview }}>
      {children}
      {preview && createPortal(<Preview key={`${preview.t.id}-${preview.rect.left}-${preview.rect.top}`} {...preview} onClose={() => setPreview(null)} />, document.body)}
      {info && createPortal(<DetailModal key={info.t.id + (info.rect ? 'r' : '')} t={info.t} rect={info.rect} onClose={() => setInfo(null)} />, document.body)}
    </BrowseCtx.Provider>
  )
}

function Meta({ t, year }: { t: Title; year?: boolean }) {
  return (
    <div className="meta">
      <span className="match">{t.match}% Match</span>
      {year && t.year && <span>{t.year}</span>}
      <span className="maturity">{t.maturity}</span>
      <span>{lengthOf(t)}</span>
      <span className="hd">HD</span>
    </div>
  )
}

function TipButton({ tip, className = 'circle', children, ...p }: { tip: string; className?: string; children: ReactNode; onClick?: (e: MouseEvent) => void }) {
  return <button className={className} data-tip={tip} aria-label={tip} {...p}>{children}</button>
}

function ListButton({ t, big }: { t: Title; big?: boolean }) {
  const { profile, toggleList } = useApp()
  const inList = profile?.list.includes(t.id)
  return (
    <TipButton tip={inList ? 'Remove from My List' : 'Add to My List'} className={`circle ${big ? 'big' : ''}`} onClick={e => { e.stopPropagation(); toggleList(t.id) }}>
      {inList ? <Check size={big ? 20 : 16} /> : <Plus size={big ? 20 : 16} />}
    </TipButton>
  )
}

function LikeButton({ big }: { big?: boolean }) {
  const [liked, setLiked] = useState(false)
  return (
    <TipButton tip={liked ? 'Rated' : 'I like this'} className={`circle ${big ? 'big' : ''} ${liked ? 'liked' : ''}`} onClick={e => { e.stopPropagation(); setLiked(!liked) }}>
      <ThumbUp size={big ? 18 : 14} fill={liked ? 'currentColor' : 'none'} />
    </TipButton>
  )
}

const Progress = ({ pct }: { pct?: number }) => (pct && pct > 0 ? <div className="progress"><div style={{ width: `${pct}%` }} /></div> : null)

/* ---------- Hover preview (pops out of the card, like the real thing) ---------- */

function Preview({ t, rect, origin, onClose }: { t: Title; rect: CardRect; origin: Origin; onClose: () => void }) {
  const { openInfo, playTitle } = useBrowse()
  const { profile } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const closeT = useRef<ReturnType<typeof setTimeout>>(undefined)

  const w = Math.max(rect.wide ? rect.width * 1.5 : rect.height * 1.5 * 0.9, 300)
  const artH = w * 9 / 16
  let left = origin === 'left' ? rect.left : origin === 'right' ? rect.left + rect.width - w : rect.left + rect.width / 2 - w / 2
  left = Math.min(Math.max(left, window.scrollX + 12), window.scrollX + document.documentElement.clientWidth - w - 12)
  const top = rect.top + rect.height / 2 - artH / 2 - 20
  const s = rect.width / w

  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(r) }, [])
  const leave = () => { setShown(false); closeT.current = setTimeout(onClose, 220) }
  const enter = () => { clearTimeout(closeT.current); setShown(true) }

  return (
    <div ref={ref} className={`preview ${shown ? 'shown' : ''}`} onMouseLeave={leave} onMouseEnter={enter}
      style={cssVars({ left, top, width: w, '--from': `translate(${rect.left - left}px, ${rect.top - top + (artH * s - rect.height) / -2}px) scale(${s})` })}>
      <div className="preview-art" onClick={() => playTitle(t)}>
        <PosterArt t={t}><Progress pct={profile?.progress[t.id]} /></PosterArt>
      </div>
      <div className="preview-info">
        <div className="preview-btns">
          <TipButton tip="Play" className="circle white" onClick={() => playTitle(t)}><Play size={16} /></TipButton>
          <ListButton t={t} />
          <LikeButton />
          <TipButton tip="Episodes & info" className="circle push" onClick={() => openInfo(t, ref.current!.getBoundingClientRect())}><ChevronDown size={18} /></TipButton>
        </div>
        <Meta t={t} />
        <ul className="moods">{moodsFor(t).map(m => <li key={m}>{m}</li>)}</ul>
      </div>
    </div>
  )
}

/* ---------- Cards and rows ---------- */

export function TitleCard({ t, tall, origin = 'center' }: { t: Title; tall?: boolean; origin?: Origin }) {
  const { setPreview, openTitle } = useBrowse()
  const { profile } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const enter = () => {
    if (window.matchMedia('(hover: none)').matches) return
    timer.current = setTimeout(() => {
      const r = ref.current!.getBoundingClientRect()
      setPreview({ t, origin, rect: { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height, wide: !tall } })
    }, 500)
  }
  return (
    <div ref={ref} className={`card ${tall ? 'tall' : ''}`} onMouseEnter={enter} onMouseLeave={() => clearTimeout(timer.current)}
      onClick={() => { clearTimeout(timer.current); openTitle(t, ref.current!.getBoundingClientRect()) }}>
      <PosterArt t={t} wide={!tall}><Progress pct={profile?.progress[t.id]} /></PosterArt>
    </div>
  )
}

function usePerRow() {
  const calc = () => { const w = window.innerWidth; return w > 1400 ? 6 : w > 1100 ? 5 : w > 800 ? 4 : w > 500 ? 3 : 2 }
  const [n, setN] = useState(calc)
  useEffect(() => { const on = () => setN(calc()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on) }, [])
  return n
}

function RankNumber({ n }: { n: number }) {
  return (
    <svg className="rank" viewBox="0 0 100 150" preserveAspectRatio="xMaxYMax meet" aria-label={`Rank ${n}`}>
      <text x="100" y="146" textAnchor="end" fontSize="168" fontWeight="900" letterSpacing={n === 10 ? -18 : 0}>{n}</text>
    </svg>
  )
}

export function Row({ title, items, top10, link, viewAll }: { title: string; items: Title[]; top10?: boolean; link?: string; viewAll?: string }) {
  // Top 10 uses tall posters only when every show has a tall "poster" image (or no image at all);
  // otherwise it shows rank + wide 16:9 cards so wide images aren't cropped. Wide items need more room.
  const tallTop10 = !!top10 && items.every(t => t.poster || !t.image)
  const basePer = usePerRow()
  const per = top10 && !tallTop10 ? Math.max(2, basePer - 1) : basePer
  const pages = Math.ceil(items.length / per)
  const [page, setPage] = useState(0)
  const [moved, setMoved] = useState(false)
  useEffect(() => { setPage(p => Math.min(p, Math.max(pages - 1, 0))) }, [pages])
  const go = (d: number) => { setMoved(true); setPage(p => (p + d + pages) % pages) }

  return (
    <section className={`row ${top10 ? 'is-top10' : ''}`}>
      <h2 className="row-header">
        {link ? <Link href={link} className="row-title">{title}<span className="explore">Explore All <ChevronRight size={14} /></span></Link> : <span className="row-title">{title}</span>}
        <span className="row-header-right">
          {pages > 1 && <ul className="pager">{Array.from({ length: pages }, (_, i) => <li key={i} className={i === page ? 'on' : ''} />)}</ul>}
          {viewAll && <Link href={viewAll} className="view-all">View All <ChevronRight size={16} /></Link>}
        </span>
      </h2>
      <div className="slider">
        {moved && pages > 1 && <button className="handle prev" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft size={36} /></button>}
        <div className="slider-inner" style={{ transform: `translate3d(-${page * 100}%,0,0)` }}>
          {items.map((t, i) => {
            const pos = i % per
            const origin: Origin = pos === 0 ? 'left' : pos === per - 1 ? 'right' : 'center'
            return (
              <div key={t.id} className="slider-item" style={{ flexBasis: `${100 / per}%` }}>
                {top10
                  ? <div className={`top10-item ${tallTop10 ? '' : 'wide'}`}><RankNumber n={i + 1} /><TitleCard t={t} tall={tallTop10} origin={origin} /></div>
                  : <TitleCard t={t} origin={origin} />}
              </div>
            )
          })}
        </div>
        {pages > 1 && <button className="handle next" onClick={() => go(1)} aria-label="Next"><ChevronRight size={36} /></button>}
      </div>
    </section>
  )
}

/* ---------- Billboard ---------- */

export function Billboard({ t, rank }: { t: Title; rank?: number }) {
  const { openInfo, playTitle } = useBrowse()
  const [compact, setCompact] = useState(false)
  const [run, setRun] = useState(0)
  useEffect(() => { setCompact(false); const h = setTimeout(() => setCompact(true), 5000); return () => clearTimeout(h) }, [t.id, run])

  return (
    <section className="billboard">
      <div className="billboard-art" key={run}><PosterArt t={t} bare /></div>
      <div className="billboard-vignette" />
      <div className={`billboard-info ${compact ? 'compact' : ''}`}>
        <div className="series-tag"><span className="logo">S</span>{t.type === 'tv' ? 'SERIES' : 'FILM'}</div>
        <h1 className="title-treatment">{t.name}</h1>
        <div className="billboard-collapse">
          {rank && <div className="top10-line"><span className="top10-badge"><small>TOP</small>10</span>#{rank} in {t.type === 'tv' ? 'TV Shows' : 'Films'} Today</div>}
          <p className="synopsis">{t.synopsis}</p>
        </div>
        <div className="btns">
          <button className="btn white" onClick={() => playTitle(t)}><Play size={26} /> Play</button>
          <button className="btn grey" onClick={() => openInfo(t)}><Info size={26} /> More Info</button>
        </div>
      </div>
      <div className="billboard-side">
        <button className="round-outline" aria-label="Replay" onClick={() => setRun(r => r + 1)}><Replay size={20} /></button>
        <span className="maturity-flag">{t.maturity}</span>
      </div>
    </section>
  )
}

/* ---------- Detail modal (expands from the card it was opened from) ---------- */

export function DetailModal({ t, rect, onClose }: { t: Title; rect: Rect; onClose: () => void }) {
  const { openTitle, playTitle } = useBrowse()
  const { titles, channelById } = useCatalog()
  const ref = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLDivElement>(null)
  const from = useRef<Keyframe[]>([])

  useLayoutEffect(() => {
    const el = ref.current!
    const m = el.getBoundingClientRect()
    from.current = rect
      ? [{ transform: `translate(${rect.left - m.left}px, ${rect.top - m.top}px) scale(${rect.width / m.width})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'translateY(40px) scale(.95)', opacity: 0 }, { transform: 'none', opacity: 1 }]
    el.style.transformOrigin = 'top left'
    el.animate(from.current, { duration: 380, easing: 'cubic-bezier(.21,.85,.29,1)' })
    bg.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const close = () => {
    ref.current!.animate([...from.current].reverse(), { duration: 260, easing: 'ease-in', fill: 'forwards' })
    bg.current!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = onClose
  }
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])

  const more = titles.filter(x => x.id !== t.id && (x.genre === t.genre || (t.channel && x.channel === t.channel))).slice(0, 9)
  const chan = t.channel && channelById[t.channel]

  return (
    <div className="modal-bg" ref={bg} onClick={close}>
      <div className="modal" ref={ref} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={close} aria-label="Close"><Close size={22} /></button>
        <div className="modal-hero">
          <PosterArt t={t} bare />
          <div className="modal-hero-fade" />
          <div className="modal-hero-info">
            <h1 className="title-treatment">{t.name}</h1>
            <div className="btns">
              <button className="btn white" onClick={() => playTitle(t)}><Play size={24} /> Play</button>
              <ListButton t={t} big />
              <LikeButton big />
            </div>
          </div>
          <button className="round-outline modal-mute" aria-label="Volume"><Volume size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-cols">
            <div>
              <Meta t={t} year />
              {t.isNew && <div className="top10-line"><span className="top10-badge"><small>TOP</small>10</span>#{(hash(t.id) % 9) + 1} in {t.type === 'tv' ? 'TV Shows' : 'Films'} Today</div>}
              <p className="modal-synopsis">{t.synopsis}</p>
            </div>
            <div className="modal-tags">
              {chan && <p><span>Channel{t.channels.length > 1 ? 's' : ''}: </span>{t.channels.map((id, i) => <span key={id} className="chan-link">{i > 0 && ', '}<Link href={`/channel/${id}`}>{channelById[id]?.name || id}</Link></span>)}</p>}
              <p><span>Genres: </span>{t.genre}, {t.type === 'tv' ? 'TV Shows' : 'Films'}</p>
              <p><span>This {t.type === 'tv' ? 'show' : 'film'} is: </span>{moodsFor(t).join(', ')}</p>
            </div>
          </div>

          <section>
            <h3>More Like This</h3>
            <div className="more-grid">
              {more.map(m => (
                <div key={m.id} className="more-card" onClick={() => openTitle(m)}>
                  <div className="more-art"><PosterArt t={m} /><span className="more-len">{lengthOf(m)}</span><span className="ep-play"><Play size={20} /></span></div>
                  <div className="more-body">
                    <div className="more-top">
                      <div><div className="match">{m.match}% Match</div><span className="maturity">{m.maturity}</span> <span className="muted">{m.year}</span></div>
                      <ListButton t={m} />
                    </div>
                    <p>{m.synopsis}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="about">
            <h3>About <b>{t.name}</b></h3>
            <p><span>Genres: </span>{t.genre}</p>
            <p><span>This {t.type === 'tv' ? 'show' : 'film'} is: </span>{moodsFor(t).join(', ')}</p>
            <p><span>Maturity rating: </span><span className="maturity">{t.maturity}</span></p>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ---------- Channels ---------- */

export function ChannelStrip() {
  const { channels } = useCatalog()
  return (
    <section className="row">
      <h2 className="row-header"><Link href="/channels" className="row-title">Channels<span className="explore">Explore All <ChevronRight size={14} /></span></Link></h2>
      <div className="channel-strip">{channels.map(c => <ChannelTile key={c.id} c={c} />)}</div>
    </section>
  )
}

export function ChannelTile({ c, big }: { c: Channel; big?: boolean }) {
  return (
    <Link href={`/channel/${c.id}`} className={`channel-tile ${big ? 'big' : ''}`}
      style={cssVars({ background: `radial-gradient(circle at 70% 20%, ${c.accent}66, transparent 60%), ${c.bg}`, '--accent': c.accent })}>
      {c.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="channel-logo" src={c.image} alt={c.name} loading="lazy" />
        : <span className="channel-name" style={{ color: c.accent, textShadow: `3px 3px 0 ${c.accent2}` }}>{c.name}</span>}
      <span className="channel-tag">{c.tagline}</span>
      <span className="live-pill"><i />LIVE</span>
    </Link>
  )
}
