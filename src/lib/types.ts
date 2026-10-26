// Shapes shared by the server (API responses) and the app.

export type Role = 'user' | 'admin'
export type TitleType = 'tv' | 'movie'

export interface Video { url: string; title: string | null }

export type Bumper = { kind: 'youtube'; ytId: string }

export interface ChannelColors { bg: string; accent: string; accent2: string }

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
}

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
