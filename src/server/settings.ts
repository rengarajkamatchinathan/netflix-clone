// Site-wide switches stored in the settings table.
import { one, query } from './db'

// Whether the Series and Movies sections (titles on no channel) are shown to viewers.
export interface Sections { series: boolean; movies: boolean }
const DEFAULT_SECTIONS: Sections = { series: true, movies: true }

export async function getSections(): Promise<Sections> {
  const row = await one<{ value: Partial<Sections> }>("select value from settings where key = 'sections'")
  return { ...DEFAULT_SECTIONS, ...row?.value }
}

export async function setSections(patch: Partial<Sections>): Promise<Sections> {
  const next = { ...(await getSections()), ...patch }
  await query("insert into settings (key, value) values ('sections', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(next)])
  return next
}
