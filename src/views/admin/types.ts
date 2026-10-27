// Shapes returned by the /api/admin routes.
import type { ChannelColors, ImageCrops, Role, ScheduleBlock, TitleType, Video } from '@/lib/types'

export interface AdminChannel {
  id: string
  name: string
  tagline: string
  order: number
  colors: ChannelColors
  bumpers: string[]
  hidden: boolean
  schedule: ScheduleBlock[]
  top10: string[] // admin's picks, in rank order
  image: string | null
  shows: number
}

// viewers: profiles that played it in the last 7 days (only from the channel detail route)
export interface LineupTitle { id: string; name: string; year: number | null; image: string | null; poster: string | null; episodes: number; viewers?: number }

export interface ChannelDetail extends Omit<AdminChannel, 'shows'> { titles: LineupTitle[] }

export interface AdminTitleRow {
  id: string; name: string; year: number | null; type: TitleType; image: string | null; poster: string | null
  category: string | null; hidden: boolean; publishAt: string | null; episodes: number; channels: string[]
}

export interface TitleDetail {
  id: string; name: string; year: number | null; type: TitleType; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; backdrop: string | null; crops: ImageCrops; link: string | null; videos: Video[]
  hidden: boolean; publishAt: string | null; channels: string[]
  impact: { lists: number; progress: number }
}

export interface AdminUserRow {
  id: number; email: string; role: Role; disabled: boolean; locked: boolean; created_at: string; last_login_at: string | null; profiles: number
}

export interface AdminUserDetail extends Omit<AdminUserRow, 'profiles'> {
  profiles: { id: number; name: string; color: string; is_kids: boolean; avatar_url: string | null; list: number }[]
  activity: { title_id: string; title: string; pct: number; updated_at: string; profile: string }[]
}

export interface AdminAvatar { id: string; url: string; label: string; category: string; sort_order: number; used: number }

export interface Stats {
  counts: { users: number; newUsers: number; profiles: number; titles: number; channels: number; avatars: number; plays7d: number }
  recent: { id: number; email: string; created_at: string; profiles: number }[]
  popular: { id: string; name: string; viewers: number; plays: number }[]
}
