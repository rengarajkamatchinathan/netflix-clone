'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { slug, youtubeId } from '@/lib/ids'
import type { ChannelColors } from '@/lib/types'
import { useReloadCatalog } from '@/context/CatalogContext'
import { Plus, Search, Trash } from '@/components/icons'
import { Check, ColorField, ConfirmDelete, errorMessage, Loading, Modal, SortableList, TextField, Thumb, useApi, useToast } from './kit'
import { ShowModal } from './Shows'
import type { AdminChannel, AdminTitleRow, ChannelDetail, LineupTitle, TitleDetail } from './types'

const DEFAULT_COLORS: ChannelColors = { bg: '#141414', accent: '#e50914', accent2: '#ffffff' }
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
const MAX_LOGO_BYTES = 2 * 1024 * 1024
let keySeq = 0

const DAY = 24 * 60
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
// An end time of 00:00 means midnight at the end of the day.
const toEndMin = (t: string) => toMin(t) || DAY

// Same rules as the server: real times, end after start, at least one show, no overlaps.
function scheduleError(blocks: BlockRow[]): string {
  const list = blocks.map(b => ({ ...b, s: b.start ? toMin(b.start) : NaN, e: b.end ? toEndMin(b.end) : NaN })).sort((a, b) => a.s - b.s)
  for (const [i, b] of list.entries()) {
    if (isNaN(b.s) || isNaN(b.e)) return 'Give every time block a start and end time.'
    if (b.e <= b.s) return `The ${b.start} block must end after it starts.`
    if (!b.titleIds.length) return `Add at least one show to the ${b.start} block.`
    if (i && b.s < list[i - 1].e) return `The ${list[i - 1].start} and ${b.start} blocks overlap.`
  }
  return ''
}

// A 24-hour strip showing where the blocks fall in the day.
function DayBar({ blocks, color }: { blocks: BlockRow[]; color: string }) {
  return (
    <div className="adm-daybar" aria-hidden>
      {blocks.filter(b => b.start && b.end && toEndMin(b.end) > toMin(b.start)).map(b => (
        <span key={b.key} style={{ left: `${(toMin(b.start) / DAY) * 100}%`, width: `${((toEndMin(b.end) - toMin(b.start)) / DAY) * 100}%`, background: color }} title={`${b.start}–${b.end}`} />
      ))}
      {[0, 6, 12, 18, 24].map(h => <i key={h} style={{ left: `${(h / 24) * 100}%` }}>{h === 24 ? '' : `${String(h).padStart(2, '0')}:00`}</i>)}
    </div>
  )
}

interface BumperRow { key: number; url: string }
// A daily time block being edited; times are "HH:MM" as the time inputs use them.
interface BlockRow { key: number; start: string; end: string; titleIds: string[] }
interface ChannelForm {
  slug: string; slugTouched?: boolean; name: string; tagline: string; hidden: boolean; colors: ChannelColors
  bumpers: BumperRow[]; lineup: LineupTitle[]; image: string | null; schedule: BlockRow[]
}
// A logo picked but not saved yet, or a saved logo marked for removal.
type PendingLogo = { file: File; preview: string } | 'remove' | null

async function uploadLogo(id: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`/api/admin/channels/${encodeURIComponent(id)}/logo`, { method: 'PUT', body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'The logo could not be uploaded. Try again.')
}

function ChannelArt({ c, big }: { c: { name: string; colors: ChannelColors; image?: string | null }; big?: boolean }) {
  return (
    <div className={`adm-ch-art ${big ? 'big' : ''}`} style={{ background: c.colors.bg, color: c.colors.accent }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.image ? <img src={c.image} alt="" /> : <span style={{ textShadow: `2px 2px 0 ${c.colors.accent2}` }}>{c.name || 'Channel'}</span>}
    </div>
  )
}

function ChannelModal({ id, shows, channels, onClose, onChanged }: {
  id: string | null; shows: AdminTitleRow[]; channels: AdminChannel[]; onClose: () => void; onChanged: () => void
}) {
  const toast = useToast()
  const reloadCatalog = useReloadCatalog()
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState<ChannelForm | null>(null)
  const [saved, setSaved] = useState<ChannelForm | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [newBumper, setNewBumper] = useState('')
  const [editShow, setEditShow] = useState<{ id: string | null; initial?: { name: string; channels: string[] } } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [logo, setLogo] = useState<PendingLogo>(null)
  useEffect(() => () => { if (logo && logo !== 'remove') URL.revokeObjectURL(logo.preview) }, [logo])

  useEffect(() => {
    if (!id) {
      const f: ChannelForm = { slug: '', name: '', tagline: '', hidden: false, colors: DEFAULT_COLORS, bumpers: [], lineup: [], image: null, schedule: [] }
      setForm(f); setSaved(f); return
    }
    api<ChannelDetail>(`/admin/channels/${id}`).then(c => {
      const f: ChannelForm = {
        slug: c.id, name: c.name, tagline: c.tagline, hidden: c.hidden, colors: { ...DEFAULT_COLORS, ...c.colors },
        bumpers: c.bumpers.map(url => ({ key: ++keySeq, url })), lineup: c.titles, image: c.image,
        schedule: (c.schedule || []).map(b => ({ key: ++keySeq, start: toTime(b.start), end: toTime(b.end), titleIds: b.titleIds })),
      }
      setForm(f); setSaved(f)
    }, e => setErr(errorMessage(e)))
  }, [id])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s || !form) return []
    const inLineup = new Set(form.lineup.map(t => t.id))
    return shows.filter(t => !inLineup.has(t.id) && t.name.toLowerCase().includes(s)).slice(0, 8)
  }, [q, shows, form])

  if (!form || !saved) return <Modal title="Loading channel…" onClose={onClose}><Loading error={err} /></Modal>

  const set = (patch: Partial<ChannelForm>) => setForm(f => f && { ...f, ...patch })
  const details = (f: ChannelForm) => JSON.stringify([f.slug, f.name, f.tagline, f.hidden, f.colors, f.bumpers.map(b => b.url), f.schedule.map(b => [b.start, b.end, b.titleIds])])
  const lineupIds = (f: ChannelForm) => JSON.stringify(f.lineup.map(t => t.id))
  const detailsChanged = details(form) !== details(saved)
  const lineupChanged = lineupIds(form) !== lineupIds(saved)
  const dirty = detailsChanged || lineupChanged || logo !== null
  const shownLogo = logo === 'remove' ? null : logo ? logo.preview : form.image
  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return setErr('Logos must be PNG, JPG, WebP, GIF, AVIF or SVG images.')
    if (file.size > MAX_LOGO_BYTES) return setErr('Logos must be 2 MB or smaller.')
    setErr(''); setLogo({ file, preview: URL.createObjectURL(file) })
  }
  const chName = (cid: string) => channels.find(c => c.id === cid)?.name || cid
  const badBumper = form.bumpers.find(b => !youtubeId(b.url))

  const addShow = (t: LineupTitle) => { set({ lineup: [...form.lineup, t] }); setQ('') }
  const addBumper = (e?: FormEvent) => {
    e?.preventDefault()
    const url = newBumper.trim()
    if (!url) return
    if (!youtubeId(url)) return setErr(`"${url}" isn't a YouTube link.`)
    setErr(''); set({ bumpers: [...form.bumpers, { key: ++keySeq, url }] }); setNewBumper('')
  }

  // Blocks only keep shows still in the line-up.
  const inLineup = new Set(form.lineup.map(t => t.id))
  const blocks = form.schedule.map(b => ({ ...b, titleIds: b.titleIds.filter(t => inLineup.has(t)) }))
  const setBlock = (key: number, patch: Partial<BlockRow>) => set({ schedule: form.schedule.map(b => (b.key === key ? { ...b, ...patch } : b)) })
  const addBlock = () => {
    const last = Math.max(0, ...blocks.filter(b => b.end).map(b => toEndMin(b.end)))
    const start = blocks.length ? (last >= DAY ? 0 : last) : 7 * 60
    set({ schedule: [...form.schedule, { key: ++keySeq, start: toTime(start), end: toTime(Math.min(start + 120, DAY)), titleIds: [] }] })
  }

  const save = async () => {
    if (!form.name.trim()) { setTab('details'); return setErr('Enter a channel name.') }
    if (badBumper) { setTab('bumpers'); return setErr(`"${badBumper.url}" isn't a YouTube link.`) }
    const badSchedule = scheduleError(blocks)
    if (badSchedule) { setTab('schedule'); return setErr(badSchedule) }
    setBusy(true); setErr('')
    const body = {
      name: form.name, tagline: form.tagline, hidden: form.hidden, colors: form.colors, bumpers: form.bumpers.map(b => b.url),
      schedule: blocks.map(b => ({ start: toMin(b.start), end: toEndMin(b.end), titleIds: b.titleIds })),
    }
    try {
      let cid = id
      if (!cid) cid = (await api<{ id: string }>('/admin/channels', { method: 'POST', body: { ...body, id: form.slug || form.name } })).id
      else if (detailsChanged) await api(`/admin/channels/${cid}`, { method: 'PUT', body })
      if (lineupChanged) await api(`/admin/channels/${cid}/titles`, { method: 'PUT', body: { ids: form.lineup.map(t => t.id) } })
      if (logo === 'remove') await api(`/admin/channels/${cid}/logo`, { method: 'DELETE' })
      else if (logo) await uploadLogo(cid, logo.file)
      await reloadCatalog()
      toast(`${form.name.trim()} saved`)
      onChanged()
      onClose()
    } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }

  // A show edited from here: refresh its row; a new one joins the line-up.
  const showSaved = (t: TitleDetail) => {
    const row: LineupTitle = { id: t.id, name: t.name, year: t.year, image: t.image, poster: t.poster, episodes: t.videos.length }
    const patch = (list: LineupTitle[]) => (list.some(x => x.id === t.id) ? list.map(x => (x.id === t.id ? row : x)) : [...list, row])
    const onThis = !!id && t.channels.includes(id)
    setForm(f => f && { ...f, lineup: onThis || !id ? patch(f.lineup) : f.lineup.filter(x => x.id !== t.id) })
    setSaved(s => s && { ...s, lineup: onThis ? patch(s.lineup) : s.lineup.filter(x => x.id !== t.id) })
    onChanged()
  }
  const showDeleted = (tid: string) => {
    setForm(f => f && { ...f, lineup: f.lineup.filter(x => x.id !== tid) })
    setSaved(s => s && { ...s, lineup: s.lineup.filter(x => x.id !== tid) })
    onChanged()
  }

  return (
    <>
      <Modal title={id ? `Edit channel · ${saved.name}` : 'New channel'} onClose={onClose} dirty={dirty} wide
        tabs={[['details', 'Details'], ['shows', `Shows (${form.lineup.length})`], ['schedule', `Schedule (${form.schedule.length})`], ['bumpers', `Bumpers (${form.bumpers.length})`]]}
        tab={tab} onTab={setTab}
        footer={<>
          {id && <button className="adm-btn danger" onClick={() => setDeleting(true)}><Trash size={16} /> Delete channel</button>}
          {tab === 'shows' && <span className="adm-muted small">Remove takes a show off this channel only.</span>}
          <span className="grow" />
          <button className="adm-btn" onClick={onClose}>Cancel</button>
          <button className="adm-btn primary" disabled={busy || (!!id && !dirty)} onClick={save}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create channel'}</button>
        </>}>
        {err && <div className="adm-error">{err}</div>}

        {tab === 'details' && (
          <div className="adm-cols">
            <div className="adm-stack">
              <div className="adm-row2">
                <TextField label="Name" value={form.name} onChange={v => set({ name: v, ...(!id && !form.slugTouched ? { slug: slug(v) } : {}) })} maxLength={60} autoFocus={!id} />
                <TextField label="URL slug" value={form.slug} disabled={!!id} onChange={v => set({ slug: slug(v), slugTouched: true })}
                  hint={id ? `Fixed once created, so links like /channel/${id} keep working.` : `Used in links: /channel/${form.slug || '…'}`} />
              </div>
              <TextField label="Tagline" value={form.tagline} onChange={v => set({ tagline: v })} maxLength={120} placeholder="Fun all day" />
              <Check label="Shown to viewers" hint="Hidden channels stay saved but don't appear on the Channels page." checked={!form.hidden} onChange={v => set({ hidden: !v })} />
              <div className="adm-row3">
                <ColorField label="Background" value={form.colors.bg} onChange={v => set({ colors: { ...form.colors, bg: v } })} />
                <ColorField label="Accent" value={form.colors.accent} onChange={v => set({ colors: { ...form.colors, accent: v } })} />
                <ColorField label="Accent 2" value={form.colors.accent2} onChange={v => set({ colors: { ...form.colors, accent2: v } })} />
              </div>
              <div className="adm-field">
                <label htmlFor="channel-logo">Logo</label>
                <div className="adm-actions">
                  <label className="adm-btn" htmlFor="channel-logo">{shownLogo ? 'Replace logo' : 'Upload logo'}</label>
                  <input id="channel-logo" className="adm-file" type="file" accept={LOGO_TYPES.join(',')} onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = '' }} />
                  {shownLogo && <button type="button" className="adm-btn danger" onClick={() => setLogo(form.image ? 'remove' : null)}>Remove logo</button>}
                  {logo && <button type="button" className="adm-btn" onClick={() => setLogo(null)}>Undo</button>}
                </div>
                <small>{logo === 'remove' ? 'The logo will be removed when you save.' : logo ? `${logo.file.name}, saved when you save the channel.` : 'PNG, JPG, WebP, GIF, AVIF or SVG, up to 2 MB. Without a logo, the name is shown in the accent colour.'}</small>
              </div>
            </div>
            <div className="adm-preview">
              <span className="adm-label">Preview</span>
              <div className="adm-ch-card"><ChannelArt c={{ ...form, image: shownLogo }} big /><div className="adm-ch-meta"><b>{form.name || 'Channel name'}</b><small>{form.tagline || 'Tagline'}</small></div></div>
            </div>
          </div>
        )}

        {tab === 'shows' && (
          <div className="adm-stack">
            <div className="adm-combo" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setComboOpen(false) }}>
              <label className="adm-search"><Search size={16} /><input placeholder="Add a show: search by title" value={q} aria-label="Search shows to add"
                onChange={e => { setQ(e.target.value); setComboOpen(true) }} onFocus={() => setComboOpen(true)}
                onKeyDown={e => { if (e.key === 'Escape' && comboOpen && q) { e.stopPropagation(); setComboOpen(false) } }} /></label>
              {comboOpen && q.trim() && (
                <div className="adm-combo-list">
                  {results.map(t => (
                    <button key={t.id} type="button" onClick={() => addShow({ id: t.id, name: t.name, year: t.year, image: t.image, poster: t.poster, episodes: t.episodes })}>
                      <Thumb t={t} /> <span>{t.name}</span><small>{t.channels.length ? `on ${t.channels.map(chName).join(', ')}` : 'not on any channel'}</small>
                    </button>
                  ))}
                  <button type="button" className="create" onClick={() => { setEditShow({ id: null, initial: { name: q.trim(), channels: id ? [id] : [] } }); setQ('') }}>
                    <Plus size={16} /> Create new show “{q.trim()}”
                  </button>
                </div>
              )}
            </div>
            {form.lineup.length ? <>
              <p className="adm-muted">Drag to set the order shows play on the live channel.</p>
              <SortableList items={form.lineup} getKey={t => t.id} onChange={lineup => set({ lineup })} render={t => (
                <div className="adm-lineup-row">
                  <Thumb t={t} />
                  <span className="adm-show-main"><b>{t.name}</b><small>{[t.year, `${t.episodes} episode${t.episodes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</small></span>
                  <button type="button" className="adm-btn small" onClick={() => setEditShow({ id: t.id })}>Edit</button>
                  <button type="button" className="adm-btn small" onClick={() => set({ lineup: form.lineup.filter(x => x.id !== t.id) })}>Remove</button>
                </div>
              )} />
            </> : <p className="adm-empty">No shows yet. Search above to add some. A channel with no shows isn&apos;t shown to viewers.</p>}
          </div>
        )}

        {tab === 'schedule' && (
          <div className="adm-stack">
            <p className="adm-muted">Choose shows for times of day. During a block its shows play back-to-back, every day, in each viewer&apos;s local time. At any other time the whole line-up plays in order.</p>
            <DayBar blocks={blocks} color={form.colors.accent} />
            {!form.lineup.length ? <p className="adm-empty">Add shows on the Shows tab first.</p> : <>
              {blocks.map(b => {
                const free = form.lineup.filter(t => !b.titleIds.includes(t.id))
                const name = (tid: string) => form.lineup.find(t => t.id === tid)?.name || tid
                return (
                  <div key={b.key} className="adm-block">
                    <div className="adm-block-head">
                      <label>From <input type="time" value={b.start} onChange={e => setBlock(b.key, { start: e.target.value })} /></label>
                      <label>to <input type="time" value={b.end} onChange={e => setBlock(b.key, { end: e.target.value })} /></label>
                      <span className="grow" />
                      <button type="button" className="adm-icon" aria-label={`Remove the ${b.start} block`} onClick={() => set({ schedule: form.schedule.filter(x => x.key !== b.key) })}><Trash size={16} /></button>
                    </div>
                    <div className="adm-chips">
                      {b.titleIds.map(tid => (
                        <span key={tid} className="adm-chip">{name(tid)}<button type="button" aria-label={`Remove ${name(tid)}`} onClick={() => setBlock(b.key, { titleIds: b.titleIds.filter(x => x !== tid) })}>✕</button></span>
                      ))}
                      {free.length > 0 && (
                        <select className="adm-chip-add" value="" aria-label="Add a show to this block" onChange={e => { if (e.target.value) setBlock(b.key, { titleIds: [...b.titleIds, e.target.value] }) }}>
                          <option value="">+ Add show</option>
                          {free.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                    </div>
                    {!b.titleIds.length && <small className="adm-err-text">Add at least one show.</small>}
                  </div>
                )
              })}
              <button type="button" className="adm-btn" onClick={addBlock}><Plus size={16} /> Add time block</button>
            </>}
          </div>
        )}

        {tab === 'bumpers' && (
          <div className="adm-stack">
            <p className="adm-muted">One bumper plays when someone tunes in and between shows, picked at random.</p>
            <form className="adm-inline" onSubmit={addBumper}>
              <TextField label="Add a YouTube link" value={newBumper} onChange={setNewBumper} placeholder="https://youtu.be/…" />
              <button className="adm-btn" type="submit"><Plus size={16} /> Add</button>
            </form>
            {form.bumpers.length > 0 && (
              <ul className="adm-plain-list">
                {form.bumpers.map(b => (
                  <li key={b.key}>
                    <a href={b.url} target="_blank" rel="noreferrer">{b.url}</a>
                    {!youtubeId(b.url) && <span className="adm-pill warn">Not a YouTube link</span>}
                    <button type="button" className="adm-icon" aria-label="Remove bumper" onClick={() => set({ bumpers: form.bumpers.filter(x => x.key !== b.key) })}><Trash size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {editShow && (
        <ShowModal key={editShow.id || 'new'} id={editShow.id} initial={editShow.initial} channels={channels}
          onClose={() => setEditShow(null)} onSaved={showSaved} onDeleted={showDeleted} />
      )}
      {deleting && id && (
        <ConfirmDelete title={`Delete ${saved.name}?`} expected={saved.name} what="channel name" onClose={() => setDeleting(false)}
          onConfirm={async confirm => {
            await api(`/admin/channels/${id}`, { method: 'DELETE', body: { confirm } })
            await reloadCatalog()
            toast(`${saved.name} deleted`)
            onChanged()
            onClose()
          }}>
          The channel and its line-up of {saved.lineup.length} show{saved.lineup.length === 1 ? '' : 's'} will be removed. The shows themselves are kept. 
        </ConfirmDelete>
      )}
    </>
  )
}

export function ChannelsPage() {
  const toast = useToast()
  const reloadCatalog = useReloadCatalog()
  const chans = useApi<AdminChannel[]>('/admin/channels')
  const shows = useApi<AdminTitleRow[]>('/admin/titles')
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const editing = params.get('edit')
  const creating = params.get('new') !== null

  if (!chans.data || !shows.data) return <Loading error={chans.error || shows.error} onRetry={() => { chans.reload(); shows.reload() }} />

  const reorder = async (list: AdminChannel[]) => {
    const prev = chans.data
    chans.setData(list)
    try {
      await api('/admin/channels/reorder', { method: 'POST', body: { ids: list.map(c => c.id) } })
      await reloadCatalog()
      toast('Channel order saved')
    } catch (e) { if (prev) chans.setData(prev); toast(errorMessage(e), 'bad') }
  }
  const open = (query: string) => router.push(`${pathname}?${query}`, { scroll: false })

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Channels</h1>
        <button className="adm-btn primary" onClick={() => open('new')}><Plus size={16} /> New channel</button>
      </div>
      <p className="adm-muted">Drag cards, or use the arrows, to change the order on the Channels page.</p>
      <SortableList className="adm-sortable adm-ch-grid" items={chans.data} getKey={c => c.id} onChange={reorder} render={c => (
        <div className="adm-ch-card">
          <ChannelArt c={c} />
          <div className="adm-ch-meta">
            <b>{c.name}</b>
            <small>{c.shows} show{c.shows === 1 ? '' : 's'} · {c.bumpers.length} YouTube bumper{c.bumpers.length === 1 ? '' : 's'}</small>
            {c.hidden && <span className="adm-pill">Hidden</span>}
            {!c.hidden && !c.shows && <span className="adm-pill warn">No shows, not shown</span>}
            <div className="adm-actions">
              <button className="adm-btn small primary" onClick={() => open(`edit=${encodeURIComponent(c.id)}`)}>Edit</button>
              {!c.hidden && c.shows > 0 && <Link className="adm-btn small" href={`/live/${c.id}`}>View live ↗</Link>}
            </div>
          </div>
        </div>
      )} />
      {(editing || creating) && (
        <ChannelModal key={editing || 'new'} id={editing} shows={shows.data} channels={chans.data}
          onClose={() => router.replace(pathname, { scroll: false })} onChanged={() => { chans.reload(); shows.reload() }} />
      )}
    </div>
  )
}
