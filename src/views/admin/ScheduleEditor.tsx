'use client'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { hash } from '@/lib/ids'
import { Plus, Trash } from '@/components/icons'
import type { LineupTitle } from './types'

// A daily time block being edited; times are "HH:MM" as the time inputs use them.
export interface BlockRow { key: number; start: string; end: string; titleIds: string[] }

export const DAY = 24 * 60
const SNAP = 15 // minutes; drags and auto-schedule land on quarter hours
const PX = 0.9 // pixels per minute on the timeline
let keySeq = 1_000_000 // apart from the keys the channel editor hands out

export const blockKey = () => ++keySeq
export const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
// An end time of 00:00 means midnight at the end of the day.
export const toEndMin = (t: string) => toMin(t) || DAY
const span = (b: BlockRow) => ({ s: toMin(b.start), e: toEndMin(b.end) })
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const snap = (m: number) => Math.round(m / SNAP) * SNAP

// Same rules as the server: real times, end after start, at least one show, no overlaps.
export function scheduleError(blocks: BlockRow[]): string {
  const list = blocks.map(b => ({ ...b, s: b.start ? toMin(b.start) : NaN, e: b.end ? toEndMin(b.end) : NaN })).sort((a, b) => a.s - b.s)
  for (const [i, b] of list.entries()) {
    if (isNaN(b.s) || isNaN(b.e)) return 'Give every time block a start and end time.'
    if (b.e <= b.s) return `The ${b.start} block must end after it starts.`
    if (!b.titleIds.length) return `Add at least one show to the ${b.start} block.`
    if (i && b.s < list[i - 1].e) return `The ${list[i - 1].start} and ${b.start} blocks overlap.`
  }
  return ''
}

// Spreads the whole line-up, in order, over the day: one block per show (at least 30 minutes
// each; longer line-ups share blocks), starting at midnight.
export function autoSchedule(lineup: LineupTitle[]): BlockRow[] {
  const n = lineup.length
  const count = Math.min(n, DAY / 30)
  const edge = (i: number) => (i === count ? DAY : snap((i * DAY) / count))
  return Array.from({ length: count }, (_, i) => ({
    key: blockKey(), start: toTime(edge(i)), end: toTime(edge(i + 1)),
    titleIds: lineup.slice(Math.floor((i * n) / count), Math.floor(((i + 1) * n) / count)).map(t => t.id),
  }))
}

// Closes the gaps: the blocks keep their order and their share of the scheduled time, and are
// stretched to fill the day from midnight to midnight.
export function fillDay(blocks: BlockRow[]): BlockRow[] {
  const list = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start))
  const total = list.reduce((sum, b) => sum + span(b).e - span(b).s, 0)
  let used = 0, prev = 0
  return list.map((b, i) => {
    used += span(b).e - span(b).s
    const left = list.length - 1 - i // later blocks each need at least SNAP minutes
    const end = i === list.length - 1 ? DAY : clamp(snap((used / total) * DAY), prev + SNAP, DAY - left * SNAP)
    const row = { ...b, start: toTime(prev), end: toTime(end) }
    prev = end
    return row
  })
}

type Drag ={ key: number; mode: 'move' | 'top' | 'bottom'; y: number; s: number; e: number; lo: number; hi: number }

// Day view of a channel's time blocks: drag edges to resize, drag a block to move it, click an
// empty hour to add one. The selected block's times and shows are edited alongside.
export function ScheduleEditor({ blocks, lineup, color, onChange }: {
  blocks: BlockRow[]; lineup: LineupTitle[]; color: string; onChange: (blocks: BlockRow[]) => void
}) {
  const [sel, setSel] = useState<number | null>(null)
  const drag = useRef<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const day = useRef<HTMLDivElement>(null)
  const name = (id: string) => lineup.find(t => t.id === id)?.name || id
  const placed = blocks.filter(b => b.start && b.end && toEndMin(b.end) > toMin(b.start))
  const selected = blocks.find(b => b.key === sel) || null

  // Open on the first block (or 7 AM) rather than midnight.
  useEffect(() => {
    const first = Math.min(7 * 60, ...placed.map(b => toMin(b.start)))
    if (scroller.current) scroller.current.scrollTop = Math.max(0, first * PX - 16)
  }, [])

  const update = (key: number, patch: Partial<BlockRow>) => onChange(blocks.map(b => (b.key === key ? { ...b, ...patch } : b)))
  const remove = (key: number) => { onChange(blocks.filter(b => b.key !== key)); if (sel === key) setSel(null) }
  // Free room around a block: from the end of the one before to the start of the one after.
  const room = (key: number, s: number) => {
    const others = placed.filter(b => b.key !== key).map(span)
    return { lo: Math.max(0, ...others.filter(o => o.s < s).map(o => o.e)), hi: Math.min(DAY, ...others.filter(o => o.s > s).map(o => o.s)) }
  }
  const addAt = (minute: number, length = 60) => {
    const taken = placed.map(span)
    if (taken.some(o => minute >= o.s && minute < o.e)) return
    const lo = Math.max(0, ...taken.filter(o => o.e <= minute).map(o => o.e))
    const hi = Math.min(DAY, ...taken.filter(o => o.s > minute).map(o => o.s))
    const s = Math.max(lo, Math.floor(minute / 60) * 60)
    const e = Math.min(s + length, hi)
    if (e - s < SNAP) return
    const b = { key: blockKey(), start: toTime(s), end: toTime(e), titleIds: [] }
    onChange([...blocks, b])
    setSel(b.key)
  }
  const addNext = () => addAt(placed.length ? Math.max(...placed.map(b => toEndMin(b.end))) % DAY : 7 * 60, 120)

  const startDrag = (ev: PointerEvent, b: BlockRow, mode: Drag['mode']) => {
    if (ev.button !== 0) return
    ev.stopPropagation()
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    const { s, e } = span(b)
    drag.current = { key: b.key, mode, y: ev.clientY, s, e, ...room(b.key, s) }
    setSel(b.key)
  }
  const onMove = (ev: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const delta = snap((ev.clientY - d.y) / PX)
    let s = d.s, e = d.e
    if (d.mode === 'top') s = clamp(d.s + delta, d.lo, d.e - SNAP)
    else if (d.mode === 'bottom') e = clamp(d.e + delta, d.s + SNAP, d.hi)
    else { const shift = clamp(delta, d.lo - d.s, d.hi - d.e); s += shift; e += shift }
    const b = blocks.find(x => x.key === d.key)
    if (b && (toMin(b.start) !== s || toEndMin(b.end) !== e)) update(d.key, { start: toTime(s), end: toTime(e) })
  }
  const endDrag = () => { drag.current = null }
  const clickDay = (ev: MouseEvent<HTMLDivElement>) => {
    if (ev.target !== day.current) return
    addAt(Math.floor((ev.clientY - day.current.getBoundingClientRect().top) / PX))
  }

  const auto = () => {
    if (blocks.length && !window.confirm('Replace the current schedule with one block per show across the whole day?')) return
    onChange(autoSchedule(lineup)); setSel(null)
  }

  // Only blocks with valid times take part; any still being typed stay as they are.
  const gapless = placed.length > 0 && placed.map(span).sort((a, b) => a.s - b.s).every((o, i, l) => o.s === (i ? l[i - 1].e : 0)) && Math.max(...placed.map(b => toEndMin(b.end))) === DAY
  const adjust = () => {
    const filled = new Map(fillDay(placed).map(b => [b.key, b]))
    onChange(blocks.map(b => filled.get(b.key) || b))
  }

  return (
    <div className="sch">
      <div className="sch-tools">
        <button type="button" className="adm-btn primary" onClick={auto} disabled={!lineup.length}>Auto-schedule</button>
        <button type="button" className="adm-btn" onClick={adjust} disabled={gapless || !placed.length}
          title="Stretch the blocks to fill the whole day, closing any gaps">Adjust to fill day</button>
        <button type="button" className="adm-btn" onClick={addNext} disabled={!lineup.length}><Plus size={16} /> Add block</button>
        {blocks.length > 0 && <button type="button" className="adm-btn danger" onClick={() => { onChange([]); setSel(null) }}>Clear all</button>}
      </div>
      <p className="adm-muted">During a block its shows play back-to-back, every day, in each viewer&apos;s local time. Any time not covered plays the whole line-up. Drag a block&apos;s top or bottom edge to change its length, drag the block to move it, or click an empty time to add one.</p>
      {!lineup.length ? <p className="adm-empty">Add shows on the Shows tab first.</p> : (
        <div className="sch-body">
          <div className="sch-scroll" ref={scroller}>
            <div className="sch-day" ref={day} style={{ height: DAY * PX }} onClick={clickDay} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="sch-hour" style={{ top: h * 60 * PX }}><span>{toTime(h * 60)}</span></div>)}
              {placed.map(b => {
                const { s, e } = span(b)
                const hue = hash(b.titleIds[0] || String(b.key)) % 360
                return (
                  <div key={b.key} className={`sch-block ${sel === b.key ? 'sel' : ''} ${b.titleIds.length ? '' : 'empty'}`}
                    style={{ top: s * PX, height: (e - s) * PX, background: `hsl(${hue} 45% 30%)`, outlineColor: color }}
                    onPointerDown={ev => startDrag(ev, b, 'move')} onClick={ev => ev.stopPropagation()}>
                    <span className="sch-handle top" onPointerDown={ev => startDrag(ev, b, 'top')} />
                    <span className="sch-text"><b>{b.start}–{b.end === '00:00' ? '24:00' : b.end}</b> {b.titleIds.map(name).join(', ') || 'No shows yet'}</span>
                    <button type="button" className="sch-x" aria-label={`Remove the ${b.start} block`} onPointerDown={ev => ev.stopPropagation()} onClick={() => remove(b.key)}>✕</button>
                    <span className="sch-handle bottom" onPointerDown={ev => startDrag(ev, b, 'bottom')} />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="sch-side">
            {selected ? <BlockDetails b={selected} lineup={lineup} name={name} onChange={patch => update(selected.key, patch)} onRemove={() => remove(selected.key)} /> : (
              <p className="adm-muted">{blocks.length ? 'Click a block to change its times or shows.' : 'Use Auto-schedule to fill the day from the line-up, or click an empty time to add a block.'}</p>
            )}
            {blocks.length > placed.length && <p className="adm-err-text">{blocks.length - placed.length} block{blocks.length - placed.length === 1 ? ' has' : 's have'} times that don&apos;t fit the day. Fix them in the list below.</p>}
            {blocks.filter(b => !placed.includes(b)).map(b => (
              <button key={b.key} type="button" className="adm-btn small" onClick={() => setSel(b.key)}>{b.start || '--:--'}–{b.end || '--:--'}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BlockDetails({ b, lineup, name, onChange, onRemove }: {
  b: BlockRow; lineup: LineupTitle[]; name: (id: string) => string; onChange: (patch: Partial<BlockRow>) => void; onRemove: () => void
}) {
  const free = lineup.filter(t => !b.titleIds.includes(t.id))
  return (
    <div className="adm-block">
      <div className="adm-block-head">
        <label>From <input type="time" step={SNAP * 60} value={b.start} onChange={e => onChange({ start: e.target.value })} /></label>
        <label>to <input type="time" step={SNAP * 60} value={b.end} onChange={e => onChange({ end: e.target.value })} /></label>
        <span className="grow" />
        <button type="button" className="adm-icon" aria-label="Remove this block" onClick={onRemove}><Trash size={16} /></button>
      </div>
      <div className="adm-chips">
        {b.titleIds.map(tid => (
          <span key={tid} className="adm-chip">{name(tid)}<button type="button" aria-label={`Remove ${name(tid)}`} onClick={() => onChange({ titleIds: b.titleIds.filter(x => x !== tid) })}>✕</button></span>
        ))}
        {free.length > 0 && (
          <select className="adm-chip-add" value="" aria-label="Add a show to this block" onChange={e => { if (e.target.value) onChange({ titleIds: [...b.titleIds, e.target.value] }) }}>
            <option value="">+ Add show</option>
            {free.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      {!b.titleIds.length ? <small className="adm-err-text">Add at least one show.</small> : <small className="adm-muted">Shows play in this order, then repeat until the block ends.</small>}
    </div>
  )
}
