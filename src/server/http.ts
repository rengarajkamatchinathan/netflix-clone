// Helpers shared by every route handler.
import { NextResponse, type NextRequest } from 'next/server'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const fail = (status: number, message: string): never => { throw new HttpError(status, message) }

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

// Request body as an object; anything that isn't a JSON object is a 400.
export async function readBody(req: NextRequest): Promise<Record<string, any>> {
  const text = await req.text()
  if (!text) return {}
  try {
    const v = JSON.parse(text)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch {}
  return fail(400, 'Invalid request.')
}

type Ctx<P> = { params: Promise<P> }

// Wraps a handler so thrown HttpErrors become JSON errors and anything else a logged 500.
export function handle<P = Record<string, string>>(fn: (req: NextRequest, params: P) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await fn(req, (await ctx?.params) ?? ({} as P))
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Something went wrong on the server. Try again.' }, 500)
    }
  }
}
