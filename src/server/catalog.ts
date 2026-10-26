import { many } from './db'
import { getSections } from './settings'
import type { CatalogData, ChannelColors, ScheduleBlock, Video } from '@/lib/types'

// URL of a channel's uploaded logo; the version busts browser caches when it's replaced.
export const logoUrl = (id: string, updatedAt: Date | string | null) =>
  updatedAt ? `/api/channels/${encodeURIComponent(id)}/logo?v=${new Date(updatedAt).getTime()}` : null

interface ChannelRow {
  id: string; name: string; tagline: string; sort_order: number; colors: Partial<ChannelColors>; bumpers: string[]; hidden: boolean; schedule: ScheduleBlock[]; logo_updated_at: Date | null
}
interface TitleRow {
  id: string; name: string; year: number | null; type: 'tv' | 'movie'; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; link: string | null; videos: Video[]; needs_review: boolean
}

// Visible channels (with their visible shows in play order) and every visible title not tied only to hidden
// channels or to a switched-off Series/Movies section.
export async function loadCatalog({ includeHidden = false } = {}): Promise<CatalogData> {
  const [channels, titles, links, sections] = await Promise.all([
    many<ChannelRow>(`select id, name, tagline, sort_order, colors, bumpers, hidden, schedule, logo_updated_at from channels ${includeHidden ? '' : 'where not hidden'} order by sort_order, name`),
    many<TitleRow>(`select id, name, year, type, genre, synopsis, category, maturity, image, poster, link, videos, needs_review from titles ${includeHidden ? '' : 'where not hidden and (publish_at is null or publish_at <= now())'} order by seq`),
    many<{ channel_id: string; title_id: string }>('select ct.channel_id, ct.title_id from channel_titles ct join channels c on c.id = ct.channel_id order by c.sort_order, ct.position, ct.title_id'),
    getSections(),
  ])
  const visible = new Set(channels.map(c => c.id))
  const visibleTitles = new Set(titles.map(t => t.id))
  const byTitle: Record<string, string[]> = {}
  const byChannel: Record<string, string[]> = {}
  const onAnyChannel = new Set<string>()
  for (const l of links) {
    onAnyChannel.add(l.title_id)
    if (!visible.has(l.channel_id) || !visibleTitles.has(l.title_id)) continue
    ;(byTitle[l.title_id] ||= []).push(l.channel_id)
    ;(byChannel[l.channel_id] ||= []).push(l.title_id)
  }
  // Shows that only air on hidden channels are hidden with them. Shows on no channel are the
  // Series and Movies sections, which the admin can switch off as a whole.
  const sectionOn = (t: TitleRow) => includeHidden || (t.type === 'movie' ? sections.movies : sections.series)
  const shown = titles.filter(t => byTitle[t.id] || (!onAnyChannel.has(t.id) && sectionOn(t)))
  return {
    channels: channels.map(c => ({
      id: c.id, name: c.name, tagline: c.tagline, order: c.sort_order, colors: c.colors, bumpers: c.bumpers, hidden: c.hidden,
      titleIds: byChannel[c.id] || [], image: logoUrl(c.id, c.logo_updated_at),
      // Blocks only keep shows still on the channel and visible; empty blocks drop out.
      schedule: (c.schedule || []).map(b => ({ ...b, titleIds: b.titleIds.filter(t => byChannel[c.id]?.includes(t)) })).filter(b => b.titleIds.length),
    })),
    titles: shown.map(t => ({
      id: t.id, title: t.name, year: t.year, type: t.type, genre: t.genre, synopsis: t.synopsis, category: t.category,
      maturity: t.maturity, image: t.image, poster: t.poster, link: t.link, videos: t.videos, needsReview: t.needs_review,
      channels: byTitle[t.id] || [],
    })),
  }
}
