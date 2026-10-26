import { getChannel } from '@/server/admin'
import { requireAdmin } from '@/server/auth'
import { logoUrl } from '@/server/catalog'
import { one, query } from '@/server/db'
import { fail, handle, json } from '@/server/http'
import { LOGO_TYPES, MAX_LOGO_BYTES } from '@/server/logos'

type P = { id: string }

// Upload or replace the logo: multipart form with a "file" field.
export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  const form = await req.formData().catch(() => fail(400, 'Send the logo as a file upload.'))
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) fail(400, 'Choose an image file.')
  const f = file as File
  if (!LOGO_TYPES[f.type]) fail(400, 'Logos must be PNG, JPG, WebP, GIF, AVIF or SVG images.')
  if (f.size > MAX_LOGO_BYTES) fail(400, 'Logos must be 2 MB or smaller.')
  const row = await one('update channels set logo = $2, logo_type = $3, logo_updated_at = now() where id = $1 returning logo_updated_at',
    [c.id, Buffer.from(await f.arrayBuffer()), f.type])
  return json({ image: logoUrl(c.id, row!.logo_updated_at) })
})

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin()
  const c = await getChannel(id)
  await query('update channels set logo = null, logo_type = null, logo_updated_at = null where id = $1', [c.id])
  return json({ image: null })
})
