// Runs on every site except Streamflix itself (its channel page has its own floating logo), in
// every frame so it can reach fullscreen players embedded from other sites.
// While a Streamflix channel page is open (storage `active`), shows that channel's logo straight
// on the page, with no window or background around it: drag to move, right-click for size, free
// resize, opacity, corners and hide. Position and size are shared by all tabs.
(() => {

  const DEFAULTS = { x: null, y: null, w: 140, opacity: 0.8, hidden: false }
  const SIZES = [['Small', 90], ['Medium', 140], ['Large', 220]]
  const OPACITIES = [1, 0.8, 0.5]
  const CORNERS = [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']]
  const MIN_W = 48, MAX_W = 600, EDGE = 24, TOP = 72
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

  let channel = null
  let active = false
  let prefs = { ...DEFAULTS }
  let resizing = false
  let drag = null
  let menu = null

  const el = (tag, className) => Object.assign(document.createElement(tag), className ? { className } : {})

  // Closed shadow root: YouTube's styles can't reach the logo and ours don't leak out.
  const host = el('streamflix-logo')
  // Spelled out rather than `all: initial`, which would also undo the popover's own show/hide.
  host.style.cssText = 'position: fixed; inset: 0; width: auto; height: auto; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; pointer-events: none; z-index: 2147483647'
  const shadow = host.attachShadow({ mode: 'closed' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(`
    .logo { position: fixed; pointer-events: auto; cursor: grab; touch-action: none; user-select: none; opacity: var(--idle, .8); transition: opacity .25s; outline-offset: 4px; }
    .logo:hover, .logo:focus-visible, .logo.dragging, .logo.resizing { opacity: 1; }
    .logo.dragging { cursor: grabbing; }
    .logo.resizing { outline: 1px dashed rgba(255, 255, 255, .8); }
    .logo img { display: block; width: 100%; height: auto; pointer-events: none; filter: drop-shadow(0 2px 8px rgba(0, 0, 0, .6)); }
    .logo span { display: block; font: 900 20px/1 'Arial Black', Impact, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .handle { display: none; position: absolute; width: 12px; height: 12px; background: #fff; border: 2px solid #e50914; border-radius: 2px; }
    .logo.resizing .handle { display: block; }
    .tl { left: -7px; top: -7px; cursor: nwse-resize; } .br { right: -7px; bottom: -7px; cursor: nwse-resize; }
    .tr { right: -7px; top: -7px; cursor: nesw-resize; } .bl { left: -7px; bottom: -7px; cursor: nesw-resize; }
    .menu { position: fixed; pointer-events: auto; min-width: 210px; margin: 0; padding: 6px 0; list-style: none; background: rgba(0, 0, 0, .95); border: 1px solid rgba(255, 255, 255, .15); border-radius: 4px; box-shadow: 0 8px 24px rgba(0, 0, 0, .6); font: 14px/1.3 system-ui, sans-serif; }
    .menu li.divider { border-top: 1px solid rgba(255, 255, 255, .12); margin-top: 6px; padding-top: 6px; }
    .menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 14px 6px 10px; background: none; border: 0; color: #e5e5e5; font: inherit; text-align: left; cursor: pointer; }
    .menu button:hover, .menu button:focus-visible { background: rgba(255, 255, 255, .1); color: #fff; outline: none; }
    .menu .check { display: inline-block; width: 14px; text-align: center; }
  `)
  shadow.adoptedStyleSheets = [sheet]

  const box = shadow.appendChild(el('div', 'logo'))
  box.tabIndex = 0
  box.setAttribute('role', 'img')
  const art = box.appendChild(el('div'))
  for (const [k] of CORNERS) box.appendChild(el('i', `handle ${k}`)).addEventListener('pointerdown', e => start(e, k))

  /* Which frame draws the logo */

  // This script runs in every frame, but one frame draws the logo: normally the top page. In
  // fullscreen it's the frame holding the fullscreen content, since an embedded player goes
  // fullscreen as its whole iframe and the page around it can't put anything inside that. A frame
  // with a fullscreen element tells its parent, so frames above stand down; if the fullscreen
  // iframe never says so (the script couldn't run in it), the frame above draws the logo instead.
  const isTop = window === window.top
  const SIGNAL = 'streamflixLogoFullscreen'
  const claimed = new Set() // child frames holding fullscreen content that draw the logo themselves
  const fullscreenEl = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null
  const isFrame = el => el instanceof HTMLIFrameElement || el instanceof HTMLFrameElement
  function drawsHere() {
    const f = fullscreenEl()
    if (!f) return isTop
    return !(isFrame(f) && claimed.has(f.contentWindow))
  }
  window.addEventListener('message', e => {
    if (!e.data || typeof e.data[SIGNAL] !== 'boolean') return
    if (e.data[SIGNAL]) claimed.add(e.source); else claimed.delete(e.source)
    render()
  })

  // Fullscreen content is drawn in the browser's top layer, and whatever entered that layer last
  // is on top. The logo is a popover, which lives there too, so it re-enters on every fullscreen
  // change. Fullscreen also makes everything outside the fullscreen element ignore the mouse, so
  // the logo goes inside that element when it can, to stay draggable. Media, images and frames
  // can't hold it: there it still shows, but can't be dragged until fullscreen ends.
  const popover = typeof host.showPopover === 'function'
  if (popover) host.popover = 'manual'
  const canHold = el => el instanceof HTMLElement && !(isFrame(el) || el instanceof HTMLMediaElement ||
    el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || el instanceof HTMLObjectElement || el instanceof HTMLEmbedElement)
  const visible = () => active && channel && !prefs.hidden && drawsHere()
  const isOpen = () => popover && host.matches(':popover-open')
  function layer(reenter) {
    // Frames not drawing the logo keep nothing on their page.
    if (!visible()) { host.remove(); return }
    const f = fullscreenEl()
    const parent = f && canHold(f) ? f : document.documentElement
    const moved = host.parentNode !== parent
    if (moved) parent.appendChild(host) // moving it also closes the popover
    if (!popover || (!moved && !reenter && isOpen())) return
    try {
      if (isOpen()) host.hidePopover()
      host.showPopover()
      // A player built as a web component may not draw children it doesn't expect: go outside it.
      if (parent !== document.documentElement && !host.getClientRects().length) {
        document.documentElement.appendChild(host)
        host.showPopover()
      }
    } catch {}
  }

  function onFullscreenChange() {
    if (!isTop) window.parent.postMessage({ [SIGNAL]: !!fullscreenEl() }, '*')
    layer(true)
    render()
  }
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  window.addEventListener('resize', () => render())

  const place = () => {
    const h = box.offsetHeight
    return {
      x: clamp(prefs.x ?? innerWidth - prefs.w - EDGE, 0, innerWidth - prefs.w),
      y: clamp(prefs.y ?? TOP, 0, innerHeight - h),
      h,
    }
  }

  function paintArt() {
    if (!channel) return art.replaceChildren()
    box.setAttribute('aria-label', `${channel.name} logo. Drag to move; right-click or Shift+F10 for options.`)
    if (channel.imageData) {
      const img = Object.assign(el('img'), { src: channel.imageData, alt: '', draggable: false })
      img.onload = () => render()
      art.replaceChildren(img)
    } else {
      const name = Object.assign(el('span'), { textContent: channel.name })
      name.style.color = channel.accent
      name.style.textShadow = `3px 3px 0 ${channel.accent2}`
      art.replaceChildren(name)
    }
  }

  function render() {
    layer(false)
    if (!visible()) { box.style.display = 'none'; return }
    box.style.display = ''
    box.style.width = `${prefs.w}px`
    box.style.setProperty('--idle', prefs.opacity)
    box.classList.toggle('resizing', resizing)
    const name = art.querySelector('span')
    if (name) name.style.fontSize = `${prefs.w / 4}px`
    const { x, y } = place()
    box.style.left = `${x}px`
    box.style.top = `${y}px`
  }

  const update = p => { prefs = { ...prefs, ...p }; render() }
  const save = () => chrome.storage.local.set({ prefs })
  const commit = p => { update(p); save() }
  const setResizing = on => { resizing = on; render() }

  /* Drag to move; in free-resize mode the corner handles resize, keeping the logo's shape. */

  function start(e, mode) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    closeMenu()
    box.setPointerCapture(e.pointerId)
    const { x, y, h } = place()
    drag = { mode, px: e.clientX, py: e.clientY, x, y, w: prefs.w, h }
    box.classList.add('dragging')
  }
  box.addEventListener('pointerdown', e => start(e, 'move'))
  box.addEventListener('pointermove', e => {
    if (!drag) return
    const d = drag, dx = e.clientX - d.px, dy = e.clientY - d.py
    if (d.mode === 'move') return update({ x: clamp(d.x + dx, 0, innerWidth - d.w), y: clamp(d.y + dy, 0, innerHeight - d.h) })
    const right = d.mode[1] === 'r', bottom = d.mode[0] === 'b'
    const w = clamp(d.w + (right ? dx : -dx), MIN_W, MAX_W)
    const h = d.h * w / d.w
    update({ w, x: right ? d.x : d.x + d.w - w, y: bottom ? d.y : d.y + d.h - h })
  })
  const end = () => { if (!drag) return; drag = null; box.classList.remove('dragging'); save() }
  box.addEventListener('pointerup', end)
  box.addEventListener('pointercancel', end)
  // Keep YouTube from treating clicks on the logo as clicks on the video (pause/play).
  for (const t of ['click', 'dblclick', 'mousedown', 'mouseup']) box.addEventListener(t, e => e.stopPropagation())

  /* Right-click menu */

  box.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); openMenu(e.clientX, e.clientY) })
  box.addEventListener('keydown', e => {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      e.stopPropagation()
      const { x, y, h } = place()
      openMenu(x + 8, y + h)
    }
  })

  function menuItems() {
    const { x, h } = place()
    const corner = k => commit({
      x: k[1] === 'l' ? EDGE : innerWidth - prefs.w - EDGE,
      y: k[0] === 't' ? TOP : innerHeight - h - EDGE,
    })
    return [
      ...SIZES.map(([label, w]) => ({ label, on: prefs.w === w, run: () => { setResizing(false); commit({ w, x: x + prefs.w - w }) } })),
      { label: resizing ? 'Done resizing' : 'Free resize…', on: resizing, run: () => setResizing(!resizing), divider: true },
      ...OPACITIES.map((o, i) => ({ label: `Opacity ${Math.round(o * 100)}%`, on: prefs.opacity === o, run: () => commit({ opacity: o }), divider: i === 0 })),
      ...CORNERS.map(([k, label], i) => ({ label: `Move to ${label.toLowerCase()}`, run: () => corner(k), divider: i === 0 })),
      { label: 'Reset', run: () => { setResizing(false); commit({ ...DEFAULTS }) }, divider: true },
      { label: 'Hide logo (toolbar button brings it back)', run: () => commit({ hidden: true }) },
    ]
  }

  function openMenu(px, py) {
    closeMenu()
    menu = shadow.appendChild(el('ul', 'menu'))
    menu.setAttribute('role', 'menu')
    menu.addEventListener('contextmenu', e => e.preventDefault())
    for (const it of menuItems()) {
      const li = menu.appendChild(el('li', it.divider ? 'divider' : ''))
      const b = li.appendChild(el('button'))
      b.setAttribute('role', 'menuitem')
      b.appendChild(Object.assign(el('span', 'check'), { textContent: it.on ? '✓' : '' }))
      b.appendChild(document.createTextNode(it.label))
      b.addEventListener('click', e => { e.stopPropagation(); closeMenu(); it.run() })
    }
    const r = menu.getBoundingClientRect()
    menu.style.left = `${clamp(px, 8, innerWidth - r.width - 8)}px`
    menu.style.top = `${clamp(py, 8, innerHeight - r.height - 8)}px`
    menu.querySelector('button').focus()
  }
  function closeMenu() { menu?.remove(); menu = null }

  // Close the menu, or leave free-resize mode, on a click elsewhere, Escape, scroll or resize.
  // Outside the closed shadow root, clicks on the logo or menu only show up as the host element.
  document.addEventListener('pointerdown', e => {
    if (e.composedPath().includes(host)) return
    closeMenu()
    if (resizing) setResizing(false)
  }, true)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (menu) closeMenu(); else if (resizing) setResizing(false)
  }, true)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)

  /* Channel, on/off and settings come from extension storage; the Streamflix tab keeps them current. */

  chrome.storage.local.get(['channel', 'prefs', 'active']).then(s => {
    channel = s.channel || null
    active = !!s.active
    prefs = { ...DEFAULTS, ...s.prefs }
    paintArt()
    render()
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes.channel) { channel = changes.channel.newValue || null; paintArt() }
    if (changes.active) { active = !!changes.active.newValue; if (!active) { closeMenu(); resizing = false } }
    if (changes.prefs && !drag) prefs = { ...DEFAULTS, ...changes.prefs.newValue }
    render()
  })
})()
