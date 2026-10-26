// JSON calls from the browser to the StreamFlix API. Throws an ApiError carrying the server's message.
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

const NOT_RUNNING = "The StreamFlix server isn't responding. Make sure it's running (npm run dev) and try again."

export async function api<T = unknown>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Can't reach the StreamFlix server. Check your connection and try again.", 0)
  }
  // Anything but JSON (e.g. an HTML error page) means the API didn't handle the request.
  if (!res.headers.get('content-type')?.includes('application/json')) throw new ApiError(NOT_RUNNING, res.status)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || (res.status >= 500 ? NOT_RUNNING : `Request failed (${res.status}).`), res.status)
  return data as T
}
