'use client'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import { useCatalog } from '@/context/CatalogContext'
import { BrowseCtx, useBrowse, type CardRect, type Origin, type Rect } from '@/context/BrowseContext'
import { hash, type Channel, type Title } from '@/lib/catalog'
import type { WatchPosition } from '@/lib/types'
import { cssVars, PosterArt } from './ui'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Close, Info, Play, Plus, Replay, ThumbUp, Volume } from './icons'

const MOODS = ['Exciting', 'Feel-good', 'Witty', 'Suspenseful', 'Heartfelt', 'Imaginative', 'Quirky', 'Goofy', 'Action-packed']
export const moodsFor = (t: Title) => [0, 1, 2].map(i => MOODS[(hash(t.id) + i * 4) % MOODS.length]).filter((m, i, a) => a.indexOf(m) === i)
const lengthOf = (t: Title) => (t.type === 'tv' ? (t.seasons ? `${t.seasons} Season${t.seasons > 1 ? 's' : ''}` : 'Series') : t.duration)

/* ---------- Shared browse state: hover preview + info modal ---------- */

export function BrowseProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<{ t: Title; rect: Rect } | null>(null)
  const [preview, setPreview] = useState<{ t: Title; origin: Origin; rect: CardRect } | null>(null)
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const router = useRouter()
  const { profile, recordPlay } = useApp()
  useEffect(() => { setPreview(null); setInfo(null) }, [pathname, search])

  const openInfo = (t: Title, rect: Rect = null) => { setPreview(null); setInfo({ t, rect }) }
  const openLink = (t: Title) => { setPreview(null); window.open(t.link!, '_blank', 'noopener,noreferrer') }
  // Clicking a title always opens the preview modal; its Play button is what opens the link.
  const openTitle = (t: Title, rect: Rect = null) => openInfo(t, rect)
  // Play: open its link in a new tab if it has one, otherwise the built-in player at the
  // episode the profile is up to.
  const playTitle = (t: Title) => {
    recordPlay(t.id)
    if (t.link) return openLink(t)
    const pos = t.type === 'tv' ? profile?.position[t.id] : undefined
    router.push(`/watch/${t.id}${pos ? `?ep=${pos.episode}` : ''}`)
  }
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

export { useBrowse }

export const posLabel = (p: WatchPosition) => `S${p.season}:E${p.episode}`
const resumeLabel = (t: Title, p?: WatchPosition) => (t.type === 'tv' && p ? `Resume ${posLabel(p)}` : 'Play')

const clamp = (v: number, max: number) => Math.max(1, Math.min(max, Math.round(v) || 1))
function StepField({ label, value, max, set }: { label: string; value: number; max: number; set: (n: number) => void }) {
  return (
    <label className="tracker-field">
      <span>{label}</span>
      <span className="stepper">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => set(clamp(value - 1, max))} disabled={value <= 1}>−</button>
        <input type="number" inputMode="numeric" min={1} max={max} value={value} onChange={e => set(clamp(Number(e.target.value), max))} />
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} onClick={() => set(clamp(value + 1, max))} disabled={value >= max}>+</button>
      </span>
    </label>
  )
}

// Manual "where am I up to" for a series, saved per profile.
function WatchTracker({ t }: { t: Title }) {
  const { profile, savePosition } = useApp()
  const saved = profile?.position[t.id]
  const [season, setSeason] = useState(saved?.season ?? 1)
  const [episode, setEpisode] = useState(saved?.episode ?? 1)
  const maxSeason = t.seasons > 0 ? t.seasons : 99
  const dirty = !saved || saved.season !== season || saved.episode !== episode
  if (!profile) return null

  return (
    <div className="tracker">
      <div className="tracker-head">
        <h4>Your Progress</h4>
        {saved && <span className="muted">Last watched <b>{posLabel(saved)}</b></span>}
      </div>
      <div className="tracker-row">
        <StepField label="Season" value={season} max={maxSeason} set={setSeason} />
        <StepField label="Episode" value={episode} max={999} set={setEpisode} />
        <button type="button" className="btn grey tracker-save" disabled={!dirty} onClick={() => savePosition(t.id, { season, episode })}>
          {dirty ? 'Save' : <><Check size={16} /> Saved</>}
        </button>
        <button type="button" className="tracker-next" onClick={() => { const e = episode + 1; setEpisode(e); savePosition(t.id, { season, episode: e }) }}>
          Watched E{episode} → next
        </button>
      </div>
    </div>
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
      <div className="preview-art" onClick={() => openInfo(t, ref.current!.getBoundingClientRect())}>
        <PosterArt t={t}><Progress pct={profile?.progress[t.id]} /></PosterArt>
      </div>
      <div className="preview-info">
        <div className="preview-btns">
          <TipButton tip={resumeLabel(t, profile?.position[t.id])} className="circle white" onClick={() => playTitle(t)}><Play size={16} /></TipButton>
          <ListButton t={t} />
          <LikeButton />
          <TipButton tip="Episodes & info" className="circle push" onClick={() => openInfo(t, ref.current!.getBoundingClientRect())}><ChevronDown size={18} /></TipButton>
        </div>
        <Meta t={t} />
        {profile?.position[t.id] && <div className="watch-pos-line">{posLabel(profile.position[t.id])}</div>}
        <ul className="moods">{moodsFor(t).map(m => <li key={m}>{m}</li>)}</ul>
      </div>
    </div>
  )
}

/* ---------- Cards and rows ---------- */

export function TitleCard({ t, tall, origin = 'center', resume }: { t: Title; tall?: boolean; origin?: Origin; resume?: boolean }) {
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
      <PosterArt t={t} wide={!tall}>
        <Progress pct={profile?.progress[t.id]} />
        {resume && profile?.position[t.id] && <span className="card-resume">{posLabel(profile.position[t.id])}</span>}
      </PosterArt>
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

export function Row({ title, items, top10, link, viewAll, resume }: { title: string; items: Title[]; top10?: boolean; link?: string; viewAll?: string; resume?: boolean }) {
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
                  : <TitleCard t={t} origin={origin} resume={resume} />}
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

const SLIDE_MS = 8000

// The hero at the top of Browse. With several titles it is a carousel: each slide plays for
// SLIDE_MS (shown by the progress bars), then cross-fades to the next. Hovering the text or
// controls pauses it, as does a hidden tab; the arrows, bars and arrow keys move it by hand.
export function Billboard({ items, start = 0 }: { items: { t: Title; rank?: number }[]; start?: number }) {
  const { openInfo, playTitle } = useBrowse()
  const { profile } = useApp()
  const n = items.length
  const [i, setI] = useState(() => start % n)
  const [leaving, setLeaving] = useState<number | null>(null) // slide fading out underneath
  const [run, setRun] = useState(0) // restarts the slide's animations and timers
  const [compact, setCompact] = useState(false)
  const [hover, setHover] = useState(false)
  const [hidden, setHidden] = useState(false)
  const { t, rank } = items[Math.min(i, n - 1)]

  const go = (to: number) => {
    const next = ((to % n) + n) % n
    if (next !== i) setLeaving(i)
    setI(next)
    setRun(r => r + 1)
  }
  useEffect(() => { setCompact(false); const h = setTimeout(() => setCompact(true), 5000); return () => clearTimeout(h) }, [i, run])
  useEffect(() => { if (leaving === null) return; const h = setTimeout(() => setLeaving(null), 1200); return () => clearTimeout(h) }, [leaving, run])
  useEffect(() => {
    const vis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])
  // Left/right arrow keys, unless typing or a title's details are open.
  const goRef = useRef(go)
  goRef.current = go
  const iRef = useRef(i)
  iRef.current = i
  useEffect(() => {
    if (n < 2) return
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (document.querySelector('.modal-bg')) return
      if (e.key === 'ArrowRight') goRef.current(iRef.current + 1)
      else if (e.key === 'ArrowLeft') goRef.current(iRef.current - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [n])

  const paused = hover || hidden
  const pause = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }

  return (
    <section className={`billboard ${paused ? 'paused' : ''}`} aria-roledescription={n > 1 ? 'carousel' : undefined}>
      {leaving !== null && leaving !== i && <div className="billboard-art leaving" key={`out-${leaving}-${run}`}><PosterArt t={items[leaving].t} bare /></div>}
      <div className="billboard-art entering" key={`in-${i}-${run}`}><PosterArt t={t} bare /></div>
      <div className="billboard-vignette" />
      <div className={`billboard-info ${compact ? 'compact' : ''}`} key={`info-${i}-${run}`} {...pause}>
        <div className="series-tag"><span className="logo">S</span>{t.type === 'tv' ? 'SERIES' : 'FILM'}</div>
        <h1 className="title-treatment">{t.name}</h1>
        <div className="billboard-collapse">
          {rank && <div className="top10-line"><span className="top10-badge"><small>TOP</small>10</span>#{rank} in {t.type === 'tv' ? 'TV Shows' : 'Films'} Today</div>}
          <p className="synopsis">{t.synopsis}</p>
        </div>
        <div className="btns">
          <button className="btn white" onClick={() => playTitle(t)}><Play size={26} /> {resumeLabel(t, profile?.position[t.id])}</button>
          <button className="btn grey" onClick={() => openInfo(t)}><Info size={26} /> More Info</button>
        </div>
      </div>
      <div className="billboard-side" {...pause}>
        <button className="round-outline" aria-label="Replay" onClick={() => setRun(r => r + 1)}><Replay size={20} /></button>
        <span className="maturity-flag">{t.maturity}</span>
      </div>
      {n > 1 && <>
        <button className="billboard-nav prev" aria-label="Previous title" onClick={() => go(i - 1)} {...pause}><ChevronLeft size={40} /></button>
        <button className="billboard-nav next" aria-label="Next title" onClick={() => go(i + 1)} {...pause}><ChevronRight size={40} /></button>
        <div className="billboard-dots" role="tablist" aria-label="Featured titles" {...pause}>
          {items.map((x, k) => (
            <button key={x.t.id} role="tab" aria-selected={k === i} aria-label={x.t.name} className={k === i ? 'on' : k < i ? 'done' : ''} onClick={() => go(k)}>
              {k === i && <span key={run} style={{ animationDuration: `${SLIDE_MS}ms` }} onAnimationEnd={() => go(i + 1)} />}
            </button>
          ))}
        </div>
      </>}
    </section>
  )
}

/* ---------- Detail modal (expands from the card it was opened from) ---------- */

export function DetailModal({ t, rect, onClose }: { t: Title; rect: Rect; onClose: () => void }) {
  const { openTitle, playTitle } = useBrowse()
  const { titles, channelById } = useCatalog()
  const { profile } = useApp()
  const pos = profile?.position[t.id]
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
              <button className="btn white" onClick={() => playTitle(t)}><Play size={24} /> {resumeLabel(t, pos)}</button>
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
              {t.type === 'tv' && <WatchTracker t={t} />}
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
      <span className="channel-hover">
        <span className="channel-hover-play"><Play size={16} /></span>
        <span className="channel-hover-text"><b>{c.name}</b><small>Watch Live</small></span>
      </span>
    </Link>
  )
}
