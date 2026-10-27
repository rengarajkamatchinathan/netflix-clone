import { revalidateTag, unstable_cache } from 'next/cache'
import { channelTop10 } from '@/lib/ids'
import { many } from './db'
import { getSections } from './settings'
import type { CatalogData, ChannelColors, ImageCrops, ScheduleBlock, TitleViewers, Video } from '@/lib/types'

// The catalog is the same for every viewer, so it is cached between requests. Admin edits clear it
// straight away (catalogChanged); otherwise it refreshes every minute, which is how quickly viewer
// counts and scheduled shows show up.
const CATALOG_TAG = 'catalog'
export const catalogChanged = () => revalidateTag(CATALOG_TAG, { expire: 0 })

// URL of a channel's uploaded logo; the version busts browser caches when it's replaced.
export const logoUrl = (id: string, updatedAt: Date | string | null) =>
  updatedAt ? `/api/channels/${encodeURIComponent(id)}/logo?v=${new Date(updatedAt).getTime()}` : null

interface ChannelRow {
  id: string; name: string; tagline: string; sort_order: number; colors: Partial<ChannelColors>; bumpers: string[]; hidden: boolean; schedule: ScheduleBlock[]; top10: string[]; logo_updated_at: Date | null
}

// Profiles that played each title (pressed Play) in the last day, the last 7 days and the 7 days before that.
async function titleViewers(): Promise<Record<string, TitleViewers>> {
  const rows = await many<TitleViewers & { title_id: string }>(`select title_id,
      count(distinct profile_id) filter (where played_at > now() - interval '1 day')::int as day,
      count(distinct profile_id) filter (where played_at > now() - interval '7 days')::int as week,
      count(distinct profile_id) filter (where played_at <= now() - interval '7 days')::int as prev
    from play_events where played_at > now() - interval '14 days' group by title_id`)
  return Object.fromEntries(rows.map(({ title_id, ...v }) => [title_id, v]))
}

// Profiles that played each title in the last 7 days, for Top 10 rows.
export async function weeklyViewers(): Promise<Record<string, number>> {
  return Object.fromEntries(Object.entries(await titleViewers()).map(([id, v]) => [id, v.week]))
}

interface TitleRow {
  id: string; name: string; year: number | null; type: 'tv' | 'movie'; genre: string | null; synopsis: string | null; category: string | null
  maturity: string | null; image: string | null; poster: string | null; backdrop: string | null; crops: ImageCrops | null; link: string | null; episodes: number
  needs_review: boolean; added_at: Date | null; episodes_at: Date | null
}

// When a show was added: its publish time, or when it was created. Shows from the first import
// (created within a day of the very first one) count as never added, so they don't fill New Releases.
const ADDED_AT = `case when publish_at is not null or created_at > (select min(created_at) from titles) + interval '1 day'
  then coalesce(publish_at, created_at) end as added_at`
// Last time episodes were added (the "New episodes" notification), one grouped pass over notifications.
const EPISODES_AT = `left join (select title_id, max(created_at) as episodes_at from notifications where kind = 'episodes' group by title_id) ep
  on ep.title_id = titles.id`
// Titles viewers may see right now.
const isVisible = (t = '') => `not ${t}hidden and (${t}publish_at is null or ${t}publish_at <= now())`

// Visible channels (with their visible shows in play order) and every visible title not tied only to hidden
// channels or to a switched-off Series/Movies section. Episode links are left out (only their count is
// sent); the player loads them with titleVideos / channelVideos.
async function queryCatalog(): Promise<CatalogData> {
  const [channels, titles, links, sections, viewers] = await Promise.all([
    many<ChannelRow>('select id, name, tagline, sort_order, colors, bumpers, hidden, schedule, top10, logo_updated_at from channels where not hidden order by sort_order, name'),
    many<TitleRow>(`select id, name, year, type, genre, synopsis, category, maturity, image, poster, backdrop, crops, link,
      jsonb_array_length(videos)::int as episodes, needs_review, ${ADDED_AT}, episodes_at
      from titles ${EPISODES_AT} where ${isVisible()} order by seq`),
    many<{ channel_id: string; title_id: string }>('select ct.channel_id, ct.title_id from channel_titles ct join channels c on c.id = ct.channel_id order by c.sort_order, ct.position, ct.title_id'),
    getSections(),
    titleViewers(),
  ])
  const weekly = Object.fromEntries(Object.entries(viewers).map(([id, v]) => [id, v.week]))
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
  const sectionOn = (t: TitleRow) => (t.type === 'movie' ? sections.movies : sections.series)
  const shown = titles.filter(t => byTitle[t.id] || (!onAnyChannel.has(t.id) && sectionOn(t)))
  return {
    channels: channels.map(c => ({
      id: c.id, name: c.name, tagline: c.tagline, order: c.sort_order, colors: c.colors, bumpers: c.bumpers, hidden: c.hidden,
      titleIds: byChannel[c.id] || [], image: logoUrl(c.id, c.logo_updated_at), top10: channelTop10(c.top10 || [], byChannel[c.id] || [], weekly),
      // Blocks only keep shows still on the channel and visible; empty blocks drop out.
      schedule: (c.schedule || []).map(b => ({ ...b, titleIds: b.titleIds.filter(t => byChannel[c.id]?.includes(t)) })).filter(b => b.titleIds.length),
    })),
    titles: shown.map(t => ({
      id: t.id, title: t.name, year: t.year, type: t.type, genre: t.genre, synopsis: t.synopsis, category: t.category,
      maturity: t.maturity, image: t.image, poster: t.poster, backdrop: t.backdrop, crops: t.crops ?? {}, link: t.link, episodes: t.episodes, needsReview: t.needs_review,
      channels: byTitle[t.id] || [],
      viewers: viewers[t.id] || { day: 0, week: 0, prev: 0 },
      addedAt: t.added_at?.toISOString() ?? null, episodesAt: t.episodes_at?.toISOString() ?? null,
    })),
  }
}

export const loadCatalog = unstable_cache(queryCatalog, ['catalog'], { tags: [CATALOG_TAG], revalidate: 60 })

// Episode links of one visible title, for the built-in player.
export const titleVideos = unstable_cache(async (id: string): Promise<Video[] | null> => {
  const [row] = await many<{ videos: Video[] }>(`select videos from titles where id = $1 and ${isVisible()}`, [id])
  return row ? row.videos : null
}, ['title-videos'], { tags: [CATALOG_TAG], revalidate: 300 })

// Episode links of every visible title on a channel, for the live player.
export const channelVideos = unstable_cache(async (id: string): Promise<Record<string, Video[]>> => {
  const rows = await many<{ id: string; videos: Video[] }>(`select t.id, t.videos from channel_titles ct join titles t on t.id = ct.title_id
    where ct.channel_id = $1 and ${isVisible('t.')}`, [id])
  return Object.fromEntries(rows.map(r => [r.id, r.videos]))
}, ['channel-videos'], { tags: [CATALOG_TAG], revalidate: 300 })
