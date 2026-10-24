/* POST to a serverless function with a timeout. Throws with a short reason the UI can show. */

export async function postJson<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) throw new Error('AI service not available here')
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
    return data as T
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('AI service timed out')
    throw e instanceof Error ? e : new Error(String(e))
  } finally {
    clearTimeout(timer)
  }
}
