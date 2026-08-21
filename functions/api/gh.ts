// Proxy for GitHub API requests using a server-side token.
// Used for public-mode access (no OAuth) so anonymous users get
// authenticated rate limits (5,000 req/hr shared) instead of 60/hr.
//
// GET  /api/gh?path=/users/foo  → forwards REST GET
// POST /api/gh                   → forwards GraphQL POST (body: { query, variables })
//
// The proxy injects GH_PUBLIC_TOKEN from env and forwards the request.
//
// In production, set GH_PUBLIC_TOKEN via:
//   npx wrangler pages secret put GH_PUBLIC_TOKEN --project-name gitstat
//
// For local dev, create a .env file with GH_PUBLIC_TOKEN=ghp_...
// or use a fine-grained PAT with public read access.

interface GhEnv {
  GH_PUBLIC_TOKEN?: string
}

function buildHeaders(env: GhEnv): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gitstat-proxy',
  }
  if (env.GH_PUBLIC_TOKEN) {
    headers.Authorization = `Bearer ${env.GH_PUBLIC_TOKEN}`
  }
  return headers
}

function forwardRateLimitHeaders(resp: Response): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': resp.headers.get('Content-Type') || 'application/json',
  }
  const rlRemaining = resp.headers.get('x-ratelimit-remaining')
  const rlLimit = resp.headers.get('x-ratelimit-limit')
  const rlReset = resp.headers.get('x-ratelimit-reset')
  if (rlRemaining) h['X-RateLimit-Remaining'] = rlRemaining
  if (rlLimit) h['X-RateLimit-Limit'] = rlLimit
  if (rlReset) h['X-RateLimit-Reset'] = rlReset
  return h
}

export const onRequestGet: PagesFunction<GhEnv> = async ({ request, env }) => {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const resp = await fetch(`https://api.github.com${path}`, { headers: buildHeaders(env) })
    const data = await resp.text()
    return new Response(data, { status: resp.status, headers: forwardRateLimitHeaders(resp) })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// GraphQL POST proxy — body is { query: string, variables: object }
export const onRequestPost: PagesFunction<GhEnv> = async ({ request, env }) => {
  let body: string
  try {
    body = await request.text()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headers = buildHeaders(env)
  headers['Content-Type'] = 'application/json'

  try {
    const resp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body,
    })
    const data = await resp.text()
    return new Response(data, { status: resp.status, headers: forwardRateLimitHeaders(resp) })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
