/* Shared Claude call: structured JSON output, with server-side fallback when a request is declined. */

import Anthropic from '@anthropic-ai/sdk'

export class RefusalError extends Error {}

export function cors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return true
  }
  return false
}

export async function callJson(system: string, user: string, schema: Record<string, unknown>) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const client = new Anthropic({ apiKey })

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: user }],
  })

  if (response.stop_reason === 'refusal') throw new RefusalError(response.stop_details?.explanation ?? 'refusal')
  if (response.stop_reason === 'max_tokens') throw new Error('response truncated at max_tokens')
  const raw = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return JSON.parse(raw)
}

export function errorResponse(res: any, e: unknown) {
  if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `anthropic ${e.status}`, detail: e.message.slice(0, 300) })
  if (e instanceof RefusalError) return res.status(502).json({ error: 'model refusal', detail: e.message })
  return res.status(500).json({ error: e instanceof Error ? e.message.slice(0, 300) : 'unknown' })
}
