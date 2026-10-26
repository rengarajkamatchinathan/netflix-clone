// Shapes shared by the server (API responses) and the app.

export type Role = 'user' | 'admin'
export type TitleType = 'tv' | 'movie'

export interface Video { url: string; title: string | null }

export type Bumper = { kind: 'youtube'; ytId: string }

export interface ChannelColors { bg: string; accent: string; accent2: string }

// A daily time block on a channel, in minutes from midnight (end may be 1440). Its shows play
// back-to-back during the block; outside every block the whole line-up plays.
export interface ScheduleBlock { start: number; end: number; titleIds: string[] }

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
  link: string | null
  videos: Video[]
  needsReview: boolean
  channels: string[]
}

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
