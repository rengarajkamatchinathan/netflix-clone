import { json } from '@/server/http'

// Unknown API paths answer in JSON like every other API response.
const notFound = async () => json({ error: 'Not found.' }, 404)
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE }
