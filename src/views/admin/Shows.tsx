'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { DEFAULT_CROP, toCrop } from '@/lib/ids'
import type { ImageCrop, ImageCrops, ImageKind, TitleType } from '@/lib/types'
import { useReloadCatalog } from '@/context/CatalogContext'
import { Plus, Search, Trash } from '@/components/icons'
import { PosterImg } from '@/components/ui'
import { Check, ConfirmDelete, errorMessage, Loading, Modal, SelectField, SortableList, TextField, Thumb, useApi, useToast } from './kit'
import type { AdminChannel, AdminTitleRow, TitleDetail } from './types'

interface EpisodeRow { key: number; title: string; url: string }
interface ShowForm {
  name: string; year: string; type: TitleType; genre: string; synopsis: string; category: string; maturity: string
  image: string; poster: string; backdrop: string; crops: Record<ImageKind, ImageCrop>; link: string; videos: EpisodeRow[]; channels: string[]
  hidden: boolean; publishAt: string
}

const formCrops = (c: ImageCrops = {}) => ({ image: c.image || DEFAULT_CROP, poster: c.poster || DEFAULT_CROP, backdrop: c.backdrop || DEFAULT_CROP })
const EMPTY: ShowForm = {
  name: '', year: '', type: 'tv', genre: '', synopsis: '', category: '', maturity: '', image: '', poster: '', backdrop: '', crops: formCrops(), link: '', videos: [],
  channels: [], hidden: false, publishAt: '',
}
let rowSeq = 0
const withKeys = (videos: { title: string | null; url: string }[]): EpisodeRow[] => videos.map(v => ({ title: v.title || '', url: v.url, key: ++rowSeq }))

// "YYYY-MM-DDTHH:MM" in local time, as datetime-local inputs use it.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const isScheduled = (iso: string | null) => !!iso && new Date(iso) > new Date()
const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const toForm = (t: TitleDetail): ShowForm => ({
  name: t.name, year: t.year == null ? '' : String(t.year), type: t.type, genre: t.genre || '', synopsis: t.synopsis || '', category: t.category || '',
  maturity: t.maturity || '', image: t.image || '', poster: t.poster || '', backdrop: t.backdrop || '', crops: formCrops(t.crops), link: t.link || '', videos: withKeys(t.videos || []), channels: t.channels, hidden: t.hidden, publishAt: toLocalInput(t.publishAt),
})

type ImageStatusValue = 'none' | 'checking' | 'ok' | 'broken'

// Checks that an image link actually loads, for the preview under the field.
function useImageStatus(url: string | undefined): ImageStatusValue {
  const [status, setStatus] = useState<ImageStatusValue>('none')
  useEffect(() => {
    if (!url) return setStatus('none')
    setStatus('checking')
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => setStatus('ok')
    img.onerror = () => setStatus('broken')
    img.src = url
    return () => { img.onload = img.onerror = null }
  }, [url])
  return status
}

function ImageStatus({ status }: { status: ImageStatusValue }) {
  if (status === 'ok') return <small className="adm-ok-text">✓ Image loads</small>
  if (status === 'broken') return <small className="adm-err-text">This image doesn&apos;t load. Check the link.</small>
  if (status === 'checking') return <small>Checking image…</small>
  return null
}

const pct = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10
// The crop after dragging the image by dx, dy px; ox, oy are how far the zoomed image overflows the card.
const dragged = (c: ImageCrop, dx: number, dy: number, ox: number, oy: number): ImageCrop =>
  ({ ...c, x: ox > 0 ? pct(c.x - dx / ox * 100) : c.x, y: oy > 0 ? pct(c.y - dy / oy * 100) : c.y })

// One image's crop, drawn exactly as viewers see it (16:9, or 2:3 when tall). Drag the image (or use
// the arrow keys) to choose what it shows, zoom in, or switch to the whole image.
function CropEditor({ src, label, tall, crop, onChange }: { src: string; label: string; tall?: boolean; crop: ImageCrop; onChange: (c: ImageCrop) => void }) {
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; from: ImageCrop } | null>(null)
  const fill = crop.fit === 'cover'

  const overflow = () => {
    const el = frame.current!, img = el.querySelector<HTMLImageElement>('.poster-img')
    if (!img?.naturalWidth) return { ox: 0, oy: 0 }
    const s = Math.max(el.clientWidth / img.naturalWidth, el.clientHeight / img.naturalHeight) * crop.zoom
    return { ox: img.naturalWidth * s - el.clientWidth, oy: img.naturalHeight * s - el.clientHeight }
  }
  const nudge: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }

  return (
    <div className="adm-crop">
      <div className={`adm-card-preview ${tall ? 'tall' : ''}`}>
        <div ref={frame} className={`poster ${tall ? 'tall' : 'wide'} has-img ${fill ? 'grab' : ''}`} tabIndex={fill ? 0 : -1}
          aria-label={fill ? `${label}. Drag or use the arrow keys to move it.` : label}
          onPointerDown={e => {
            if (!fill) return
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { px: e.clientX, py: e.clientY, ...overflow(), from: crop }
          }}
          onPointerMove={e => { const d = drag.current; if (d) onChange(dragged(d.from, e.clientX - d.px, e.clientY - d.py, d.ox, d.oy)) }}
          onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
          onKeyDown={e => {
            const n = fill && nudge[e.key]
            if (!n) return
            e.preventDefault()
            const { ox, oy } = overflow()
            onChange(dragged(crop, n[0], n[1], ox, oy))
          }}>
          <PosterImg src={src} crop={crop} />
        </div>
      </div>
      <div className="adm-crop-bar">
        <div className="adm-seg" role="group" aria-label={`${label} fit`}>
          <button type="button" aria-pressed={fill} className={fill ? 'on' : ''} onClick={() => onChange({ ...crop, fit: 'cover' })}>Fill</button>
          <button type="button" aria-pressed={!fill} className={fill ? '' : 'on'} onClick={() => onChange({ ...crop, fit: 'contain' })}>Whole image</button>
        </div>
        <button type="button" className="adm-link" disabled={!toCrop(crop)} onClick={() => onChange(DEFAULT_CROP)}>Reset</button>
      </div>
      {fill && (
        <label className="adm-zoom">
          <span>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={crop.zoom} aria-label={`${label} zoom`} onChange={e => onChange({ ...crop, zoom: Number(e.target.value) })} />
          <output>{crop.zoom.toFixed(2)}×</output>
        </label>
      )}
      <small className="adm-muted small">{fill ? 'Drag the image to choose which part shows.' : 'The whole image shows; any space around it is filled with a blurred copy.'}</small>
    </div>
  )
}

// Edit or create a show. Opens from the Shows page or from a channel's Shows tab.
export function ShowModal({ id, initial, channels, onClose, onSaved, onDeleted }: {
  id: string | null
  initial?: Partial<ShowForm>
  channels: { id: string; name: string }[]
  onClose: () => void
  onSaved?: (t: TitleDetail) => void
  onDeleted?: (id: string) => void
}) {
  const toast = useToast()
  const reloadCatalog = useReloadCatalog()
  const [form, setForm] = useState<ShowForm | null>(null)
  const [saved, setSaved] = useState<ShowForm | null>(null) // last saved form, to tell if anything changed
  const [impact, setImpact] = useState<TitleDetail['impact'] | null>(null)
  const [tab, setTab] = useState('details')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) { const f = { ...EMPTY, ...initial, videos: [] }; setForm(f); setSaved(f); return }
    api<TitleDetail>(`/admin/titles/${encodeURIComponent(id)}`).then(t => {
      const f = toForm(t)
      setForm(f); setSaved(f); setImpact(t.impact)
    }, e => setErr(errorMessage(e)))
  }, [id])

  const imageStatus = useImageStatus(form?.image.trim())
  const posterStatus = useImageStatus(form?.poster.trim())
  const backdropStatus = useImageStatus(form?.backdrop.trim())
  if (!form || !saved) return <Modal title="Loading show…" onClose={onClose}><Loading error={err} /></Modal>

  const set = (patch: Partial<ShowForm>) => setForm(f => f && { ...f, ...patch })
  const setCrop = (k: ImageKind) => (c: ImageCrop) => setForm(f => f && { ...f, crops: { ...f.crops, [k]: c } })
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const chName = (c: string) => channels.find(x => x.id === c)?.name || c
  const name = form.name.trim() || 'New show'

  const save = async () => {
    if (!form.name.trim()) { setTab('details'); return setErr('Enter a title.') }
    const badEp = form.videos.findIndex(v => !v.url.trim())
    if (badEp >= 0) { setTab('episodes'); return setErr(`Episode ${badEp + 1} needs a video link.`) }
    setBusy(true); setErr('')
    const body = {
      ...form, year: form.year === '' ? null : Number(form.year), videos: form.videos.map(v => ({ title: v.title.trim() || null, url: v.url.trim() })),
      publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
    }
    try {
      const t = await api<TitleDetail>(id ? `/admin/titles/${encodeURIComponent(id)}` : '/admin/titles', { method: id ? 'PUT' : 'POST', body })
      await reloadCatalog()
      toast(`${t.name} saved`)
      onSaved?.(t)
      onClose()
    } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }

  const setVideo = (key: number, patch: Partial<EpisodeRow>) => set({ videos: form.videos.map(v => (v.key === key ? { ...v, ...patch } : v)) })
  const unassigned = channels.filter(c => !form.channels.includes(c.id))

  return (
    <>
      <Modal title={id ? `Edit show · ${saved.name}` : 'New show'} onClose={onClose} dirty={dirty} wide
        tabs={[['details', 'Details'], ['episodes', `Episodes (${form.videos.length})`]]} tab={tab} onTab={setTab}
        footer={<>
          {id && <button className="adm-btn danger" onClick={() => setDeleting(true)}><Trash size={16} /> Delete show</button>}
          <span className="grow" />
          <button className="adm-btn" onClick={onClose}>Cancel</button>
          <button className="adm-btn primary" disabled={busy || (!!id && !dirty)} onClick={save}>{busy ? 'Saving…' : id ? 'Save show' : 'Create show'}</button>
        </>}>
        {err && <div className="adm-error">{err}</div>}
        {tab === 'details' ? (
          <div className="adm-cols">
            <div className="adm-stack">
              <div className="adm-row2">
                <TextField label="Title" value={form.name} onChange={v => set({ name: v })} maxLength={200} autoFocus={!id} />
                <TextField label="Year" value={form.year} onChange={v => set({ year: v.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="2005" />
              </div>
              <div className="adm-row2">
                <SelectField label="Type" value={form.type} onChange={v => set({ type: v as TitleType })} options={[['tv', 'TV show'], ['movie', 'Film']]} />
                <TextField label="Genre" value={form.genre} onChange={v => set({ genre: v })} placeholder="Kids" maxLength={40} />
              </div>
              <TextField label="Synopsis" multiline value={form.synopsis} onChange={v => set({ synopsis: v })} maxLength={1000} />
              <div>
                <TextField label="Image link (wide, 16:9)" value={form.image} onChange={v => set({ image: v })} placeholder="https://…" />
                <ImageStatus status={imageStatus} />
              </div>
              <div>
                <TextField label="Poster link (tall, optional)" value={form.poster} onChange={v => set({ poster: v })} placeholder="https://…" />
                <ImageStatus status={posterStatus} />
              </div>
              <div>
                <TextField label="Background image link (wide, optional)" value={form.backdrop} onChange={v => set({ backdrop: v })} placeholder="https://…"
                  hint="Shown at the top of the show's info window. Leave empty to use the image above." />
                <ImageStatus status={backdropStatus} />
              </div>
              <TextField label="Info link (opens when the show is clicked)" value={form.link} onChange={v => set({ link: v })} placeholder="https://…" hint="Leave empty to use the built-in player." />
              <div className="adm-row2">
                <TextField label="Category" value={form.category} onChange={v => set({ category: v })} placeholder="Series" hint="'Series' puts it in the Sitcoms row." maxLength={40} />
                <TextField label="Age rating" value={form.maturity} onChange={v => set({ maturity: v })} placeholder="U/A 7+" maxLength={20} />
              </div>
              <Check label="Shown to viewers" hint="Hidden shows stay saved but don't appear anywhere on the site." checked={!form.hidden} onChange={v => set({ hidden: !v })} />
              <TextField label="Publish on (optional)" type="datetime-local" value={form.publishAt} onChange={v => set({ publishAt: v })}
                hint={form.publishAt ? `Viewers see it, and get a notification, from ${fmtWhen(new Date(form.publishAt).toISOString())}.` : 'Leave empty to publish as soon as it is saved.'} />
              <div className="adm-field">
                <label>On channels</label>
                <div className="adm-chips">
                  {form.channels.map(c => (
                    <span key={c} className="adm-chip">{chName(c)}<button type="button" aria-label={`Remove from ${chName(c)}`} onClick={() => set({ channels: form.channels.filter(x => x !== c) })}>✕</button></span>
                  ))}
                  {unassigned.length > 0 && (
                    <select className="adm-chip-add" value="" aria-label="Add to channel" onChange={e => { if (e.target.value) set({ channels: [...form.channels, e.target.value] }) }}>
                      <option value="">+ Add channel</option>
                      {unassigned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                <small>{form.channels.length ? 'New channels add the show to the end of their line-up.' : 'Not on any channel: it only appears in Browse and Search.'}</small>
              </div>
            </div>
            <div className="adm-preview">
              <span className="adm-label">Card</span>
              {form.image && imageStatus === 'ok'
                ? <CropEditor src={form.image.trim()} label="Card image" crop={form.crops.image} onChange={setCrop('image')} />
                : <div className="adm-show-preview"><Thumb t={{ id: form.name, name: form.name }} size="lg" /><span>{name}</span></div>}
              {form.poster && posterStatus === 'ok' && <>
                <span className="adm-label">Poster (tall cards)</span>
                <CropEditor src={form.poster.trim()} label="Poster" tall crop={form.crops.poster} onChange={setCrop('poster')} />
              </>}
              {form.backdrop && backdropStatus === 'ok' && <>
                <span className="adm-label">Info window background</span>
                <CropEditor src={form.backdrop.trim()} label="Info window background" crop={form.crops.backdrop} onChange={setCrop('backdrop')} />
              </>}
            </div>
          </div>
        ) : (
          <div className="adm-stack">
            <p className="adm-muted">Episodes play in this order on the show page. Each one is a video file link (MP4, WebM) or a YouTube link. With no episodes, a sample clip plays.</p>
            {form.videos.length > 0 && (
              <SortableList items={form.videos} getKey={v => v.key} onChange={videos => set({ videos })} render={(v, i) => (
                <div className="adm-episode">
                  <span className="adm-num">{i + 1}</span>
                  <input aria-label={`Episode ${i + 1} title`} placeholder={`Episode ${i + 1}`} value={v.title} onChange={e => setVideo(v.key, { title: e.target.value })} />
                  <input aria-label={`Episode ${i + 1} video link`} placeholder="https://…" value={v.url} className={v.url.trim() ? '' : 'bad'} onChange={e => setVideo(v.key, { url: e.target.value })} />
                  <button type="button" className="adm-icon" aria-label={`Remove episode ${i + 1}`} onClick={() => set({ videos: form.videos.filter(x => x.key !== v.key) })}><Trash size={16} /></button>
                </div>
              )} />
            )}
            <button type="button" className="adm-btn" onClick={() => set({ videos: [...form.videos, ...withKeys([{ title: '', url: '' }])] })}><Plus size={16} /> Add episode</button>
          </div>
        )}
      </Modal>
      {deleting && id && (
        <ConfirmDelete title={`Delete ${saved.name}?`} expected={saved.name} what="show title" onClose={() => setDeleting(false)}
          onConfirm={async confirm => {
            await api(`/admin/titles/${encodeURIComponent(id)}`, { method: 'DELETE', body: { confirm } })
            await reloadCatalog()
            toast(`${saved.name} deleted`)
            onDeleted?.(id)
            onClose()
          }}>
          It will be removed from {saved.channels.length} channel{saved.channels.length === 1 ? '' : 's'}
          {impact && <>, {impact.lists} profile{impact.lists === 1 ? "'s" : "s'"} My List, and {impact.progress} watch progress record{impact.progress === 1 ? '' : 's'}</>}.
        </ConfirmDelete>
      )}
    </>
  )
}

// Series and Movies pages list the titles that aren't on any channel; Shows lists everything.
const KINDS = {
  all: { heading: 'Shows', noun: 'show', type: undefined, section: undefined },
  tv: { heading: 'Series', noun: 'series', type: 'tv', section: 'series' },
  movie: { heading: 'Movies', noun: 'movie', type: 'movie', section: 'movies' },
} as const

type Sections = { series: boolean; movies: boolean }

// Site-wide switch for the whole Series or Movies section; saves as soon as it's changed.
function SectionSwitch({ section, heading }: { section: keyof Sections; heading: string }) {
  const toast = useToast()
  const reloadCatalog = useReloadCatalog()
  const sections = useApi<Sections>('/admin/sections')
  const [busy, setBusy] = useState(false)
  if (!sections.data) return <Loading error={sections.error} onRetry={sections.reload} />
  const on = sections.data[section]
  const change = async (v: boolean) => {
    setBusy(true)
    try {
      sections.setData(await api<Sections>('/admin/sections', { method: 'PUT', body: { [section]: v } }))
      await reloadCatalog()
      toast(`${heading} ${v ? 'shown to' : 'hidden from'} viewers`)
    } catch (e) { toast(errorMessage(e), 'bad') }
    setBusy(false)
  }
  return (
    <section className={`adm-panel adm-section-switch ${busy ? 'busy' : ''}`}>
      <Check label={`Show ${heading.toLowerCase()} to viewers`} checked={on} onChange={change}
        hint={on ? `Every ${heading.toLowerCase().replace(/s$/, '')} below that isn't hidden on its own appears on the site.` : `None of the ${heading.toLowerCase()} below appear on the site, whatever their own setting. Channel shows aren't affected.`} />
    </section>
  )
}

export function ShowsPage({ kind = 'all' }: { kind?: keyof typeof KINDS }) {
  const { heading, noun, type, section } = KINDS[kind]
  const shows = useApi<AdminTitleRow[]>('/admin/titles')
  const chans = useApi<AdminChannel[]>('/admin/channels')
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState('all')
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const toast = useToast()
  const reloadCatalog = useReloadCatalog()
  const editing = params.get('edit')
  const creating = params.get('new') !== null

  const problems = (t: AdminTitleRow) => [
    !t.channels.length && 'Not on any channel',
    !t.image && !t.poster && 'No image',
    broken.has(t.id) && 'Image broken',
  ].filter((x): x is string => !!x)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (shows.data || []).filter(t =>
      (!type || (t.type === type && !t.channels.length)) &&
      (!s || t.name.toLowerCase().includes(s) || String(t.year || '').includes(s)) &&
      (channel === 'all' || (channel === 'none' ? !t.channels.length : channel === 'problems' ? problems(t).length : t.channels.includes(channel))))
  }, [shows.data, q, channel, broken, type])

  if (!shows.data || !chans.data) return <Loading error={shows.error || chans.error} onRetry={() => { shows.reload(); chans.reload() }} />
  const chName = (id: string) => chans.data!.find(c => c.id === id)?.name || id
  // Selection only counts shows still in the filtered list.
  const picked = list.filter(t => selected.has(t.id))
  const allPicked = list.length > 0 && picked.length === list.length
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const bulk = async (action: string, extra: Record<string, unknown> = {}, done = '') => {
    setBulkBusy(true)
    try {
      await api('/admin/titles/bulk', { method: 'POST', body: { ids: picked.map(t => t.id), action, ...extra } })
      await Promise.all([reloadCatalog(), shows.reload()])
      toast(done)
      setSelected(new Set())
    } catch (e) { toast(errorMessage(e), 'bad') }
    setBulkBusy(false)
  }
  const n = picked.length
  const many = `${n} show${n === 1 ? '' : 's'}`
  const open = (query: string) => router.push(`${pathname}?${query}`, { scroll: false })
  const close = () => router.replace(pathname, { scroll: false })

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>{heading}</h1>
        <button className="adm-btn primary" onClick={() => open('new')}><Plus size={16} /> New {noun}</button>
      </div>
      {section && <SectionSwitch section={section} heading={heading} />}
      <div className="adm-toolbar">
        <label className="adm-search"><Search size={16} /><input placeholder={`Search ${heading.toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} aria-label={`Search ${heading.toLowerCase()}`} /></label>
        {!type && <select value={channel} onChange={e => setChannel(e.target.value)} aria-label="Filter by channel">
          <option value="all">All channels</option>
          {chans.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Not on any channel</option>
          <option value="problems">Needs attention</option>
        </select>}
      </div>
      <p className="adm-muted">{type ? `${list.length} not on any channel. Adding one to a channel moves it to that channel's Shows tab.` : `${list.length} of ${shows.data.length} shows`}</p>
      {list.length > 0 && (
        <div className={`adm-bulk ${n ? 'on' : ''}`}>
          <label className="adm-bulk-all"><input type="checkbox" checked={allPicked} ref={el => { if (el) el.indeterminate = n > 0 && !allPicked }}
            onChange={() => setSelected(allPicked ? new Set() : new Set(list.map(t => t.id)))} aria-label="Select all shown" /> {n ? `${n} selected` : 'Select all'}</label>
          {n > 0 && <>
            <button className="adm-btn small" disabled={bulkBusy} onClick={() => bulk('show', {}, `${many} shown to viewers`)}>Show</button>
            <button className="adm-btn small" disabled={bulkBusy} onClick={() => bulk('hide', {}, `${many} hidden`)}>Hide</button>
            <select disabled={bulkBusy} value="" aria-label="Add selected shows to a channel" onChange={e => { const c = e.target.value; if (c) bulk('add-channel', { channelId: c }, `${many} added to ${chName(c)}`) }}>
              <option value="">Add to channel…</option>
              {chans.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select disabled={bulkBusy} value="" aria-label="Remove selected shows from a channel" onChange={e => { const c = e.target.value; if (c) bulk('remove-channel', { channelId: c }, `${many} removed from ${chName(c)}`) }}>
              <option value="">Remove from channel…</option>
              {chans.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="adm-btn small danger" disabled={bulkBusy} onClick={() => setBulkDeleting(true)}><Trash size={14} /> Delete</button>
            <button className="adm-link" onClick={() => setSelected(new Set())}>Clear</button>
          </>}
        </div>
      )}
      <ul className="adm-show-list">
        {list.map(t => {
          const p = problems(t)
          return (
            <li key={t.id} className={`adm-show-item ${selected.has(t.id) ? 'picked' : ''}`}>
              <input type="checkbox" className="adm-pick" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.name}`} />
              <button className="adm-show-row" onClick={() => open(`edit=${encodeURIComponent(t.id)}`)}>
                <Thumb t={t} onBroken={id => setBroken(b => (b.has(id) ? b : new Set(b).add(id)))} />
                <span className="adm-show-main">
                  <b>{t.name}</b>
                  <small>{[t.year, t.channels.map(chName).join(', ') || null, `${t.episodes} episode${t.episodes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</small>
                </span>
                {t.hidden && <span className="adm-pill">Hidden</span>}
                {isScheduled(t.publishAt) && <span className="adm-pill ok">Publishes {fmtWhen(t.publishAt!)}</span>}
                {p.filter(x => !type || x !== 'Not on any channel').map(x => <span key={x} className="adm-pill warn">{x}</span>)}
                <span className="adm-btn small">Edit</span>
              </button>
            </li>
          )
        })}
      </ul>
      {list.length === 0 && <p className="adm-empty">No {heading.toLowerCase()} match. <button className="adm-link" onClick={() => { setQ(''); setChannel('all') }}>Clear filters</button></p>}
      {bulkDeleting && (
        <ConfirmDelete title={`Delete ${many}?`} expected={String(n)} what="number of shows" onClose={() => setBulkDeleting(false)}
          onConfirm={async confirm => { await bulk('delete', { confirm: Number(confirm) }, `${many} deleted`); setBulkDeleting(false) }}>
          {picked.slice(0, 8).map(t => t.name).join(', ')}{n > 8 ? ` and ${n - 8} more` : ''} will be removed from every channel, My List and watch history.
        </ConfirmDelete>
      )}
      {(editing || creating) && (
        <ShowModal key={editing || 'new'} id={editing} initial={type && { type }} channels={chans.data} onClose={close}
          onSaved={() => shows.reload()} onDeleted={() => shows.reload()} />
      )}
    </div>
  )
}
