/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

/** Serve /api/* (Vercel functions) in local dev too. Only active when ANTHROPIC_API_KEY is set;
 *  otherwise the app falls back to the built-in reader. */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server: ViteDevServer) {
      if (!process.env.ANTHROPIC_API_KEY) return
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const name = req.url?.match(/^\/api\/([a-z]+)(?:\?|$)/)?.[1]
        if (!name) return next()
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        const vreq = { method: req.method, headers: req.headers, body: raw ? JSON.parse(raw) : undefined }
        const vres = {
          status(code: number) { res.statusCode = code; return vres },
          setHeader(k: string, v: string) { res.setHeader(k, v); return vres },
          json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
          end(body?: string) { res.end(body) },
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          await mod.default(vreq, vres)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  test: { include: ['src/**/*.test.ts'] },
})
