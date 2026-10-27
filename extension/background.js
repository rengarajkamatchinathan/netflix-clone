// Each open Streamflix channel page holds a port to this worker. While at least one does, every
// tab shows the logo (storage `active`); closing or leaving the last one drops it. If the worker
// is stopped, the pages reconnect, so `active` simply stays as it was.
const pages = new Set()
const sync = () => chrome.storage.local.set({ active: pages.size > 0 })

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'channel-page') return
  pages.add(port)
  sync()
  port.onDisconnect.addListener(() => { pages.delete(port); sync() })
})

// No channel page survives a browser restart.
chrome.runtime.onStartup.addListener(() => chrome.storage.local.set({ active: false }))

// The toolbar badge shows the state: ON (logo showing on other tabs), OFF (hidden by the user),
// nothing (no channel page open).
async function badge() {
  const { active, prefs = {} } = await chrome.storage.local.get(['active', 'prefs'])
  const text = !active ? '' : prefs.hidden ? 'OFF' : 'ON'
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color: prefs.hidden ? '#555' : '#e50914' })
  await chrome.action.setTitle({
    title: !active ? 'Streamflix logo: open a channel page to show it' : prefs.hidden ? 'Streamflix logo is hidden: click to show' : 'Streamflix logo is showing: click to hide',
  })
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.active || changes.prefs)) badge() })
badge()

// The toolbar button hides the logo, or brings it back after "Hide logo" in its menu.
chrome.action.onClicked.addListener(async () => {
  const { prefs = {} } = await chrome.storage.local.get('prefs')
  await chrome.storage.local.set({ prefs: { ...prefs, hidden: !prefs.hidden } })
})
