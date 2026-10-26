import { loadCatalog } from '@/server/catalog'
import { handle, json } from '@/server/http'

export const GET = handle(async () => json(await loadCatalog()))
