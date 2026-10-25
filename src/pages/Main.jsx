import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { byId, rowsFor, search, titles } from '../data/catalog'
import { channelById, channels, channelTitles, nowPlaying } from '../data/channels'
import { Footer, Navbar, PosterArt } from '../components/ui'
import { Billboard, ChannelStrip, ChannelTile, Row, TitleCard, useBrowse } from '../components/Browse'
import { Info, Play } from '../components/icons'

const HEADINGS = { tv: 'TV Shows', movie: 'Films', new: 'New & Popular' }

export function BrowsePage() {
  const { type } = useParams()
  const { profile } = useApp()
  const rows = useMemo(() => rowsFor(type), [type])
  const top = rows.find(r => r.top10)?.items || rows[0].items
  const rank = new Date().getDate() % Math.min(top.length, 5)
  const hero = top[rank]
  const continuing = Object.entries(profile.progress).filter(([, p]) => p > 0 && p < 98).map(([id]) => byId[id]).filter(Boolean)
  const myList = profile.list.map(id => byId[id]).filter(Boolean)

  return (
    <div className="page">
      <Navbar />
      {type && <div className="sub-header"><h1>{HEADINGS[type]}</h1></div>}
      <Billboard t={hero} rank={rank + 1} />
      <div className="rows">
        {continuing.length > 0 && <Row title={`Continue Watching for ${profile.name}`} items={continuing} />}
        {!type && <ChannelStrip />}
        {rows.map((r, i) => (
          <div key={r.title}>
            <Row {...r} />
            {i === 1 && myList.length > 0 && <Row title="My List" items={myList} link="/my-list" />}
          </div>
        ))}
      </div>
      <Footer />
    </div>
  )
}

function Grid({ heading, items, empty, suggestions }) {
  return (
    <div className="page">
      <Navbar />
      <div className="grid-page">
        {heading && <h1>{heading}</h1>}
        {items.length ? <div className="grid">{items.map(t => <TitleCard key={t.id} t={t} />)}</div> : (
          <div className="empty">
            <p>{empty}</p>
            {suggestions && <ul><li>Try different keywords</li><li>Looking for a channel? Try "Jetix" or "Pogo"</li><li>Try a genre, like comedy, action or anime</li></ul>}
          </div>
        )}
      </div>
    </div>
  )
}

export function MyListPage() {
  const { profile } = useApp()
  return <Grid heading="My List" items={profile.list.map(id => byId[id]).filter(Boolean)} empty="You haven't added any titles to your list yet." />
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const res = search(q)
  return <Grid heading={res.length ? `Explore titles related to: ${q}` : ''} items={res} suggestions
    empty={`Your search for "${q}" did not have any matches.`} />
}

export function ChannelsPage() {
  return (
    <div className="page">
      <Navbar />
      <div className="grid-page">
        <h1>Channels</h1>
        <p className="muted lead">Kids TV the way you remember it. Shows play back-to-back, live.</p>
        <div className="channel-grid">
          {channels.map(c => {
            const np = nowPlaying(c.id)
            return (
              <div key={c.id} className="channel-cell">
                <ChannelTile c={c} big />
                <div className="now"><span className="live-pill"><i />NOW</span><b>{np.current.name}</b></div>
                <div className="next muted">Next: {np.next.name}</div>
              </div>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export function ChannelPage() {
  const { id } = useParams()
  const c = channelById[id]
  const nav = useNavigate()
  const { openInfo } = useBrowse()
  if (!c) return <Grid heading="Channel not found" items={[]} empty="" />
  const list = channelTitles(id)
  const np = nowPlaying(id)
  const genres = [...new Set(list.map(t => t.genre))]
  const others = titles.filter(t => t.channel && t.channel !== id)

  return (
    <div className="page channel-page" style={{ '--accent': c.accent, '--chan-bg': c.bg }}>
      <Navbar />
      <section className="channel-hero">
        <div className="channel-hero-bg" style={{ background: `radial-gradient(circle at 75% 35%, ${c.accent}55, transparent 55%), radial-gradient(circle at 20% 90%, ${c.accent2}33, transparent 50%), ${c.bg}` }} />
        <div className="channel-hero-copy">
          <h1 className="channel-name huge" style={{ color: c.accent, textShadow: `5px 5px 0 ${c.accent2}` }}>{c.name}</h1>
          <p className="channel-tag">{c.tagline}</p>
          <div className="now-box">
            <span className="live-pill"><i />LIVE NOW</span>
            <h2>{np.current.name}</h2>
            <p>Up next: <b>{np.next.name}</b> · Later: {np.later.name}</p>
          </div>
          <div className="btns">
            <button className="btn white" onClick={() => nav(`/live/${id}`)}><Play size={26} /> Watch Live</button>
            <button className="btn grey" onClick={() => openInfo(np.current)}><Info size={26} /> Show Info</button>
          </div>
        </div>
        <div className="channel-hero-art" onClick={() => nav(`/live/${id}`)}>
          <PosterArt t={np.current} />
          <span className="live-pill corner"><i />LIVE</span>
        </div>
      </section>
      <div className="rows">
        <Row title={`All on ${c.name}`} items={list} />
        <Row title={`Top 10 on ${c.name}`} items={list.slice(0, 10)} top10 />
        {genres.map(g => <Row key={g} title={g} items={list.filter(t => t.genre === g)} />)}
        <Row title="From Other Channels" items={others} link="/channels" />
      </div>
      <Footer />
    </div>
  )
}
