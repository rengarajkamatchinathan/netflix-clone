// Runs on Streamflix. The page posts the channel being watched and whether a channel page is open.
// The channel goes into extension storage for the overlay on other tabs. The logo is stored as a
// data URL because https sites can't load images from the Streamflix server (http://localhost).
// While a channel page is open this holds a port to the background worker, which notices when
// the page closes even if it can't say so itself.

let port = null
let onPage = false

function connect() {
  try {
    port = chrome.runtime.connect({ name: 'channel-page' })
  } catch {
    return // the extension was reloaded or removed; this old script can't reach it any more
  }
  // The worker was stopped: reconnect while still on a channel page.
  port.onDisconnect.addListener(() => { port = null; if (onPage) setTimeout(connect, 200) })
}

function setOnPage(on) {
  onPage = on
  if (on && !port) connect()
  if (!on && port) { const p = port; port = null; p.disconnect() }
}

async function toDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function saveChannel({ id, name, bg, accent, accent2, image }) {
  const { channel: old } = await chrome.storage.local.get('channel')
  const cached = old && old.image === image && old.imageData
  if (old && old.id === id && old.image === image && (!image || cached)) return
  const imageData = !image ? null : cached || await toDataUrl(image)
  await chrome.storage.local.set({ channel: { id, name, bg, accent, accent2, image, imageData } })
}

window.addEventListener('message', e => {
  if (e.source !== window || e.origin !== location.origin) return
  const m = e.data
  if (!m || m.source !== 'streamflix') return
  if (m.type === 'channel' && m.channel) saveChannel(m.channel)
  if (m.type === 'page') setOnPage(!!m.on)
})
