import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { byId, episodesFor } from '../data/catalog'
import { channelById, channels, nowPlaying } from '../data/channels'
import {
  Back, Episodes, ExitFullscreen, Flag, Forward10, Fullscreen, Mute, NextEp, Pause, Play, Rewind10, Speed, Subtitles, Volume,
} from '../components/icons'

const fmt = s => {
  if (!isFinite(s)) return '0:00'
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function VideoShell({ src, startAt = 0, onTime, onEnded, title, subtitle, synopsis, overlay, rightControls, onBack }) {
  const v = useRef()
  const wrap = useRef()
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [active, setActive] = useState(true)
  const [flash, setFlash] = useState(null)
  const [pausedLong, setPausedLong] = useState(false)
  const [hoverX, setHoverX] = useState(null)
  const [fs, setFs] = useState(false)
  const [rate, setRate] = useState(1)
  const [panel, setPanel] = useState(null)
  const idle = useRef()
  const pauseT = useRef()

  const poke = () => { setActive(true); setPausedLong(false); clearTimeout(idle.current); idle.current = setTimeout(() => setActive(false), 3000) }
  const toggle = () => {
    const el = v.current
    el.paused ? el.play() : el.pause()
    setFlash({ k: Date.now(), playing: el.paused })
  }
  const skip = d => { v.current.currentTime = Math.min(Math.max(v.current.currentTime + d, 0), dur || 0); setFlash({ k: Date.now(), skip: d }) }
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current.requestFullscreen())

  useEffect(() => { if (v.current) { v.current.volume = vol; v.current.muted = muted } }, [vol, muted])
  useEffect(() => { if (v.current) v.current.playbackRate = rate }, [rate])
  useEffect(() => {
    poke()
    const key = e => {
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
  const seekFromEvent = e => { const r = e.currentTarget.getBoundingClientRect(); return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) }

  return (
    <div ref={wrap} className={`player ${active || !playing ? '' : 'idle'} ${pausedLong ? 'paused-long' : ''}`} onMouseMove={poke} onClick={() => setPanel(null)}>
      <video ref={v} src={src} autoPlay playsInline onClick={toggle} onDoubleClick={toggleFs}
        onLoadedMetadata={e => { setDur(e.target.duration); if (startAt) e.target.currentTime = startAt % e.target.duration }}
        onTimeUpdate={e => { setT(e.target.currentTime); onTime?.(e.target.currentTime, e.target.duration) }}
        onProgress={e => { const b = e.target.buffered; if (b.length) setBuffered(b.end(b.length - 1)) }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={onEnded} />

      {flash && (
        <div key={flash.k} className="flash">
          {flash.skip ? (flash.skip > 0 ? <Forward10 size={64} /> : <Rewind10 size={64} />) : flash.playing ? <Play size={64} /> : <Pause size={64} />}
        </div>
      )}

      <div className="watching">
        <p>You're watching</p>
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
            onClick={e => { v.current.currentTime = seekFromEvent(e) * dur }}>
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
              style={{ '--p': `${(muted ? 0 : vol) * 100}%` }} onChange={e => { setVol(+e.target.value); setMuted(+e.target.value === 0) }} /></div>
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

export function WatchPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { profile, saveProgress } = useApp()
  const t = byId[id]
  const ep = +params.get('ep') || 1
  const lastSave = useRef(0)
  const [showEps, setShowEps] = useState(false)
  if (!t) return <div className="player"><p className="center">Title not found</p></div>
  const eps = episodesFor(t)
  const hasNext = t.type === 'tv' && ep < eps.length
  const goEp = n => nav(`/watch/${t.id}?ep=${n}`, { replace: true })

  return (
    <VideoShell key={`${id}-${ep}`} src={t.videoUrl}
      title={t.name} subtitle={t.type === 'tv' ? `E${ep}  Episode ${ep}` : ''} synopsis={t.type === 'tv' ? eps[ep - 1]?.blurb : t.synopsis}
      onBack={() => nav(-1)}
      onTime={(cur, dur) => {
        if (profile && dur && Math.abs(cur - lastSave.current) > 5) { lastSave.current = cur; saveProgress(t.id, Math.round((cur / dur) * 100)) }
      }}
      onEnded={() => (hasNext ? goEp(ep + 1) : saveProgress(t.id, 100))}
      rightControls={<>
        {hasNext && <button className="pbtn" onClick={() => goEp(ep + 1)} aria-label="Next episode"><NextEp size={34} /></button>}
        {t.type === 'tv' && (
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

export function LivePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const c = channelById[id]
  const [np, setNp] = useState(() => nowPlaying(id))
  const [banner, setBanner] = useState(true)

  useEffect(() => { setNp(nowPlaying(id)); setBanner(true); const h = setTimeout(() => setBanner(false), 6000); return () => clearTimeout(h) }, [id])
  useEffect(() => {
    const iv = setInterval(() => setNp(prev => { const n = nowPlaying(id); return n.current.id !== prev.current.id ? n : prev }), 15000)
    return () => clearInterval(iv)
  }, [id])

  if (!c) return null
  const idx = channels.findIndex(x => x.id === id)
  const zap = d => nav(`/live/${channels[(idx + d + channels.length) % channels.length].id}`, { replace: true })

  return (
    <VideoShell key={`${id}-${np.current.id}`} src={np.current.videoUrl} startAt={np.offsetSec}
      title={c.name} subtitle={`LIVE · ${np.current.name}`} synopsis={np.current.synopsis} onBack={() => nav(`/channel/${id}`)}
      onEnded={() => setNp(nowPlaying(id))}
      overlay={
        <>
          <div className="live-bug" style={{ color: c.accent, textShadow: `2px 2px 0 ${c.accent2}` }}>{c.name}</div>
          <div className={`live-banner ${banner ? 'in' : ''}`} style={{ '--accent': c.accent }}>
            <span className="live-pill"><i />LIVE</span>
            <h2>{np.current.name}</h2>
            <p>Up next: <b>{np.next.name}</b> · Later: {np.later.name}</p>
          </div>
        </>
      }
      rightControls={<>
        <button className="pbtn ch" onClick={() => zap(-1)} aria-label="Previous channel">CH−</button>
        <button className="pbtn ch" onClick={() => zap(1)} aria-label="Next channel">CH+</button>
        <button className="pbtn ch" onClick={() => setBanner(b => !b)}>GUIDE</button>
      </>}
    />
  )
}
