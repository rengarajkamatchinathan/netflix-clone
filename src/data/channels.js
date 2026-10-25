import { titles } from './catalog'

// Channel styling is original (no real channel logos); rename/recolour freely.
export const channels = [
  { id: 'jetix', name: 'Jetix', tagline: 'Non-stop action', bg: '#0b0b0b', accent: '#ff3d00', accent2: '#ffd600' },
  { id: 'pogo', name: 'Pogo', tagline: 'Fun all day', bg: '#1a0b2e', accent: '#ff2e93', accent2: '#29e3ff' },
  { id: 'toonz', name: 'Toon Zone', tagline: 'Classic cartoons', bg: '#111111', accent: '#ffffff', accent2: '#00c2ff' },
  { id: 'otaku', name: 'Otaku TV', tagline: 'Anime universe', bg: '#0a1530', accent: '#ff8a00', accent2: '#7c4dff' },
  { id: 'retro', name: 'Retro TV', tagline: 'Saturday mornings forever', bg: '#2b1600', accent: '#ffb300', accent2: '#ff5252' },
]

export const channelById = Object.fromEntries(channels.map(c => [c.id, c]))
export const channelTitles = id => titles.filter(t => t.channel === id)

// Fake 24h schedule: 22-minute slots cycling through the channel's shows.
export const SLOT_MIN = 22
export function nowPlaying(id, now = new Date()) {
  const list = channelTitles(id)
  const mins = now.getHours() * 60 + now.getMinutes()
  const slot = Math.floor(mins / SLOT_MIN)
  const at = k => list[(slot + k) % list.length]
  return { current: at(0), next: at(1), later: at(2), offsetSec: (mins % SLOT_MIN) * 60 + now.getSeconds() }
}
