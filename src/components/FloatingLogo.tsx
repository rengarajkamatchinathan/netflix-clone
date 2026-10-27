'use client'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/context/AppContext'
import type { Channel } from '@/lib/catalog'
import { Check } from './icons'
import { cssVars } from './ui'

/* ---------- Pop-out window ---------- */

// Document Picture-in-Picture (Chrome/Edge 116+) opens an always-on-top window holding our own
// page, so the logo stays in view over the YouTube tab a show opens in. A web page can't draw on
// another site's tab any other way. Not in TypeScript's DOM types yet.
interface DocumentPip { window: Window | null; requestWindow(o?: { width?: number; height?: number }): Promise<Window> }
const docPip = () => (window as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture
export const canPopOut = () => !!docPip()
const pipWindow = () => docPip()?.window ?? null

let pipChannel: Channel | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const usePoppedOut = () => useSyncExternalStore(subscribe, () => !!pipWindow())

// The browser always draws its own title bar on the pop-out and the window can't be see-through,
// so 'auto' fills it with the colour at the logo's edge: the window then reads as the logo itself.
type PipBg = 'auto' | 'black' | 'white' | 'channel'
const PIP_BGS: PipBg[] = ['auto', 'black', 'white', 'channel']
const PIP_BG_KEY = 'sf_pip_bg'
const readPipBg = (): PipBg => { try { const v = localStorage.getItem(PIP_BG_KEY) as PipBg; return PIP_BGS.includes(v) ? v : 'auto' } catch { return 'auto' } }

// Colour of the logo's top-left pixel, or null when that corner is transparent.
function edgeColour(img: HTMLImageElement): string | null {
  try {
    const cv = img.ownerDocument.createElement('canvas')
    cv.width = cv.height = 1
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return a > 200 ? `rgb(${r}, ${g}, ${b})` : null
  } catch { return null }
}

function paintPip() {
  const w = pipWindow(), c = pipChannel
  if (!w || !c) return
  const d = w.document
  d.title = c.name
  d.body.className = 'pip-body'
  const bg = readPipBg()
  const fill = (auto: string | null) => {
    d.body.style.background = bg === 'black' ? '#000' : bg === 'white' ? '#fff' : bg === 'channel' ? c.bg : auto || c.bg
  }
  fill(null)
  let logo: HTMLElement
  if (c.image) {
    // The pop-out document has no URL of its own, so the logo needs an absolute one.
    const img = Object.assign(d.createElement('img'), { src: new URL(c.image, location.href).href, alt: c.name, draggable: false })
    img.onload = () => fill(edgeColour(img))
    logo = img
  } else {
    logo = Object.assign(d.createElement('span'), { className: 'channel-name', textContent: c.name })
    logo.style.cssText = `color:${c.accent};text-shadow:3px 3px 0 ${c.accent2};font-size:18vw`
  }
  logo.classList.add('pip-logo')

  // Controls show on hover; right-click keeps them up.
  const bar = Object.assign(d.createElement('div'), { className: 'pip-bar' })
  const button = (label: string, title: string, run: () => void) => {
    const b = Object.assign(d.createElement('button'), { textContent: label, title, type: 'button' })
    b.setAttribute('aria-label', title)
    b.onclick = e => { e.stopPropagation(); run() }
    bar.append(b)
  }
  button('−', 'Smaller', () => scalePip(w, 1 / 1.25))
  button('+', 'Bigger', () => scalePip(w, 1.25))
  button('◐', `Background: ${bg}`, () => {
    try { localStorage.setItem(PIP_BG_KEY, PIP_BGS[(PIP_BGS.indexOf(bg) + 1) % PIP_BGS.length]) } catch {}
    paintPip()
  })
  button('↩', 'Back to page', () => w.close())
  d.oncontextmenu = e => { e.preventDefault(); d.body.classList.toggle('pinned') }
  d.body.replaceChildren(logo, bar)
}

// Resizes the pop-out by its content area, keeping the logo's shape. Works from a click inside it.
function scalePip(w: Window, f: number) {
  const iw = Math.max(80, Math.round(w.innerWidth * f)), ih = Math.round(w.innerHeight * iw / w.innerWidth)
  try { w.resizeTo(iw + w.outerWidth - w.innerWidth, ih + w.outerHeight - w.innerHeight) } catch {}
}

/* ---------- Browser extension ---------- */

// The Streamflix Channel Logo extension (extension/ in this repo) draws the logo straight on every
// other tab, with no window around it, while a channel page is open. Its content script here takes
// these messages; without the extension they go nowhere.
const tellExtension = (m: object) => window.postMessage({ source: 'streamflix', ...m }, location.origin)

// Shows this channel's logo in the pop-out window and, through the extension, on other tabs.
export function setLogoChannel(c: Channel) {
  pipChannel = c
  paintPip()
  tellExtension({
    type: 'channel',
    channel: { id: c.id, name: c.name, bg: c.bg, accent: c.accent, accent2: c.accent2, image: c.image && new URL(c.image, location.href).href },
  })
}

// Must run from a click: browsers only open the window on a user gesture.
async function popOut(c: Channel, width: number, height: number) {
  const dp = docPip()
  if (!dp) return
  pipChannel = c
  if (!dp.window) {
    // Sized to the logo exactly, so there's no border of background around it.
    const w = await dp.requestWindow({ width: Math.round(width), height: Math.round(height) })
    // Bring the site's styles (fonts, .channel-name) along for channels without an uploaded logo.
    for (const s of [...document.styleSheets]) {
      try {
        w.document.head.append(Object.assign(w.document.createElement('style'), { textContent: [...s.cssRules].map(r => r.cssText).join('\n') }))
      } catch {
        if (s.href) w.document.head.append(Object.assign(w.document.createElement('link'), { rel: 'stylesheet', href: s.href }))
      }
    }
    // documentPictureInPicture.window is cleared only after pagehide, so check again a tick later.
    w.addEventListener('pagehide', () => setTimeout(emit))
  }
  paintPip()
  emit()
}

/* ---------- Floating logo ---------- */

type Corner = 'tl' | 'tr' | 'bl' | 'br'
// x/y are null until the logo is first moved: it then sits in the top-right corner.
interface Prefs { x: number | null; y: number | null; w: number; opacity: number; hidden: boolean }
const DEFAULTS: Prefs = { x: null, y: null, w: 140, opacity: .7, hidden: false }
const SIZES: [string, number][] = [['Small', 90], ['Medium', 140], ['Large', 220]]
const OPACITIES = [1, .7, .4]
const CORNERS: [Corner, string][] = [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']]
const MIN_W = 48, MAX_W = 600, EDGE = 24, NAV = 84
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

const prefsKey = (profileId?: number) => `sf_float_logo_${profileId ?? 'default'}`
const readPrefs = (key: string): Prefs => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return DEFAULTS } }

// The channel's logo floating over the page, like a TV station's corner logo. Drag it anywhere;
// right-click for size, free resize, opacity, corners, pop-out and hide. Settings are kept per profile.
export function FloatingLogo({ c }: { c: Channel }) {
  const { profile } = useApp()
  const key = prefsKey(profile?.id)
  const [prefs, setPrefs] = useState(() => readPrefs(key))
  const [h, setH] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [, setViewport] = useState(0)
  const poppedOut = usePoppedOut()
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | Corner; px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => { setLogoChannel(c) }, [c])
  // Other tabs show the logo while this channel page is open (the extension also notices a closed tab).
  useEffect(() => {
    tellExtension({ type: 'page', on: true })
    return () => tellExtension({ type: 'page', on: false })
  }, [])
  useEffect(() => { if (!dragging) try { localStorage.setItem(key, JSON.stringify(prefs)) } catch {} }, [prefs, dragging, key])
  useEffect(() => { const on = () => setViewport(n => n + 1); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on) }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [prefs.hidden, poppedOut])
  // Leave free-resize mode on Escape or a click elsewhere.
  useEffect(() => {
    if (!resizing) return
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setResizing(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setResizing(false) }
    document.addEventListener('mousedown', out)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('keydown', esc) }
  }, [resizing])

  const x = clamp(prefs.x ?? window.innerWidth - prefs.w - EDGE, 0, window.innerWidth - prefs.w)
  const y = clamp(prefs.y ?? NAV, 0, window.innerHeight - h)
  const update = (p: Partial<Prefs>) => setPrefs(old => ({ ...old, ...p }))
  const toCorner = (k: Corner) => update({
    x: k[1] === 'l' ? EDGE : window.innerWidth - prefs.w - EDGE,
    y: k[0] === 't' ? NAV : window.innerHeight - h - EDGE,
  })

  const start = (mode: 'move' | Corner) => (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, px: e.clientX, py: e.clientY, x, y, w: prefs.w, h }
    setDragging(true)
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.px, dy = e.clientY - d.py
    if (d.mode === 'move') return update({ x: clamp(d.x + dx, 0, window.innerWidth - d.w), y: clamp(d.y + dy, 0, window.innerHeight - d.h) })
    // Corner handles keep the logo's shape and hold the opposite corner still.
    const right = d.mode[1] === 'r', bottom = d.mode[0] === 'b'
    const w = clamp(d.w + (right ? dx : -dx), MIN_W, MAX_W)
    const nh = d.h * w / d.w
    update({ w, x: right ? d.x : d.x + d.w - w, y: bottom ? d.y : d.y + d.h - nh })
  }
  const end = () => { if (drag.current) { drag.current = null; setDragging(false) } }

  if (poppedOut || prefs.hidden) {
    return (
      <button className="float-logo-restore" onClick={() => (poppedOut ? pipWindow()?.close() : update({ hidden: false }))}>
        {poppedOut ? 'Bring logo back' : 'Show logo'}
      </button>
    )
  }

  return (
    <>
      <div ref={ref} className={`float-logo ${dragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''}`}
        style={cssVars({ left: x, top: y, width: prefs.w, '--idle-opacity': prefs.opacity })}
        role="img" aria-label={`${c.name} logo. Drag to move; right-click or Shift+F10 for options.`} tabIndex={0}
        onPointerDown={start('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
        onKeyDown={e => {
          if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); setMenu({ x: x + 8, y: y + h }) }
        }}>
        {c.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.image} alt="" draggable={false} />
          : <span className="channel-name" style={{ color: c.accent, textShadow: `3px 3px 0 ${c.accent2}`, fontSize: prefs.w / 4 }}>{c.name}</span>}
        {resizing && CORNERS.map(([k]) => <i key={k} className={`float-logo-handle ${k}`} onPointerDown={start(k)} />)}
      </div>
      {menu && (
        <LogoMenu at={menu} onClose={() => setMenu(null)} items={[
          ...SIZES.map(([label, w]) => ({ label, on: prefs.w === w, run: () => { setResizing(false); update({ w, x: x + prefs.w - w }) } })),
          { label: resizing ? 'Done resizing' : 'Free resize…', on: resizing, run: () => setResizing(!resizing), divider: true },
          ...OPACITIES.map(o => ({ label: `Opacity ${Math.round(o * 100)}%`, on: prefs.opacity === o, run: () => update({ opacity: o }), divider: o === OPACITIES[0] })),
          ...CORNERS.map(([k, label], i) => ({ label: `Move to ${label.toLowerCase()}`, run: () => toCorner(k), divider: i === 0 })),
          ...(canPopOut() ? [{ label: 'Pop out over other tabs', run: () => { popOut(c, prefs.w, h).catch(() => {}) }, divider: true }] : []),
          { label: 'Reset', run: () => { setResizing(false); setPrefs(DEFAULTS) }, divider: !canPopOut() },
          { label: 'Hide logo', run: () => update({ hidden: true }) },
        ]} />
      )}
    </>
  )
}

interface MenuItem { label: string; run: () => void; on?: boolean; divider?: boolean }

function LogoMenu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState(at)
  // Keep the whole menu on screen when opened near an edge.
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect()
    setPos({ x: clamp(at.x, 8, window.innerWidth - r.width - 8), y: clamp(at.y, 8, window.innerHeight - r.height - 8) })
  }, [at])
  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', out)
    window.addEventListener('keydown', esc)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', out)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [])
  return createPortal(
    <ul ref={ref} className="float-logo-menu" role="menu" style={{ left: pos.x, top: pos.y }} onContextMenu={e => e.preventDefault()}>
      {items.map(it => (
        <li key={it.label} className={it.divider ? 'divider' : ''}>
          <button role="menuitem" onClick={() => { onClose(); it.run() }}>
            <span className="check">{it.on && <Check size={14} />}</span>{it.label}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
