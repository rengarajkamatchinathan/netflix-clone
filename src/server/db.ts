import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')

function createPool() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 })
  // Neon drops idle connections (e.g. when the database suspends). Without this handler the
  // dropped connection's error would crash the server; the pool simply opens a new one next time.
  pool.on('error', err => console.warn('Database connection dropped:', err.message))
  return pool
}

// One pool per process, kept across dev hot reloads.
const g = globalThis as typeof globalThis & { __sfPool?: pg.Pool }
export const pool = (g.__sfPool ??= createPool())

export const query = (text: string, params?: unknown[]) => pool.query(text, params)
export const one = async <T = any>(text: string, params?: unknown[]): Promise<T | null> => (await pool.query(text, params)).rows[0] ?? null
export const many = async <T = any>(text: string, params?: unknown[]): Promise<T[]> => (await pool.query(text, params)).rows

// Runs fn(client) inside a transaction.
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
