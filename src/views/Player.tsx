'use client'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { preconnect } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import { useCatalog } from '@/context/CatalogContext'
import { api } from '@/lib/api'
import { airedVideo, episodesFor, nowPlaying, randomBumper, SAMPLE, showAt, type Catalog } from '@/lib/catalog'
import type { Bumper, Video } from '@/lib/types'
import { cssVars } from '@/components/ui'
import {
  Back, Episodes, ExitFullscreen, Flag, Forward10, Fullscreen, Mute, NextEp, Pause, Play, Rewind10, Speed, Subtitles, Volume,
} from '@/components/icons'

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00'
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Episode links aren't in the catalog; the players load them once per title or channel and keep them.
const videoCache = new Map<string, Promise<unknown>>()
function useLoaded<T>(path: string | null, fallback: T): T | null {
  const [data, setData] = useState<{ path: string; value: T } | null>(null)
  useEffect(() => {
    if (!path) return
    let live = true
    if (!videoCache.has(path)) videoCache.set(path, api<T>(path).catch(() => { videoCache.delete(path); return fallback }))
    ;(videoCache.get(path) as Promise<T>).then(value => { if (live) setData({ path, value }) })
    return () => { live = false }
  }, [path])
  return !path ? fallback : data?.path === path ? data.value : null
}

interface ShellProps {
  src: string
  startAt?: number
  onTime?: (cur: number, dur: number) => void
  onEnded: () => void
  title: string
  subtitle?: string
  synopsis?: string
  overlay?: ReactNode
  rightControls?: ReactNode
  onBack: () => void
}

function VideoShell({ src, startAt = 0, onTime, onEnded, title, subtitle, synopsis, overlay, rightControls, onBack }: ShellProps) {
  const v = useRef<HTMLVideoElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [active, setActive] = useState(true)
  const [flash, setFlash] = useState<{ k: number; playing?: boolean; skip?: number } | null>(null)
  const [pausedLong, setPausedLong] = useState(false)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [fs, setFs] = useState(false)
  const [rate, setRate] = useState(1)
  const [panel, setPanel] = useState<'subs' | 'speed' | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pauseT = useRef<ReturnType<typeof setTimeout>>(undefined)

  const poke = () => { setActive(true); setPausedLong(false); clearTimeout(idle.current); idle.current = setTimeout(() => setActive(false), 3000) }
  const toggle = () => {
    const el = v.current!
    if (el.paused) el.play(); else el.pause()
    setFlash({ k: Date.now(), playing: el.paused })
  }
  const skip = (d: number) => { const el = v.current!; el.currentTime = Math.min(Math.max(el.currentTime + d, 0), dur || 0); setFlash({ k: Date.now(), skip: d }) }
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current!.requestFullscreen())

  useEffect(() => { if (v.current) { v.current.volume = vol; v.current.muted = muted } }, [vol, muted])
  useEffect(() => { if (v.current) v.current.playbackRate = rate }, [rate])
  useEffect(() => {
    poke()
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); toggle() }
      else if (e.key === 'ArrowRight') skip(10)
      else if (e.key === 'ArrowLeft') skip(-10)
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVol(x => Math.min(1, x + 0.1)); setMuted(false) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVol(x => Math.max(0, x - 0.1)) }
      else if (e.key === 'f') toggleFs()
      else if (e.key === 'm') setMuted(m => !m)
      else if (e.key === 'Escape' && !document.fullscreenElement) onBack()
      poke()
    }
    const onFs = () => setFs(!!document.fullscreenElement)
    window.addEventListener('keydown', key)
    document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', onFs); clearTimeout(idle.current); clearTimeout(pauseT.current) }
  }, [dur])

  useEffect(() => {
    clearTimeout(pauseT.current)
    if (!playing) pauseT.current = setTimeout(() => setPausedLong(true), 6000)
    else setPausedLong(false)
  }, [playing])

  const pct = dur ? (t / dur) * 100 : 0
  const seekFromEvent = (e: MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) }

  return (
    <div ref={wrap} className={`player ${active || !playing ? '' : 'idle'} ${pausedLong ? 'paused-long' : ''}`} onMouseMove={poke} onClick={() => setPanel(null)}>
      <video ref={v} src={src} autoPlay playsInline onClick={toggle} onDoubleClick={toggleFs}
        onLoadedMetadata={e => { const el = e.currentTarget; setDur(el.duration); if (startAt) el.currentTime = startAt % el.duration }}
        onTimeUpdate={e => { const el = e.currentTarget; setT(el.currentTime); onTime?.(el.currentTime, el.duration) }}
        onProgress={e => { const b = e.currentTarget.buffered; if (b.length) setBuffered(b.end(b.length - 1)) }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={onEnded} />

      {flash && (
        <div key={flash.k} className="flash">
          {flash.skip ? (flash.skip > 0 ? <Forward10 size={64} /> : <Rewind10 size={64} />) : flash.playing ? <Play size={64} /> : <Pause size={64} />}
        </div>
      )}

      <div className="watching">
        <p>You&apos;re watching</p>
        <h1>{title}</h1>
        {subtitle && <h2>{subtitle}</h2>}
        {synopsis && <p className="watching-syn">{synopsis}</p>}
        <span className="watching-paused">Paused</span>
      </div>

      {overlay}

      <div className="player-top">
        <button className="pbtn" onClick={onBack} aria-label="Back"><Back size={36} /></button>
        <button className="pbtn" aria-label="Report a problem"><Flag size={30} /></button>
      </div>

      <div className="player-controls" onClick={e => e.stopPropagation()}>
        <div className="scrub-row">
          <div className="scrubber" onMouseMove={e => setHoverX(seekFromEvent(e))} onMouseLeave={() => setHoverX(null)}
            onClick={e => { v.current!.currentTime = seekFromEvent(e) * dur }}>
            <div className="scrub-track">
              <div className="scrub-buffer" style={{ width: `${dur ? (buffered / dur) * 100 : 0}%` }} />
              <div className="scrub-fill" style={{ width: `${pct}%` }} />
              <div className="scrub-knob" style={{ left: `${pct}%` }} />
            </div>
            {hoverX !== null && <span className="scrub-tip" style={{ left: `${hoverX * 100}%` }}>{fmt(hoverX * dur)}</span>}
          </div>
          <span className="time-left">{fmt(dur - t)}</span>
        </div>
        <div className="ctrl-row">
          <button className="pbtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={38} /> : <Play size={38} />}</button>
          <button className="pbtn" onClick={() => skip(-10)} aria-label="Back 10 seconds"><Rewind10 size={38} /></button>
          <button className="pbtn" onClick={() => skip(10)} aria-label="Forward 10 seconds"><Forward10 size={38} /></button>
          <div className="vol">
            <div className="vol-pop"><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : vol}
              style={cssVars({ '--p': `${(muted ? 0 : vol) * 100}%` })} onChange={e => { setVol(+e.target.value); setMuted(+e.target.value === 0) }} /></div>
            <button className="pbtn" onClick={() => setMuted(!muted)} aria-label="Volume">{muted || vol === 0 ? <Mute size={36} /> : <Volume size={36} />}</button>
          </div>
          <div className="player-title"><b>{title}</b>{subtitle && <span>{subtitle}</span>}</div>
          {rightControls}
          <div className="pop-wrap">
            {panel === 'subs' && (
              <div className="pop-panel" onClick={e => e.stopPropagation()}>
                <div><h4>Audio</h4><p className="sel">English [Original]</p><p>Hindi</p><p>Tamil</p></div>
                <div><h4>Subtitles</h4><p className="sel">Off</p><p>English</p><p>English (CC)</p></div>
              </div>
            )}
            <button className="pbtn" aria-label="Audio & Subtitles" onClick={e => { e.stopPropagation(); setPanel(panel === 'subs' ? null : 'subs') }}><Subtitles size={34} /></button>
          </div>
          <div className="pop-wrap">
            {panel === 'speed' && (
              <div className="pop-panel speed" onClick={e => e.stopPropagation()}>
                <h4>Playback Speed</h4>
                <div className="speed-line">
                  {[0.5, 0.75, 1, 1.25, 1.5].map(r => (
                    <button key={r} className={r === rate ? 'on' : ''} onClick={() => setRate(r)}><i /><span>{r}x{r === 1 ? ' (Normal)' : ''}</span></button>
                  ))}
                </div>
              </div>
            )}
            <button className="pbtn" aria-label="Playback speed" onClick={e => { e.stopPropagation(); setPanel(panel === 'speed' ? null : 'speed') }}><Speed size={34} /></button>
          </div>
          <button className="pbtn" onClick={toggleFs} aria-label="Full screen">{fs ? <ExitFullscreen size={36} /> : <Fullscreen size={36} />}</button>
        </div>
      </div>
    </div>
  )
}

export function WatchPage({ id }: { id: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const { profile, saveProgress, savePosition } = useApp()
  const { byId } = useCatalog()
  const t = byId[id]
  // Only shows with episode links need them loaded; the rest play placeholder episodes.
  const videos = useLoaded<Video[]>(t?.episodes ? `/titles/${encodeURIComponent(t.id)}/videos` : null, [])
  const ep = Number(params.get('ep')) || 1
  const lastSave = useRef(0)
  const [showEps, setShowEps] = useState(false)
  // Remember the episode being watched, so Play resumes here next time.
  const saved = t && profile?.position[t.id]
  useEffect(() => {
    if (t?.type === 'tv' && profile && saved?.episode !== ep) savePosition(t.id, { season: saved?.season ?? 1, episode: ep })
  }, [t?.id, ep])
  if (!t) return <div className="player"><p className="center">Title not found</p></div>
  if (!videos) return <div className="player" />
  const eps = episodesFor(t, videos)
  const cur = eps[ep - 1] || eps[0]
  const hasNext = t.type === 'tv' && ep < eps.length
  const goEp = (n: number) => router.replace(`/watch/${t.id}?ep=${n}`)

  return (
    <VideoShell key={`${id}-${ep}`} src={cur?.url || videos.find(v => v?.url)?.url || SAMPLE}
      title={t.name} subtitle={t.type === 'tv' && eps.length > 1 ? `E${cur.n}  ${cur.name}` : ''} synopsis={cur?.blurb || t.synopsis}
      onBack={() => router.back()}
      onTime={(pos, dur) => {
        if (profile && dur && Math.abs(pos - lastSave.current) > 5) { lastSave.current = pos; saveProgress(t.id, Math.round((pos / dur) * 100)) }
      }}
      onEnded={() => (hasNext ? goEp(ep + 1) : saveProgress(t.id, 100))}
      rightControls={<>
        {hasNext && <button className="pbtn" onClick={() => goEp(ep + 1)} aria-label="Next episode"><NextEp size={34} /></button>}
        {t.type === 'tv' && eps.length > 1 && (
          <div className="pop-wrap">
            {showEps && (
              <div className="pop-panel eps" onClick={e => e.stopPropagation()}>
                <h4>Season 1</h4>
                {eps.map(e => (
                  <button key={e.n} className={e.n === ep ? 'sel' : ''} onClick={() => goEp(e.n)}>
                    <span>{e.n}</span><b>{e.name}</b>{e.n === ep && <i className="ep-bar" />}
                  </button>
                ))}
              </div>
            )}
            <button className="pbtn" aria-label="Episodes" onClick={e => { e.stopPropagation(); setShowEps(!showEps) }}><Episodes size={34} /></button>
          </div>
        )}
      </>}
    />
  )
}

type LiveState =
  | { slot: number; phase: 'bumper'; bumper: Bumper; lastBumper: Bumper | null; offset: number }
  | { slot: number; phase: 'show'; lastBumper?: Bumper | null; offset: number }

// Tuning in starts with a bumper (if any), then joins the current show mid-way like real TV.
function initialLive(cat: Catalog, id: string): LiveState {
  const np = nowPlaying(cat, id)
  const c = cat.channelById[id]
  const bumper = c && randomBumper(c)
  return bumper ? { slot: np.slot, phase: 'bumper', bumper, lastBumper: bumper, offset: np.offsetSec } : { slot: np.slot, phase: 'show', offset: np.offsetSec }
}

// Live channel: follows the clock schedule, plays a bumper between shows when the channel has any.
export function LivePage({ id }: { id: string }) {
  const router = useRouter()
  const cat = useCatalog()
  const c = cat.channelById[id]
  const [state, setState] = useState<LiveState>(() => initialLive(cat, id))
  const [banner, setBanner] = useState(true)
  const videos = useLoaded<Record<string, Video[]>>(c ? `/channels/${encodeURIComponent(id)}/videos` : null, {})

  useEffect(() => { setState(initialLive(cat, id)); setBanner(true) }, [id])
  useEffect(() => { setBanner(true); const h = setTimeout(() => setBanner(false), 6000); return () => clearTimeout(h) }, [state.slot, state.phase])

  if (!c || !videos) return null
  const { channels } = cat
  const idx = channels.findIndex(x => x.id === id)
  const zap = (d: number) => router.replace(`/live/${channels[(idx + d + channels.length) % channels.length].id}`)
  const show = showAt(cat, id, state.slot)
  const next = showAt(cat, id, state.slot + 1)
  const later = showAt(cat, id, state.slot + 2)

  const onEnded = () => setState(s => {
    if (s.phase === 'bumper') return { slot: s.slot, phase: 'show', lastBumper: s.lastBumper, offset: 0 }
    const bumper = randomBumper(c, s.lastBumper ?? null)
    return bumper ? { slot: s.slot + 1, phase: 'bumper', bumper, lastBumper: bumper, offset: 0 } : { slot: s.slot + 1, phase: 'show', offset: 0 }
  })

  const inBumper = state.phase === 'bumper'
  const overlay = (
    <>
      {c.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="live-bug img" src={c.image} alt={c.name} />
        : <div className="live-bug" style={{ color: c.accent, textShadow: `2px 2px 0 ${c.accent2}` }}>{c.name}</div>}
      <div className={`live-banner ${banner ? 'in' : ''}`} style={cssVars({ '--accent': c.accent })}>
        <span className="live-pill"><i />LIVE</span>
        <h2>{inBumper ? `Up next: ${show.name}` : show.name}</h2>
        <p>{inBumper ? <>Then: {next.name}</> : <>Up next: <b>{next.name}</b> · Later: {later.name}</>}</p>
      </div>
    </>
  )
  const channelControls = <>
    <button className="pbtn ch" onClick={() => zap(-1)} aria-label="Previous channel">CH−</button>
    <button className="pbtn ch" onClick={() => zap(1)} aria-label="Next channel">CH+</button>
    <button className="pbtn ch" onClick={() => setBanner(b => !b)}>GUIDE</button>
  </>

  if (state.phase === 'bumper') {
    return (
      <YouTubeBumper key={`${id}-${state.slot}-yt`} videoId={state.bumper.ytId} onEnded={onEnded}
        onBack={() => router.push(`/channel/${id}`)} overlay={overlay} controls={channelControls} />
    )
  }

  return (
    <VideoShell key={`${id}-${state.slot}-${state.phase}`} src={airedVideo(show, state.slot, videos[show.id])} startAt={state.offset}
      title={c.name} subtitle={`LIVE · ${show.name}`} synopsis={show.synopsis}
      onBack={() => router.push(`/channel/${id}`)} onEnded={onEnded}
      overlay={overlay}
      rightControls={channelControls}
    />
  )
}

/* ---------- YouTube ---------- */

interface YTPlayer {
  mute(): void; unMute(): void; playVideo(): void; seekTo(s: number): void; getPlayerState(): number; destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number; BUFFERING: number; ENDED: number }
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

// Opens the connections a YouTube clip needs (API script, player, stills) ahead of loading it.
export function preconnectYouTube() {
  preconnect('https://www.youtube.com')
  preconnect('https://www.youtube-nocookie.com')
  preconnect('https://i.ytimg.com')
}

// Loads YouTube's IFrame Player API once and resolves with the global YT object.
let ytApi: Promise<YTNamespace> | undefined
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  ytApi ||= new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!) }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return ytApi
}

// A YouTube video played through the official embed player with no YouTube UI showing:
// it stays invisible until it is actually playing (hides the initial play button).
// Plays with sound unless `muted`; if the browser blocks sound on autoplay, it falls back to
// muted playback and calls onAutoMuted. Errors / never loading call onEnded so callers move on.
const YT_BLOCKED = [-1, 2, 5] // unstarted, paused, cued
// YouTube flashes a play/pause indicator in the middle of the frame for ~0.5s whenever playback
// (re)starts; it can't be styled away (cross-origin iframe), so the clip is only revealed after it.
const YT_INDICATOR_MS = 1500

interface ClipProps { videoId: string; muted?: boolean; loop?: boolean; onEnded?: () => void; onAutoMuted?: () => void }

export function YouTubeClip({ videoId, muted = false, loop = false, onEnded, onAutoMuted }: ClipProps) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [playing, setPlaying] = useState(false)
  const cb = useRef({ onEnded, onAutoMuted, loop, muted })
  cb.current = { onEnded, onAutoMuted, loop, muted }
  preconnectYouTube()

  useEffect(() => {
    let cancelled = false
    let startCheck: ReturnType<typeof setTimeout> | undefined
    let reveal: ReturnType<typeof setTimeout> | undefined
    const hide = () => { clearTimeout(reveal); setPlaying(false) }
    const showSoon = () => { clearTimeout(reveal); reveal = setTimeout(() => setPlaying(true), YT_INDICATOR_MS) }
    const failSafe = setTimeout(() => cb.current.onEnded?.(), 15000) // API never loaded (offline / blocked)
    loadYouTubeApi().then(YT => {
      clearTimeout(failSafe)
      if (cancelled || !host.current) return
      player.current = new YT.Player(host.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0 },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            if (!cb.current.muted) e.target.unMute()
            // autoplay normally starts it; an extra playVideo() on a playing video makes YouTube flash
            // its pause indicator, so only nudge it if it hasn't started.
            const s = e.target.getPlayerState()
            if (s !== YT.PlayerState.PLAYING && s !== YT.PlayerState.BUFFERING) e.target.playVideo()
            startCheck = setTimeout(() => {
              if (!YT_BLOCKED.includes(e.target.getPlayerState())) return
              hide()
              e.target.mute()
              e.target.playVideo()
              cb.current.onAutoMuted?.()
            }, 1500)
          },
          onStateChange: (e: { target: YTPlayer; data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) showSoon()
            else if (e.data !== YT.PlayerState.BUFFERING) hide()
            if (e.data === YT.PlayerState.ENDED) {
              if (cb.current.loop) { e.target.seekTo(0); e.target.playVideo() } else cb.current.onEnded?.()
            }
          },
          onError: () => cb.current.onEnded?.(),
        },
      })
    })
    return () => { cancelled = true; clearTimeout(failSafe); clearTimeout(startCheck); clearTimeout(reveal); player.current?.destroy?.(); player.current = null }
  }, [videoId])

  useEffect(() => {
    const p = player.current
    if (!p?.mute) return
    if (muted) p.mute(); else p.unMute()
  }, [muted])

  return <div className={`yt-clip ${playing ? 'on' : ''}`}><div ref={host} /></div>
}

// Plays a YouTube bumper full screen, then calls onEnded.
function YouTubeBumper({ videoId, onEnded, onBack, overlay, controls }: { videoId: string; onEnded: () => void; onBack: () => void; overlay: ReactNode; controls: ReactNode }) {
  const done = useRef(false)
  const [muted, setMuted] = useState(false)
  const finish = () => { if (!done.current) { done.current = true; onEnded() } }

  return (
    <div className="player yt-bumper">
      <YouTubeClip videoId={videoId} muted={muted} onEnded={finish} onAutoMuted={() => setMuted(true)} />
      {overlay}
      <div className="player-top">
        <button className="pbtn" onClick={onBack} aria-label="Back"><Back size={36} /></button>
      </div>
      <div className="player-controls">
        <div className="ctrl-row">
          <button className="pbtn" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <Mute size={36} /> : <Volume size={36} />}</button>
          <div className="player-title"><b>Bumper</b><span>LIVE</span></div>
          {controls}
          <button className="pbtn ch" onClick={finish}>SKIP ›</button>
        </div>
      </div>
    </div>
  )
}
