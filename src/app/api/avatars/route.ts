import { many } from '@/server/db'
import { handle, json } from '@/server/http'

export const GET = handle(async () => json(await many('select id, url, label, category from avatars order by category, sort_order, id')))
