// Shapes shared by the server (API responses) and the app.

export type Role = 'user' | 'admin'
export type TitleType = 'tv' | 'movie'

export interface Video { url: string; title: string | null }

export type Bumper = { kind: 'youtube'; ytId: string }

export interface ChannelColors { bg: string; accent: string; accent2: string }

// A daily time block on a channel, in minutes from midnight (end may be 1440). Its shows play
// back-to-back during the block; outside every block the whole line-up plays.
export interface ScheduleBlock { start: number; end: number; titleIds: string[] }

// How one of a show's images sits in its frame. 'cover' fills the frame, zoomed (1–3) about the point x, y (0–100 %);
// 'contain' shows the whole image over a blurred copy of itself.
export interface ImageCrop { fit: 'cover' | 'contain'; zoom: number; x: number; y: number }
// The show's images: wide cards, tall cards, and the info modal background. Each has its own crop.
export type ImageKind = 'image' | 'poster' | 'backdrop'
export type ImageCrops = Partial<Record<ImageKind, ImageCrop>> // missing = fills the frame, centred

// --- /api/catalog ---

export interface RawTitle {
  id: string
  title: string
  year: number | null
  type: TitleType
  genre: string | null
  synopsis: string | null
  category: string | null
  maturity: string | null
  image: string | null
  poster: string | null
  backdrop: string | null // info modal background
  crops: ImageCrops
  link: string | null
  episodes: number // how many episode links it has; the player loads them from /api/titles/<id>/videos
  needsReview: boolean
  channels: string[]
  viewers: TitleViewers
  addedAt: string | null // when it was added after the first import (null for imported shows)
  episodesAt: string | null // when episodes were last added
}

// Profiles that pressed Play: in the last day, the last 7 days, and the 7 days before that.
export interface TitleViewers { day: number; week: number; prev: number }

export interface RawChannel {
  id: string
  name: string
  tagline: string
  order: number
  colors: Partial<ChannelColors>
  bumpers: string[] // YouTube links
  hidden: boolean
  schedule: ScheduleBlock[]
  titleIds: string[]
  top10: string[] // ranked title ids: admin picks, then most watched, then line-up order
  image: string | null // uploaded logo, served from /api/channels/<id>/logo
}

export interface CatalogData { channels: RawChannel[]; titles: RawTitle[] }

// --- /api/me ---

export interface Profile {
  id: number
  name: string
  avatarId: string | null
  avatarUrl: string | null
  color: string
  isKids: boolean
  list: string[]
  progress: Record<string, number>
  position: Record<string, WatchPosition>
  recent: string[] // title ids, most recently played first
  notifSeenAt: string // notifications after this are unread
}

export interface WatchPosition { season: number; episode: number }

// --- /api/notifications ---

export type NotificationKind = 'title' | 'episodes' | 'channel' | 'announcement'
export interface AppNotification {
  id: number; kind: NotificationKind; titleId: string | null; channelId: string | null; heading: string; body: string; createdAt: string
}

// --- /api/profiles/:id/history ---

export interface HistoryEntry { titleId: string; season: number | null; episode: number | null; playedAt: string }

export interface AccountUser {
  id: number
  email: string
  role: Role
  createdAt: string
  questions: string[]
}

export interface Me { user: AccountUser; profiles: Profile[] }

export interface Avatar { id: string; url: string; label: string; category: string }

export interface SecurityAnswer { key: string; answer: string }
