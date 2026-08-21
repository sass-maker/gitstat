import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * Dev-only proxy for /api/gh — simulates the Cloudflare Pages Function.
 * In production, functions/api/gh.ts handles this server-side.
 * In dev, this Vite plugin forwards requests to GitHub API directly.
 */
function ghProxyPlugin(): Plugin {
  return {
    name: 'gh-proxy',
    configureServer(server) {
      // loadEnv with empty prefix loads ALL env vars (not just VITE_ prefixed)
      const env = loadEnv(server.config.mode, process.cwd(), '')
      const token = env.GH_PUBLIC_TOKEN || process.env.GH_PUBLIC_TOKEN

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/gh')) return next()

        try {
          let ghResp: Response

          if (req.method === 'POST') {
            // GraphQL POST — read body
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const body = Buffer.concat(chunks).toString()

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'gitstat-dev-proxy',
            }
            if (token) headers.Authorization = `Bearer ${token}`

            ghResp = await fetch('https://api.github.com/graphql', {
              method: 'POST',
              headers,
              body,
            })
          } else {
            // REST GET — extract path from query
            const path = new URL(url, 'http://localhost').searchParams.get('path')
            if (!path) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing path parameter' }))
              return
            }

            const headers: Record<string, string> = {
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'gitstat-dev-proxy',
            }
            if (token) headers.Authorization = `Bearer ${token}`

            ghResp = await fetch(`https://api.github.com${path}`, { headers })
          }

          // Forward rate limit headers
          const rlRemaining = ghResp.headers.get('x-ratelimit-remaining')
          const rlLimit = ghResp.headers.get('x-ratelimit-limit')
          const rlReset = ghResp.headers.get('x-ratelimit-reset')
          if (rlRemaining) res.setHeader('X-RateLimit-Remaining', rlRemaining)
          if (rlLimit) res.setHeader('X-RateLimit-Limit', rlLimit)
          if (rlReset) res.setHeader('X-RateLimit-Reset', rlReset)

          res.statusCode = ghResp.status
          res.setHeader('Content-Type', ghResp.headers.get('Content-Type') || 'application/json')
          res.end(await ghResp.text())
        } catch (e: any) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ghProxyPlugin()],
})
