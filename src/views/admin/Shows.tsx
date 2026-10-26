'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { TitleType } from '@/lib/types'
import { useReloadCatalog } from '@/context/CatalogContext'
import { Plus, Search, Trash } from '@/components/icons'
import { ConfirmDelete, errorMessage, Loading, Modal, SelectField, SortableList, TextField, Thumb, useApi, useToast } from './kit'
import type { AdminChannel, AdminTitleRow, TitleDetail } from './types'

interface EpisodeRow { key: number; title: string; url: string }
interface ShowForm {
  name: string; year: string; type: TitleType; genre: string; synopsis: string; category: string; maturity: string
  image: string; poster: string; link: string; videos: EpisodeRow[]; channels: string[]
}

const EMPTY: ShowForm = { name: '', year: '', type: 'tv', genre: '', synopsis: '', category: '', maturity: '', image: '', poster: '', link: '', videos: [], channels: [] }
let rowSeq = 0
const withKeys = (videos: { title: string | null; url: string }[]): EpisodeRow[] => videos.map(v => ({ title: v.title || '', url: v.url, key: ++rowSeq }))

const toForm = (t: TitleDetail): ShowForm => ({
  name: t.name, year: t.year == null ? '' : String(t.year), type: t.type, genre: t.genre || '', synopsis: t.synopsis || '', category: t.category || '',
  maturity: t.maturity || '', image: t.image || '', poster: t.poster || '', link: t.link || '', videos: withKeys(t.videos || []), channels: t.channels,
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
  if (!form || !saved) return <Modal title="Loading show…" onClose={onClose}><Loading error={err} /></Modal>

  const set = (patch: Partial<ShowForm>) => setForm(f => f && { ...f, ...patch })
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const chName = (c: string) => channels.find(x => x.id === c)?.name || c
  const name = form.name.trim() || 'New show'

  const save = async () => {
    if (!form.name.trim()) { setTab('details'); return setErr('Enter a title.') }
    const badEp = form.videos.findIndex(v => !v.url.trim())
    if (badEp >= 0) { setTab('episodes'); return setErr(`Episode ${badEp + 1} needs a video link.`) }
    setBusy(true); setErr('')
    const body = { ...form, year: form.year === '' ? null : Number(form.year), videos: form.videos.map(v => ({ title: v.title.trim() || null, url: v.url.trim() })) }
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
              <TextField label="Info link (opens when the show is clicked)" value={form.link} onChange={v => set({ link: v })} placeholder="https://…" hint="Leave empty to use the built-in player." />
              <div className="adm-row2">
                <TextField label="Category" value={form.category} onChange={v => set({ category: v })} placeholder="Series" hint="'Series' puts it in the Sitcoms row." maxLength={40} />
                <TextField label="Age rating" value={form.maturity} onChange={v => set({ maturity: v })} placeholder="U/A 7+" maxLength={20} />
              </div>
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
              <span className="adm-label">Preview</span>
              <div className="adm-show-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {form.image && imageStatus === 'ok' ? <img src={form.image} alt="" referrerPolicy="no-referrer" /> : <Thumb t={{ id: form.name, name: form.name }} size="lg" />}
                <span>{name}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {form.poster && posterStatus === 'ok' && <img className="adm-poster-preview" src={form.poster} alt="" referrerPolicy="no-referrer" />}
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

export function ShowsPage() {
  const shows = useApi<AdminTitleRow[]>('/admin/titles')
  const chans = useApi<AdminChannel[]>('/admin/channels')
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState('all')
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
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
      (!s || t.name.toLowerCase().includes(s) || String(t.year || '').includes(s)) &&
      (channel === 'all' || (channel === 'none' ? !t.channels.length : channel === 'problems' ? problems(t).length : t.channels.includes(channel))))
  }, [shows.data, q, channel, broken])

  if (!shows.data || !chans.data) return <Loading error={shows.error || chans.error} onRetry={() => { shows.reload(); chans.reload() }} />
  const chName = (id: string) => chans.data!.find(c => c.id === id)?.name || id
  const open = (query: string) => router.push(`${pathname}?${query}`, { scroll: false })
  const close = () => router.replace(pathname, { scroll: false })

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Shows</h1>
        <button className="adm-btn primary" onClick={() => open('new')}><Plus size={16} /> New show</button>
      </div>
      <div className="adm-toolbar">
        <label className="adm-search"><Search size={16} /><input placeholder="Search shows" value={q} onChange={e => setQ(e.target.value)} aria-label="Search shows" /></label>
        <select value={channel} onChange={e => setChannel(e.target.value)} aria-label="Filter by channel">
          <option value="all">All channels</option>
          {chans.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Not on any channel</option>
          <option value="problems">Needs attention</option>
        </select>
      </div>
      <p className="adm-muted">{list.length} of {shows.data.length} shows</p>
      <ul className="adm-show-list">
        {list.map(t => {
          const p = problems(t)
          return (
            <li key={t.id}>
              <button className="adm-show-row" onClick={() => open(`edit=${encodeURIComponent(t.id)}`)}>
                <Thumb t={t} onBroken={id => setBroken(b => (b.has(id) ? b : new Set(b).add(id)))} />
                <span className="adm-show-main">
                  <b>{t.name}</b>
                  <small>{[t.year, t.channels.map(chName).join(', ') || null, `${t.episodes} episode${t.episodes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</small>
                </span>
                {p.map(x => <span key={x} className="adm-pill warn">{x}</span>)}
                <span className="adm-btn small">Edit</span>
              </button>
            </li>
          )
        })}
      </ul>
      {list.length === 0 && <p className="adm-empty">No shows match. <button className="adm-link" onClick={() => { setQ(''); setChannel('all') }}>Clear filters</button></p>}
      {(editing || creating) && (
        <ShowModal key={editing || 'new'} id={editing} channels={chans.data} onClose={close}
          onSaved={() => shows.reload()} onDeleted={() => shows.reload()} />
      )}
    </div>
  )
}
