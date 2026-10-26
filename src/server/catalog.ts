import { many } from './db'
import type { CatalogData, ChannelColors, Video } from '@/lib/types'

// URL of a channel's uploaded logo; the version busts browser caches when it's replaced.
export const logoUrl = (id: string, updatedAt: Date | string | null) =>
  updatedAt ? `/api/channels/${encodeURIComponent(id)}/logo?v=${new Date(updatedAt).getTime()}` : null

interface ChannelRow {
  id: string; name: string; tagline: string; sort_order: number; colors: Partial<ChannelColors>; bumpers: string[]; hidden: boolean; logo_updated_at: Date | null
}
interface TitleRow {
  id: string; name: string; year: number | null; type: 'tv' | 'movie'; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; link: string | null; videos: Video[]; needs_review: boolean
}

// Visible channels (with their shows in play order) and every title.
export async function loadCatalog({ includeHidden = false } = {}): Promise<CatalogData> {
  const [channels, titles, links] = await Promise.all([
    many<ChannelRow>(`select id, name, tagline, sort_order, colors, bumpers, hidden, logo_updated_at from channels ${includeHidden ? '' : 'where not hidden'} order by sort_order, name`),
    many<TitleRow>('select id, name, year, type, genre, synopsis, category, maturity, image, poster, link, videos, needs_review from titles order by seq'),
    many<{ channel_id: string; title_id: string }>('select ct.channel_id, ct.title_id from channel_titles ct join channels c on c.id = ct.channel_id order by c.sort_order, ct.position, ct.title_id'),
  ])
  const visible = new Set(channels.map(c => c.id))
  const byTitle: Record<string, string[]> = {}
  const byChannel: Record<string, string[]> = {}
  for (const l of links) {
    if (!visible.has(l.channel_id)) continue
    ;(byTitle[l.title_id] ||= []).push(l.channel_id)
    ;(byChannel[l.channel_id] ||= []).push(l.title_id)
  }
  return {
    channels: channels.map(c => ({
      id: c.id, name: c.name, tagline: c.tagline, order: c.sort_order, colors: c.colors, bumpers: c.bumpers, hidden: c.hidden,
      titleIds: byChannel[c.id] || [], image: logoUrl(c.id, c.logo_updated_at),
    })),
    titles: titles.map(t => ({
      id: t.id, title: t.name, year: t.year, type: t.type, genre: t.genre, synopsis: t.synopsis, category: t.category,
      maturity: t.maturity, image: t.image, poster: t.poster, link: t.link, videos: t.videos, needsReview: t.needs_review,
      channels: byTitle[t.id] || [],
    })),
  }
}
